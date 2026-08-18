import { requireLearnerMutationProof } from "../../../../server/identity/identity";
import { acceptSuggestion } from "../../../../server/learning/parent-suggestions";

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
    { error: status === 500 ? "Unable to accept suggestion" : message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

/** Accepts the active suggestion and returns the learner's own practice target. */
export function POST(request: Request): Response {
  try {
    const { childId } = requireLearnerMutationProof(request);
    const accepted = acceptSuggestion(childId);
    if (!accepted)
      return Response.json(
        { error: "No active suggestion" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    return Response.json(accepted, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
