/**
 * The legacy parent projection had no parent-child authorization model.
 * It is intentionally unavailable until the linked-child Performance BFF lands.
 */
export function GET(): Response {
  return Response.json(
    { error: "Parent portal is not available yet" },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
