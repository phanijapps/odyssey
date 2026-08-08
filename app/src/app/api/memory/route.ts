import {
  getConfiguredEngramArtifact,
  getProfileMemoryState,
  loadConfiguredEngramTransport,
} from "../../../server/memory/engram-memory";

export function GET(): Response {
  const available =
    process.env.ODYSSEY_ENGRAM_ARTIFACT === "available" &&
    getConfiguredEngramArtifact() !== null &&
    loadConfiguredEngramTransport() !== null;
  return Response.json(getProfileMemoryState(available), {
    headers: { "Cache-Control": "no-store" },
  });
}
