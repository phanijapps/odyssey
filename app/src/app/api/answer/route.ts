import { requireMutationProof } from "../../../server/identity/identity";
import { submitAnswer } from "../../../server/learning/learning";

export async function POST(request: Request): Promise<Response> {
  try {
    const { childId } = requireMutationProof(request);
    const body = (await request.json()) as {
      topicId?: string;
      answer?: string;
      nextLevel?: number;
    };
    return Response.json(
      await submitAnswer({
        childId,
        topicId: body.topicId ?? "",
        answer: body.answer ?? "",
        nextLevel: body.nextLevel ?? 0,
      }),
    );
  } catch {
    return Response.json({ error: "Unable to save answer" }, { status: 400 });
  }
}
