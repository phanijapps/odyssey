import { requireLearnerMutationProof } from "../../../../server/identity/identity";
import { dismissSuggestion } from "../../../../server/learning/parent-suggestions";

function errorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Request failed";
  const status =
    message === "Sign-in required"
      ? 401
      : message === "Learner access required" ||
          message === "Mutation proof required"
        ? 403
        : 500;
  return Response.json(
    { error: status === 500 ? "Unable to dismiss suggestion" : message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

/** Quietly dismisses the active suggestion. */
export function POST(request: Request): Response {
  try {
    const { childId } = requireLearnerMutationProof(request);
    if (!dismissSuggestion(childId))
      return Response.json(
        { error: "No active suggestion" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
