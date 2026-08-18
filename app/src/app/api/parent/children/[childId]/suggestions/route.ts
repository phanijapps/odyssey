import {
  learnerScopeKeyForUsername,
  listParentChildren,
  requireParentMutationProof,
  requireParentRead,
} from "../../../../../../server/identity/identity";
import {
  cancelSuggestion,
  listSuggestionState,
  suggestPractice,
} from "../../../../../../server/learning/parent-suggestions";

function errorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Request failed";
  const status =
    message === "Sign-in required"
      ? 401
      : message === "Parent access required" ||
          message === "Mutation proof required" ||
          message === "Child access denied"
        ? 403
        : message.includes("current plan") || message.includes("invalid")
          ? 400
          : 500;
  return Response.json(
    { error: status === 500 ? "Unable to suggest practice" : message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function validChildId(value: string): boolean {
  return /^[a-f0-9]{32}$/.test(value);
}

type Context = { params: Promise<{ childId: string }> };

/** Resolves the linked child's scope key or throws the closed 403. */
async function resolveLinkedScope(
  parentAccountId: string,
  context: Context,
): Promise<{ childId: string; scope: string }> {
  const { childId } = await context.params;
  const child = listParentChildren(parentAccountId).find(
    (candidate) => candidate.accountId === childId,
  );
  if (!validChildId(childId) || !child) throw new Error("Child access denied");
  return { childId, scope: learnerScopeKeyForUsername(child.username) };
}

/** Lists the child's recommended plan skills and any active suggestion. */
export async function GET(
  request: Request,
  context: Context,
): Promise<Response> {
  try {
    const { parentAccountId } = requireParentRead(request);
    const { scope } = await resolveLinkedScope(parentAccountId, context);
    return Response.json(listSuggestionState(scope), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Suggests a plan skill for tonight's practice, superseding any active one. */
export async function POST(
  request: Request,
  context: Context,
): Promise<Response> {
  try {
    const { parentAccountId } = requireParentMutationProof(request);
    const { scope } = await resolveLinkedScope(parentAccountId, context);
    const body: unknown = await request.json();
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      typeof (body as Record<string, unknown>).standardCode !== "string"
    )
      throw new Error("Suggestion body is invalid");
    const suggestion = suggestPractice(
      parentAccountId,
      scope,
      (body as { standardCode: string }).standardCode,
    );
    return Response.json(suggestion, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Cancels the child's active suggestion (idempotent). */
export async function DELETE(
  request: Request,
  context: Context,
): Promise<Response> {
  try {
    const { parentAccountId } = requireParentMutationProof(request);
    const { scope } = await resolveLinkedScope(parentAccountId, context);
    cancelSuggestion(parentAccountId, scope);
    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
