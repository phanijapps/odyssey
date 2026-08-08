import { requireMutationProof } from "../../../server/identity/identity";
import {
  recommendNextLevel,
  submitAnswer,
} from "../../../server/learning/learning";
import { requestLearningFixture } from "../../../server/agent/agent";
import { validateLearningPayload } from "../../../server/validation/payloads";
import {
  projectLearningSignal,
  recallLearningContext,
  writeLearningSignal,
} from "../../../server/memory/engram-memory";

export async function POST(request: Request): Promise<Response> {
  try {
    const { childId } = requireMutationProof(request);
    const body = (await request.json()) as {
      topicId?: string;
      answer?: string;
      nextLevel?: number;
    };
    const recommendedLevel = recommendNextLevel({
      currentLevel: body.nextLevel ?? 0,
      correctStreak: body.answer === "2" ? 2 : 0,
      memoryAvailable: false,
    });
    const result = await submitAnswer({
      childId,
      topicId: body.topicId ?? "",
      answer: body.answer ?? "",
      nextLevel: recommendedLevel,
    });
    const memoryWritten = await writeLearningSignal(
      childId,
      projectLearningSignal({
        topicId: body.topicId ?? "",
        acceptedLevel: result.level,
        correct: body.answer === "2",
        progressState: result.level >= 5 ? "proficient" : "practicing",
      }),
    );
    const memoryRecalled = await recallLearningContext(childId);
    const nextQuestion = await requestLearningFixture({
      childId,
      topicId: body.topicId ?? "",
      level: result.level,
    });
    validateLearningPayload({
      component: "GeometryDiagram",
      diagramSvg: nextQuestion.diagramSvg,
    });
    return Response.json({
      ...result,
      memoryWritten,
      memoryRecalled,
      nextQuestion,
    });
  } catch {
    return Response.json({ error: "Unable to save answer" }, { status: 400 });
  }
}
