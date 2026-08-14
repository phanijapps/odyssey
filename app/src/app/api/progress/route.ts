import {
  createQuestionPool,
  selectNextQuestion,
  poolProgress,
  prefetchNextQuestion,
} from "../../../server/agent/adaptive-pool";
import { getStandardsForSelection } from "../../../server/curriculum/browse";
import {
  resolveSession,
  setSessionPool,
  getSessionPool,
} from "../../../server/identity/identity";
import { getLearningProgress } from "../../../server/learning/learning";

/** Returns the signed-in child's progress and the next question from the adaptive pool. */
export async function GET(request: Request): Promise<Response> {
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
  const needsNewPool =
    !pool ||
    pool.topicId !== topicId ||
    !pool.questions.some((q) => !pool!.shownIds.includes(q.id));

  if (needsNewPool) {
    const newPool = await createQuestionPool(topicId, standards);
    pool = {
      topicId: newPool.topicId,
      questions: newPool.questions,
      shownIds: [...newPool.shownIds],
      currentDifficulty: newPool.currentDifficulty,
      batchPosition: newPool.batchPosition,
      batchSize: newPool.batchSize,
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
  const { question, pool: updatedPool } = selectNextQuestion({
    topicId: pool.topicId,
    questions: pool.questions as never,
    shownIds: pool.shownIds,
    currentDifficulty: pool.currentDifficulty as 1 | 2 | 3,
    batchPosition: pool.batchPosition,
    batchSize: pool.batchSize,
  });

  setSessionPool(request, {
    topicId: updatedPool.topicId,
    questions: updatedPool.questions,
    shownIds: updatedPool.shownIds,
    currentDifficulty: updatedPool.currentDifficulty,
    batchPosition: updatedPool.batchPosition,
    batchSize: updatedPool.batchSize,
  });

  if (!question) {
    return Response.json(
      { ...progress, nextQuestion: null, poolExhausted: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // Pre-generate the next question in the background so answering is instant.
  prefetchNextQuestion(topicId, 2, standards, (next) => {
    const current = getSessionPool(request);
    if (!current || current.topicId !== topicId) return;
    if (current.questions.some((q) => q.id === next.id)) return;
    setSessionPool(request, {
      ...current,
      questions: [...current.questions, next],
    });
  });

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
      nextQuestion: {
        question: question.question,
        diagramSvg: question.diagramSvg,
      },
      poolProgress: prog,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
