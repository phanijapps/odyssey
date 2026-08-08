import { getProfileMemoryState } from "../../../server/memory/engram-memory";

export function GET(): Response {
  const available = process.env.ODYSSEY_ENGRAM_ARTIFACT === "available";
  return Response.json(getProfileMemoryState(available), {
    headers: { "Cache-Control": "no-store" },
  });
}
