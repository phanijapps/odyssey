import { requireLearnerRead } from "../../../server/identity/identity";
import { getLearnerPerformanceDocument } from "../../../server/learning/performance";

/** Returns one authenticated learner's read-only, validated A2UI Performance surface. */
export function GET(request: Request): Response {
  let childId: string;
  try {
    ({ childId } = requireLearnerRead(request));
  } catch (error) {
    const status =
      error instanceof Error && error.message === "Learner access required"
        ? 403
        : 401;
    return Response.json(
      {
        error: status === 403 ? "Learner access required" : "Sign-in required",
      },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    return Response.json(
      { document: getLearnerPerformanceDocument(childId) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Performance is unavailable" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
