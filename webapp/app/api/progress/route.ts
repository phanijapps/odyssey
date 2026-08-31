import {
  createQuestionPool,
  generateLazyQuestion,
  poolProgress,
  selectNextQuestion,
} from "@odyssey/core";
import type { AtlasNode } from "@odyssey/core";
import { getStandardsForSelection } from "@odyssey/db";
import {
  compareAndSetSessionPool,
  createPracticeAssignmentToken,
  getSessionPoolState,
  requireLearnerRead,
  type SessionPool,
} from "../../../server/identity/identity";
import { getLearningProgress } from "../../../server/learning/learning";
import { textResponseInteraction } from "@odyssey/core";
import { generateSkillAtlas } from "@odyssey/ai";

/** Converts an atlas node into a PoolQuestion-shaped session entry. */
function atlasNodeToPoolQuestion(
  node: AtlasNode,
  topicId: string,
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
  void topicId;
}

/**
 * Fires ONE background atlas generation call for the skill.
 * Bank questions serve immediately; atlas nodes land atomically with a
 * pool resize so the 6-question bank-era batchSize doesn't block them.
 */
function launchAtlasBackgroundFetch(
  request: Request,
  topicId: string,
  standards: Standards,
): void {
  const standard = standards[0];
  if (!standard) return;
  void (async () => {
    try {
      const atlas = await generateSkillAtlas({
        topicId,
        standardCode: standard.standardCode,
        standardText: standard.standardText,
      });
      if (!atlas) return;

      // Atomically replace unshown bank placeholders with atlas nodes.
      // Shown questions stay (already consumed); unshown bank questions
      // were just placeholders during generation and are superseded.
      for (let attempt = 0; attempt < 3; attempt++) {
        const state = getSessionPoolState(request);
        if (!state) return;
        const pool = state.pool;
        if (pool.topicId !== topicId) return; // learner switched skills

        const kept = pool.questions.filter((q) => pool.shownIds.includes(q.id));
        const atlasQuestions = atlas.nodes.map((n) =>
          atlasNodeToPoolQuestion(n, topicId),
        );

        const replaced: SessionPool = {
          ...pool,
          questions: [...kept, ...atlasQuestions],
          batchSize: kept.length + atlasQuestions.length,
        };
        if (compareAndSetSessionPool(request, state.serialized, replaced))
          break;
      }
    } catch {
      // Atlas generation is best-effort — bank questions serve fine alone.
    }
  })();
}

type Standards = readonly { standardCode: string; standardText: string }[];

/**
 * Claims one unshown Practice question with a CSPRNG assignment token. A
 * concurrent request either observes the same active assignment or retries
 * after its conditional pool update loses the race.
 */
async function claimPracticeQuestion(
  request: Request,
  topicId: string,
  standards: Standards,
): Promise<{
  pool: SessionPool;
  question: SessionPool["questions"][number] | null;
  assignmentToken: string | null;
  claimed: boolean;
} | null> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const state = getSessionPoolState(request);
    const current = state?.pool;
    if (
      !current ||
      current.topicId !== topicId ||
      (current.mode ?? "practice") !== "practice"
    ) {
      // RFC-0009: bank-only pool creation (instant), atlas fires in background
      const created = await createQuestionPool(topicId, standards, "practice");
      launchAtlasBackgroundFetch(request, topicId, standards);
      const pool: SessionPool = {
        topicId: created.topicId,
        questions: created.questions,
        shownIds: [...created.shownIds],
        currentDifficulty: created.currentDifficulty,
        batchPosition: created.batchPosition,
        batchSize: created.batchSize,
        mode: "practice",
      };
      if (compareAndSetSessionPool(request, state?.serialized ?? null, pool))
        continue;
      continue;
    }

    const active = current.activeAssignment;
    if (active) {
      const question = current.questions.find(
        (candidate) => candidate.id === active.questionId,
      );
      if (question)
        return {
          pool: current,
          question,
          assignmentToken: active.token,
          claimed: false,
        };
      // A malformed legacy record must never become answerable.
      if (
        compareAndSetSessionPool(request, state.serialized, {
          ...current,
          activeAssignment: undefined,
        })
      )
        continue;
      continue;
    }

    const selection = selectNextQuestion(current as never);
    if (!selection.question) {
      // Do not report a temporary prefetch race as pool exhaustion. Fill one
      // remaining slot synchronously, then claim it through the same CAS path.
      if (current.questions.length < current.batchSize) {
        // RFC-0009: no blocking AI call — the atlas (or bank) fills the pool
        const generated = await generateLazyQuestion(
          topicId,
          current.currentDifficulty as 1 | 2 | 3,
          standards,
          current.questions as never,
        );
        if (
          generated &&
          compareAndSetSessionPool(request, state.serialized, {
            ...current,
            questions: [...current.questions, generated],
          })
        )
          continue;
        continue;
      }
      return {
        pool: current,
        question: null,
        assignmentToken: null,
        claimed: false,
      };
    }
    const assignmentToken = createPracticeAssignmentToken();
    const nextPool: SessionPool = {
      ...selection.pool,
      mode: "practice",
      activeAssignment: {
        questionId: selection.question.id,
        token: assignmentToken,
      },
    };
    if (compareAndSetSessionPool(request, state.serialized, nextPool))
      return {
        pool: nextPool,
        question: selection.question,
        assignmentToken,
        claimed: true,
      };
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
      { status: 401 },
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

  const claimed = await claimPracticeQuestion(request, topicId, standards);
  if (!claimed)
    return Response.json(
      { error: "Practice question unavailable" },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  if (!claimed.question || !claimed.assignmentToken)
    return Response.json(
      { ...progress, nextQuestion: null, poolExhausted: true },
      { headers: { "Cache-Control": "no-store" } },
    );

  // RFC-0009: no post-claim prefetch — the atlas already appended everything

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
