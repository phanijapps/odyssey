import { requireLearnerRead } from "../../../server/identity/identity";
import { listSuggestionState } from "../../../server/learning/parent-suggestions";

function errorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Request failed";
  const status =
    message === "Sign-in required"
      ? 401
      : message === "Learner access required"
        ? 403
        : 500;
  return Response.json(
    { error: status === 500 ? "Suggestion is unavailable" : message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

/** Returns the signed-in child's active, plan-validated practice suggestion. */
export function GET(request: Request): Response {
  try {
    const { childId } = requireLearnerRead(request);
    return Response.json(
      { suggestion: listSuggestionState(childId).active },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
