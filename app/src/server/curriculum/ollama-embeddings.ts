import "server-only";

export const OLLAMA_EMBEDDING_MODEL = "nomic-embed-text:latest";
export const OLLAMA_EMBEDDING_DIMENSION = 768;

/** Produces a local, fixed-dimension curriculum embedding through Ollama. */
export async function embedCurriculumText(text: string): Promise<number[]> {
  const response = await fetch("http://127.0.0.1:11434/api/embed", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: OLLAMA_EMBEDDING_MODEL, input: text }),
    signal: AbortSignal.timeout(30_000),
  });
  const payload = (await response.json()) as { embeddings?: unknown };
  const vector = Array.isArray(payload.embeddings) ? payload.embeddings[0] : null;
  if (!response.ok || !Array.isArray(vector) || vector.length !== OLLAMA_EMBEDDING_DIMENSION || !vector.every((value) => typeof value === "number" && Number.isFinite(value)))
    throw new Error("Invalid Ollama embedding response");
  return vector;
}
