import { requireLearnerMutationProof } from "../../../../server/identity/identity";
import { submitAssessmentAnswer } from "../../../../server/learning/assessment";
import { presentAssessment } from "../route";

/** Grades only the current server-owned test assignment. */
export async function POST(request: Request): Promise<Response> {
  try {
    const { childId } = requireLearnerMutationProof(request);
    const body: unknown = await request.json();
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).length !== 3 ||
      typeof (body as { assessmentId?: unknown }).assessmentId !== "string" ||
      typeof (body as { answer?: unknown }).answer !== "string" ||
      typeof (body as { assignmentToken?: unknown }).assignmentToken !==
        "string"
    )
      throw new Error("Invalid test answer");
    const answer = (body as { answer: string }).answer;
    const assignmentToken = (body as { assignmentToken: string })
      .assignmentToken;
    if (
      !answer.trim() ||
      answer.length > 100 ||
      !assignmentToken ||
      assignmentToken.length > 100
    )
      throw new Error("Invalid test answer");
    const actor = { learnerId: childId, role: "student" as const };
    const state = submitAssessmentAnswer({
      actor,
      assessmentId: (body as { assessmentId: string }).assessmentId,
      answer,
      assignmentToken,
    });
    return Response.json(await presentAssessment(actor, state.id), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Unable to save test answer" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
