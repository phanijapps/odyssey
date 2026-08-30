import {
  createQuestionPool,
  generateLazyQuestion,
  poolProgress,
  prefetchNextQuestion,
  selectNextQuestion,
} from "../../../server/agent/adaptive-pool";
import { getStandardsForSelection } from "../../../server/curriculum/browse";
import {
  appendSessionPoolQuestion,
  compareAndSetSessionPool,
  createPracticeAssignmentToken,
  getSessionPoolState,
  requireLearnerRead,
  type SessionPool,
} from "../../../server/identity/identity";
import { getLearningProgress } from "../../../server/learning/learning";
import { textResponseInteraction } from "../../../server/learning/question-interactions";

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
      const created = await createQuestionPool(topicId, standards, "practice");
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

  if (claimed.claimed)
    prefetchNextQuestion(
      topicId,
      claimed.pool.currentDifficulty as 1 | 2 | 3,
      standards,
      (next) => appendSessionPoolQuestion(request, next),
    );

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
