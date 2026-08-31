import {
  createParentAccount,
  listParentAccounts,
  requireAdminMutationProof,
  requireAdminRead,
} from "../../../../server/identity/identity";

function errorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Request failed";
  const status =
    message === "Sign-in required"
      ? 401
      : message === "Admin access required" ||
          message === "Mutation proof required"
        ? 403
        : message.includes("invalid") || message.includes("unavailable")
          ? 400
          : 500;
  return Response.json(
    { error: status === 500 ? "Unable to manage parents" : message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function isParentCreateBody(
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

/** Lists every parent account with its active children usernames. */
export function GET(request: Request): Response {
  try {
    requireAdminRead(request);
    return Response.json(
      { parents: listParentAccounts() },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

/** Creates a parent account for the admin. */
export async function POST(request: Request): Promise<Response> {
  try {
    requireAdminMutationProof(request);
    const body: unknown = await request.json();
    if (!isParentCreateBody(body))
      throw new Error("Parent credentials are invalid");
    const parent = await createParentAccount(body);
    return Response.json(
      { parent },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
