import {
  createQuestionPool,
  generateLazyQuestion,
  initialAtlasWalk,
  poolProgress,
  selectNextQuestion,
  textResponseInteraction,
  walkAtlas,
  type AtlasNode,
  type SkillAtlas,
} from "@odyssey/core";
import { getStandardsForSelection } from "@odyssey/db";
import { generateSkillAtlas, isOllamaConfigured } from "@odyssey/ai";
import {
  compareAndSetSessionPool,
  createPracticeAssignmentToken,
  getSessionPoolState,
  requireLearnerRead,
  type SessionPool,
} from "../../../server/identity/identity";
import { getLearningProgress } from "../../../server/learning/learning";

// Covers the 90-second completion deadline and one transport retry. A process
// restart cannot leave a persisted pending batch waiting forever.
const GENERATION_DEADLINE_MS = 240_000;
type Standards = readonly { standardCode: string; standardText: string }[];

/** Projects a selected atlas node into the stored assignment representation. */
function atlasNodeToPoolQuestion(
  node: AtlasNode,
): SessionPool["questions"][number] {
  return {
    id: node.id,
    question: node.question,
    interaction: node.interaction,
    answer: node.answer,
    acceptableAnswers: [...node.acceptableAnswers],
    hint: node.hint,
    solution: [...node.solution],
    diagramSvg: node.diagramSvg,
    difficulty: node.tier,
  };
}

/** Completes only the generation attempt belonging to this exact session pool. */
function launchAtlasBackgroundFetch(
  request: Request,
  topicId: string,
  standard: Standards[number],
  generationId: string,
): void {
  void (async () => {
    let atlas: SkillAtlas | null = null;
    let failureReason = "invalid-batch";
    try {
      atlas = await generateSkillAtlas({ topicId, ...standard });
    } catch {
      failureReason = "provider-error";
    }
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const state = getSessionPoolState(request);
      const pool = state?.pool;
      if (
        !state ||
        !pool ||
        pool.topicId !== topicId ||
        pool.generation?.id !== generationId ||
        pool.generation.status !== "pending"
      )
        return;
      const expired =
        Date.now() - pool.generation.startedAt >= GENERATION_DEADLINE_MS;
      const accepted = !expired && atlas?.topicId === topicId ? atlas : null;
      const kept = pool.questions.filter((q) => pool.shownIds.includes(q.id));
      const updated: SessionPool = accepted
        ? {
            ...pool,
            generation: { ...pool.generation, status: "ready" },
            atlas: accepted,
            atlasWalk: initialAtlasWalk(accepted),
            lastAtlasCorrect: true,
            questions: kept,
            batchSize: kept.length + accepted.nodes.length,
            exhausted: false,
          }
        : {
            ...pool,
            generation: { ...pool.generation, status: "failed" },
          };
      if (compareAndSetSessionPool(request, state.serialized, updated)) {
        if (!accepted)
          console.warn("Practice atlas generation failed", {
            reason: expired ? "expired" : failureReason,
            standardCode: standard.standardCode,
          });
        return;
      }
    }
  })();
}

/** Claims one question atomically; repeated reads retain the active assignment. */
async function claimPracticeQuestion(
  request: Request,
  topicId: string,
  standards: Standards,
  restart: boolean,
): Promise<{
  pool: SessionPool;
  question: SessionPool["questions"][number] | null;
  assignmentToken: string | null;
} | null> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const state = getSessionPoolState(request);
    const current = state?.pool;
    const samePool =
      current?.topicId === topicId &&
      (current.mode ?? "practice") === "practice";
    const canRestart =
      samePool &&
      !current.activeAssignment &&
      current.generation?.status !== "pending" &&
      current.exhausted;
    if (!samePool || (restart && canRestart)) {
      const created = await createQuestionPool(topicId, standards, "practice");
      const generation: SessionPool["generation"] =
        isOllamaConfigured() && standards.length === 1
          ? {
              id: createPracticeAssignmentToken(),
              status: "pending",
              startedAt: Date.now(),
            }
          : undefined;
      const pool: SessionPool = { ...created, generation, mode: "practice" };
      if (compareAndSetSessionPool(request, state?.serialized ?? null, pool)) {
        // Only the winner may start work, after the batch identity is persisted.
        if (generation)
          launchAtlasBackgroundFetch(
            request,
            topicId,
            standards[0],
            generation.id,
          );
        restart = false;
      }
      continue;
    }

    if (
      current.generation?.status === "pending" &&
      Date.now() - current.generation.startedAt >= GENERATION_DEADLINE_MS
    ) {
      if (
        compareAndSetSessionPool(request, state!.serialized, {
          ...current,
          generation: { ...current.generation, status: "failed" },
        })
      )
        console.warn("Practice atlas generation failed", {
          reason: "expired",
          standardCode:
            standards.length === 1 ? standards[0].standardCode : undefined,
        });
      continue;
    }

    const active = current.activeAssignment;
    if (active) {
      const question = current.questions.find(
        (candidate) => candidate.id === active.questionId,
      );
      if (question)
        return { pool: current, question, assignmentToken: active.token };
      compareAndSetSessionPool(request, state!.serialized, {
        ...current,
        activeAssignment: undefined,
      });
      continue;
    }

    let question: SessionPool["questions"][number] | null = null;
    let selectedPool = current;
    if (current.atlas && current.atlasWalk) {
      const selected = walkAtlas(
        current.atlas,
        current.atlasWalk,
        current.lastAtlasCorrect ?? true,
      );
      if (selected.node) {
        question = atlasNodeToPoolQuestion(selected.node);
        selectedPool = {
          ...current,
          questions: [...current.questions, question],
          shownIds: [...current.shownIds, question.id],
          batchPosition: current.batchPosition + 1,
          currentDifficulty: selected.node.tier,
          atlasWalk: selected.state,
        };
      }
    } else if (!current.exhausted) {
      const selected = selectNextQuestion(current as never);
      question = selected.question;
      selectedPool = selected.pool as SessionPool;
      if (!question && current.questions.length < current.batchSize) {
        const bank = await generateLazyQuestion(
          topicId,
          current.currentDifficulty as 1 | 2 | 3,
          standards,
          current.questions as never,
        );
        if (bank) {
          compareAndSetSessionPool(request, state!.serialized, {
            ...current,
            questions: [...current.questions, bank],
          });
          continue;
        }
      }
    }
    if (!question) {
      if (current.generation?.status === "pending") {
        return { pool: current, question: null, assignmentToken: null };
      }
      if (!current.exhausted) {
        compareAndSetSessionPool(request, state!.serialized, {
          ...current,
          exhausted: true,
        });
        continue;
      }
      return { pool: current, question: null, assignmentToken: null };
    }
    const assignmentToken = createPracticeAssignmentToken();
    const nextPool: SessionPool = {
      ...selectedPool,
      mode: "practice",
      activeAssignment: { questionId: question.id, token: assignmentToken },
    };
    if (compareAndSetSessionPool(request, state!.serialized, nextPool))
      return { pool: nextPool, question, assignmentToken };
  }
  return null;
}

/** Returns the signed-in child's progress and one server-bound practice question. */
export async function GET(request: Request): Promise<Response> {
  let childId: string;
  try {
    ({ childId } = requireLearnerRead(request));
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error && error.message === "Learner access required"
            ? error.message
            : "Sign-in required",
      },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const url = new URL(request.url);
  const subject = url.searchParams.get("subject") ?? "Mathematics";
  const grade = url.searchParams.get("grade") ?? "Grade 6";
  const domain = url.searchParams.get("domain") ?? "";
  const standard = url.searchParams.get("standard") ?? "";
  const topicId = url.searchParams.get("topicId") ?? subject.toLowerCase();
  const progress = getLearningProgress(childId, topicId) ?? {
    level: 1,
    correctStreak: 0,
    attemptCount: 0,
  };
  const allStandards = domain
    ? getStandardsForSelection({ subject, grade, domain })
    : [];
  const standards = standard
    ? allStandards.filter((item) => item.standardCode === standard)
    : allStandards;
  // A selected Gold standard defines the only acceptable composite topic ID.
  // Legacy callers without a selection retain their existing bare-topic API.
  if (standard) {
    const expectedTopicId = `${subject}::${grade}::${domain}::${standard}`;
    if (standards.length !== 1 || topicId !== expectedTopicId)
      return Response.json(
        { error: "Invalid Practice selection" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
  }

  if (topicId.length > 300)
    return Response.json(
      { error: "Invalid Practice selection" },
      {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  const claimed = await claimPracticeQuestion(
    request,
    topicId,
    standards,
    url.searchParams.get("restart") === "1",
  );
  if (!claimed)
    return Response.json(
      { error: "Practice question unavailable" },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  if (!claimed.question || !claimed.assignmentToken) {
    if (claimed.pool.generation?.status === "pending")
      return Response.json(
        { ...progress, nextQuestion: null, questionPending: true },
        {
          headers: { "Cache-Control": "no-store" },
        },
      );
    if (claimed.pool.batchPosition === 0)
      return Response.json(
        { error: "Practice question unavailable" },
        {
          status: 409,
          headers: { "Cache-Control": "no-store" },
        },
      );
    return Response.json(
      {
        ...progress,
        nextQuestion: null,
        poolExhausted: true,
        poolProgress: poolProgress(claimed.pool as never),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  return Response.json(
    {
      ...progress,
      nextQuestion: {
        question: claimed.question.question,
        interaction:
          claimed.question.interaction ??
          textResponseInteraction(claimed.question.question),
        diagramSvg: claimed.question.diagramSvg,
        // Contract addition: POST /api/answer requires this opaque token.
        assignmentToken: claimed.assignmentToken,
      },
      poolProgress: poolProgress(claimed.pool as never),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
