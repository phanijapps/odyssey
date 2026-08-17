import { requireLearnerMutationProof } from "../../../../server/identity/identity";
import {
  exitAssessment,
  getAssessmentResult,
} from "../../../../server/learning/assessment";

/** Ends the caller's active test while retaining its answered review. */
export async function POST(request: Request): Promise<Response> {
  try {
    const { childId } = requireLearnerMutationProof(request);
    const body: unknown = await request.json();
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      typeof (body as { assessmentId?: unknown }).assessmentId !== "string"
    )
      throw new Error("Invalid test exit");
    const assessmentId = (body as { assessmentId: string }).assessmentId;
    if (!assessmentId) throw new Error("Invalid test exit");
    const actor = { learnerId: childId, role: "student" as const };
    const assessment = exitAssessment({ actor, assessmentId });
    return Response.json(
      {
        assessment,
        ...(assessment.status === "partial"
          ? { result: getAssessmentResult({ actor, assessmentId }) }
          : {}),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Unable to exit test" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
