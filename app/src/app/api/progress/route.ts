import {
  createQuestionPool,
  selectNextQuestion,
  selectByPlan,
  poolProgress,
  prefetchNextQuestion,
  generateLazyQuestion,
} from "../../../server/agent/adaptive-pool";
import { getStandardsForSelection } from "../../../server/curriculum/browse";
import {
  resolveSession,
  setSessionPool,
  getSessionPool,
  appendSessionPoolQuestion,
} from "../../../server/identity/identity";
import { getLearningProgress } from "../../../server/learning/learning";

/** Returns the signed-in child's progress and the next question from the adaptive pool. */
export async function GET(request: Request): Promise<Response> {
  const ROUTE_V = "v5-testfix";
  const token = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)session=([^;]+)/)?.[1];
  const session = token ? resolveSession(token) : undefined;
  if (!session)
    return Response.json({ error: "Sign-in required" }, { status: 401 });

  const url = new URL(request.url);
  const subject = url.searchParams.get("subject") ?? "Mathematics";
  const grade = url.searchParams.get("grade") ?? "Grade 6";
  const domain = url.searchParams.get("domain") ?? "";
  const standard = url.searchParams.get("standard") ?? "";
  const mode = url.searchParams.get("mode") === "test" ? "test" : "practice";
  const topicId = url.searchParams.get("topicId") ?? subject.toLowerCase();

  const progress = getLearningProgress(session.childId, topicId) ?? {
    level: 1,
    correctStreak: 0,
    attemptCount: 0,
  };

  // Fetch standards from Gold for the selected subject/grade/domain
  const allStandards = domain
    ? getStandardsForSelection({ subject, grade, domain })
    : [];
  const standards = standard
    ? allStandards.filter((s) => s.standardCode === standard)
    : allStandards;

  // Check for an existing pool, or create a new one
  let pool = getSessionPool(request);
  // Recreate only when the pool is missing or the topic/mode changed. An
  // exhausted-looking pool is NOT recreated: in test mode selectByPlan
  // returns null and the caller lazily generates the planned difficulty;
  // recreating here would wipe shownIds and restart the plan from zero.
  const needsNewPool =
    !pool || pool.topicId !== topicId || (pool.mode ?? "practice") !== mode;

  if (needsNewPool) {
    const newPool = await createQuestionPool(topicId, standards, mode);
    pool = {
      topicId: newPool.topicId,
      questions: newPool.questions,
      shownIds: [...newPool.shownIds],
      currentDifficulty: newPool.currentDifficulty,
      batchPosition: newPool.batchPosition,
      batchSize: newPool.batchSize,
      mode: newPool.mode,
      ...(newPool.testPlan ? { testPlan: newPool.testPlan } : {}),
    };
    setSessionPool(request, pool);
  }

  if (!pool) {
    return Response.json(
      { ...progress, nextQuestion: null, poolExhausted: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // Select the next question
  const selectionPool = {
    topicId: pool.topicId,
    questions: pool.questions as never,
    shownIds: pool.shownIds,
    currentDifficulty: pool.currentDifficulty as 1 | 2 | 3,
    batchPosition: pool.batchPosition,
    batchSize: pool.batchSize,
    mode,
    ...(pool.testPlan ? { testPlan: pool.testPlan } : {}),
  } as never;
  const { question, pool: updatedPool } =
    mode === "test"
      ? selectByPlan(selectionPool, pool.shownIds.length)
      : selectNextQuestion(selectionPool);

  setSessionPool(request, {
    topicId: updatedPool.topicId,
    questions: updatedPool.questions,
    shownIds: updatedPool.shownIds,
    currentDifficulty: updatedPool.currentDifficulty,
    batchPosition: updatedPool.batchPosition,
    batchSize: updatedPool.batchSize,
    mode,
    ...(pool.testPlan ? { testPlan: pool.testPlan } : {}),
  });
  // Prefetch the next question: in test mode at the next planned difficulty,
  // in practice mode at the current difficulty.
  const nextTestDifficulty =
    mode === "test" && pool.testPlan
      ? (pool.testPlan[updatedPool.shownIds.length] as 1 | 2 | 3 | undefined)
      : undefined;
  prefetchNextQuestion(topicId, nextTestDifficulty ?? 2, standards, (next) =>
    appendSessionPoolQuestion(request, next),
  );

  if (!question && mode === "test" && pool.testPlan) {
    // No question banked at the planned difficulty yet — generate it now.
    const planned = pool.testPlan[pool.shownIds.length] as 1 | 2 | 3;
    const lazy = await generateLazyQuestion(
      topicId,
      planned,
      standards,
      updatedPool.questions as never,
    );
    if (lazy) {
      const served = {
        ...updatedPool,
        questions: [...updatedPool.questions, lazy],
        shownIds: [...updatedPool.shownIds, lazy.id],
        batchPosition: updatedPool.batchPosition + 1,
        currentDifficulty: planned,
      };
      setSessionPool(request, {
        ...served,
        ...(pool.testPlan ? { testPlan: pool.testPlan } : {}),
      });
      const prog2 = poolProgress(served);
      return Response.json(
        {
          ...progress,
          routeV: ROUTE_V,
          nextQuestion: {
            question: lazy.question,
            diagramSvg: lazy.diagramSvg,
          },
          poolProgress: prog2,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
  }
  if (!question) {
    return Response.json(
      { ...progress, nextQuestion: null, poolExhausted: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const prog = poolProgress({
    topicId: updatedPool.topicId,
    questions: updatedPool.questions,
    shownIds: updatedPool.shownIds,
    currentDifficulty: updatedPool.currentDifficulty,
    batchPosition: updatedPool.batchPosition,
    batchSize: updatedPool.batchSize,
  });

  return Response.json(
    {
      ...progress,
      routeV: ROUTE_V,
      nextQuestion: {
        question: question.question,
        diagramSvg: question.diagramSvg,
      },
      poolProgress: prog,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
