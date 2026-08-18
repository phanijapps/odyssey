import {
  requireAdminMutationProof,
  resetParentAccountPassword,
} from "../../../../../server/identity/identity";

function errorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Request failed";
  const status =
    message === "Sign-in required"
      ? 401
      : message === "Admin access required" ||
          message === "Mutation proof required" ||
          message === "Parent access denied"
        ? 403
        : message.includes("invalid")
          ? 400
          : 500;
  return Response.json(
    { error: status === 500 ? "Unable to manage parent" : message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function validParentId(value: string): boolean {
  return /^[a-f0-9]{32}$/.test(value);
}

/** Resets one parent's password and invalidates all of that parent's sessions. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ parentId: string }> },
): Promise<Response> {
  try {
    requireAdminMutationProof(request);
    const { parentId } = await context.params;
    const body: unknown = await request.json();
    if (
      !validParentId(parentId) ||
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      typeof (body as Record<string, unknown>).password !== "string"
    )
      throw new Error("Parent password is invalid");
    await resetParentAccountPassword(
      parentId,
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
