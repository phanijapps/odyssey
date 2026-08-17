import {
  requireParentMutationProof,
  resetParentChildPassword,
  revokeParentChildLink,
} from "../../../../../server/identity/identity";

function errorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Request failed";
  const status =
    message === "Sign-in required"
      ? 401
      : message === "Parent access required" ||
          message === "Mutation proof required" ||
          message === "Child access denied"
        ? 403
        : message.includes("invalid")
          ? 400
          : 500;
  return Response.json(
    { error: status === 500 ? "Unable to manage child" : message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function validChildId(value: string): boolean {
  return /^[a-f0-9]{32}$/.test(value);
}

/** Resets one linked child's local password and invalidates that child's sessions. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ childId: string }> },
): Promise<Response> {
  try {
    const { parentAccountId } = requireParentMutationProof(request);
    const { childId } = await context.params;
    const body: unknown = await request.json();
    if (
      !validChildId(childId) ||
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      typeof (body as Record<string, unknown>).password !== "string"
    )
      throw new Error("Child password is invalid");
    await resetParentChildPassword(
      parentAccountId,
      childId,
      (body as { password: string }).password,
    );
    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Revokes the parent's link and invalidates the parent's existing sessions. */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ childId: string }> },
): Promise<Response> {
  try {
    const { parentAccountId } = requireParentMutationProof(request);
    const { childId } = await context.params;
    if (!validChildId(childId)) throw new Error("Child access denied");
    revokeParentChildLink(parentAccountId, childId);
    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
