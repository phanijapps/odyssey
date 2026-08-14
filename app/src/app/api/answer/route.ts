import {
  getSessionPool,
  getActiveAiQuestion,
  grantGeneratedPracticeAllowance,
  requireMutationProof,
  setSessionPool,
} from "../../../server/identity/identity";
import {
  getLearningProgress,
  submitAnswer,
} from "../../../server/learning/learning";
import {
  getLearningFixtureAcceptableAnswers,
  getLearningFixtureExpectedAnswer,
  getLearningFixtureHint,
} from "../../../server/agent/agent";
import {
  adjustDifficulty,
  selectNextQuestion,
  poolProgress,
  generateLazyQuestion,
  type PoolQuestion,
  type QuestionPool,
  type Difficulty,
} from "../../../server/agent/adaptive-pool";
import {
  projectLearningSignal,
  recallLearningContext,
  writeLearningSignal,
} from "../../../server/memory/engram-memory";
import { getStandardsForSelection } from "../../../server/curriculum/browse";
import {
  recordLearningAttempt,
  putMasteryBelief,
} from "../../../server/memory/knowledge-graph";

export async function POST(request: Request): Promise<Response> {
  try {
    const { childId } = requireMutationProof(request);
    const body = await request.json();
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      !Object.keys(body).every(
        (key) => key === "topicId" || key === "answer",
      ) ||
      typeof body.topicId !== "string" ||
      typeof body.answer !== "string" ||
      body.topicId.length === 0 ||
      body.topicId.length > 100 ||
      body.answer.length === 0 ||
      body.answer.length > 100
    )
      throw new Error("Invalid answer submission");

    const currentProgress = getLearningProgress(childId, body.topicId);
    const attemptCount = currentProgress?.attemptCount ?? 0;

    // Get the active question from the pool
    const pool = getSessionPool(request);
    let expectedAnswer: string;
    let acceptableAnswers: readonly string[];
    let hint = "";

    // The last shown question is the one being answered
    const lastShownId = pool?.shownIds.at(-1);
    const activeQuestion = pool?.questions.find((q) => q.id === lastShownId);

    if (activeQuestion && pool?.topicId === body.topicId) {
      expectedAnswer = activeQuestion.answer;
      acceptableAnswers = activeQuestion.acceptableAnswers;
      hint = activeQuestion.hint;
    } else {
      // Fallback to question bank
      expectedAnswer = getLearningFixtureExpectedAnswer({
        topicId: body.topicId,
        attemptCount,
      });
      acceptableAnswers = getLearningFixtureAcceptableAnswers({
        topicId: body.topicId,
        attemptCount,
      });
      hint = getLearningFixtureHint({
        topicId: body.topicId,
        attemptCount,
      });
    }

    const result = await submitAnswer({
      childId,
      topicId: body.topicId,
      answer: body.answer,
      expectedAnswer,
      acceptableAnswers,
      nextLevel: 1,
    });

    // Capture the learning pattern into the knowledge graph (best-effort)
    const standardsList = getStandardsForSelection({
      subject: body.topicId.split("::")[0] ?? "",
      grade: body.topicId.split("::")[1] ?? "",
      domain: body.topicId.split("::")[2] ?? "",
    });
    const matchedStandard = standardsList.find(
      (s) => s.standardCode === (body.topicId.split("::")[3] ?? ""),
    );
    if (matchedStandard) {
      recordLearningAttempt({
        childId,
        standardId: matchedStandard.standardCode,
        standardCode: matchedStandard.standardCode,
        correct: result.correct,
        difficulty: pool?.currentDifficulty ?? 2,
        topicId: body.topicId,
      });
      // Update mastery belief from SQLite stats
      const { getTopicDetail } =
        await import("../../../server/learning/learning");
      const detail = getTopicDetail(childId, body.topicId);
      if (detail && detail.attempts > 0) {
        putMasteryBelief({
          childId,
          standardId: matchedStandard.standardCode,
          standardCode: matchedStandard.standardCode,
          correctRate: detail.correct / detail.attempts,
          attempts: detail.attempts,
        });
      }
    }

    const memoryWritten = await writeLearningSignal(
      childId,
      projectLearningSignal({
        topicId: body.topicId,
        acceptedLevel: result.level,
        correct: result.correct,
        progressState: result.level >= 5 ? "proficient" : "practicing",
      }),
    );
    const memoryRecalled = await recallLearningContext(childId);

    // Adjust difficulty and generate next question lazily
    let nextQuestion: { question: string; diagramSvg: string } | null = null;
    let nextHint = "";

    if (pool && pool.topicId === body.topicId) {
      const adjusted: QuestionPool = adjustDifficulty(
        {
          topicId: pool.topicId,
          questions: pool.questions as never,
          shownIds: pool.shownIds,
          currentDifficulty: pool.currentDifficulty as 1 | 2 | 3,
          batchPosition: pool.batchPosition,
          batchSize: pool.batchSize,
        },
        result.correct,
      );

      // Try to get next from pool, or generate lazily
      const { question: pooledQ, pool: updatedPool } =
        selectNextQuestion(adjusted);

      if (pooledQ) {
        nextQuestion = {
          question: pooledQ.question,
          diagramSvg: pooledQ.diagramSvg,
        };
        nextHint = pooledQ.hint;
        setSessionPool(request, {
          topicId: updatedPool.topicId,
          questions: updatedPool.questions,
          shownIds: updatedPool.shownIds,
          currentDifficulty: updatedPool.currentDifficulty,
          batchPosition: updatedPool.batchPosition,
          batchSize: updatedPool.batchSize,
        });
      } else {
        // Generate next question lazily via AI, scoped to the exact standard
        // being practiced (segment [3]) — not the whole domain.
        const allDomainStandards = getStandardsForSelection({
          subject: body.topicId.split("::")[0] ?? "",
          grade: body.topicId.split("::")[1] ?? "",
          domain: body.topicId.split("::")[2] ?? "",
        });
        const selectedStandard = body.topicId.split("::")[3];
        const standards = selectedStandard
          ? allDomainStandards.filter(
              (s) => s.standardCode === selectedStandard,
            )
          : allDomainStandards;
        const lazy = await generateLazyQuestion(
          pool.topicId,
          adjusted.currentDifficulty,
          standards,
          pool.questions as never,
        );
        if (lazy) {
          nextQuestion = {
            question: lazy.question,
            diagramSvg: lazy.diagramSvg,
          };
          nextHint = lazy.hint;
          // Add to pool and mark as shown
          setSessionPool(request, {
            topicId: pool.topicId,
            questions: [...pool.questions, lazy],
            shownIds: [...pool.shownIds, lazy.id],
            currentDifficulty: adjusted.currentDifficulty,
            batchPosition: adjusted.batchPosition + 1,
            batchSize: pool.batchSize,
          });
        }
      }
    }

    // Fallback: if no pool or pool exhausted, use the question bank
    if (!nextQuestion) {
      const { requestLearningFixture } =
        await import("../../../server/agent/agent");
      const fallback = await requestLearningFixture({
        childId,
        topicId: body.topicId,
        level: result.level,
        attemptCount: result.attemptCount,
      });
      nextQuestion = {
        question: fallback.question,
        diagramSvg: fallback.diagramSvg,
      };
    }

    const feedbackHint = result.correct ? "" : hint || nextHint;
    // Compute progress from the updated pool state
    const updatedSessionPool = getSessionPool(request);
    const prog = updatedSessionPool
      ? poolProgress({
          topicId: updatedSessionPool.topicId,
          questions: updatedSessionPool.questions as never,
          shownIds: updatedSessionPool.shownIds,
          currentDifficulty: updatedSessionPool.currentDifficulty as 1 | 2 | 3,
          batchPosition: updatedSessionPool.batchPosition,
          batchSize: updatedSessionPool.batchSize,
        })
      : null;

    grantGeneratedPracticeAllowance(request, body.topicId);
    return Response.json({
      ...result,
      hint: feedbackHint,
      memoryWritten,
      memoryRecalled,
      nextQuestion,
      poolProgress: prog,
    });
  } catch {
    return Response.json({ error: "Unable to save answer" }, { status: 400 });
  }
}
