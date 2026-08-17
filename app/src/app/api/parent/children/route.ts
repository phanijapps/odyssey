import {
  createParentChildAccount,
  listParentChildren,
  requireParentMutationProof,
  requireParentRead,
} from "../../../../server/identity/identity";

function errorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Request failed";
  const status =
    message === "Sign-in required"
      ? 401
      : message === "Parent access required" ||
          message === "Mutation proof required"
        ? 403
        : message.includes("invalid") || message.includes("unavailable")
          ? 400
          : 500;
  return Response.json(
    { error: status === 500 ? "Unable to manage children" : message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function isChildCreateBody(
  value: unknown,
): value is { username: string; password: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return (
    keys.length === 2 &&
    keys.includes("username") &&
    keys.includes("password") &&
    typeof (value as Record<string, unknown>).username === "string" &&
    typeof (value as Record<string, unknown>).password === "string"
  );
}

/** Lists only the children linked to the signed-in parent. */
export function GET(request: Request): Response {
  try {
    const { parentAccountId } = requireParentRead(request);
    return Response.json(
      { children: listParentChildren(parentAccountId) },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

/** Creates a password-protected child account linked to the signed-in parent. */
export async function POST(request: Request): Promise<Response> {
  try {
    const { parentAccountId } = requireParentMutationProof(request);
    const body: unknown = await request.json();
    if (!isChildCreateBody(body))
      throw new Error("Child credentials are invalid");
    const child = await createParentChildAccount(parentAccountId, body);
    return Response.json(
      { child },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
