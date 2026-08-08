import { requireMutationProof } from "../../../server/identity/identity";
import { submitAnswer } from "../../../server/learning/learning";
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
    const result = await submitAnswer({
      childId,
      topicId: body.topicId ?? "",
      answer: body.answer ?? "",
      nextLevel: body.nextLevel ?? 0,
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
    return Response.json({ ...result, memoryWritten, memoryRecalled });
  } catch {
    return Response.json({ error: "Unable to save answer" }, { status: 400 });
  }
}
