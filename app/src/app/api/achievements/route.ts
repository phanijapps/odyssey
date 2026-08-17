import { requireLearnerRead } from "../../../server/identity/identity";
import { getAchievements } from "../../../server/learning/achievements";

/** Returns a learner's recomputed, no-store Practice achievement projection. */
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
  return Response.json(getAchievements(childId), {
    headers: { "Cache-Control": "no-store" },
  });
}
