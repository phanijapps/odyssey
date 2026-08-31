/** Returns the confined OpenAI-compatible endpoint for the local Ollama service. */
export function getOllamaOpenAIUrl(): string {
  const url = new URL(
    process.env.OLLAMA_OPENAI_URL ?? "http://127.0.0.1:11434/v1",
  );
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "::1"].includes(url.hostname) ||
    url.port !== "11434" ||
    !["/v1", "/v1/"].includes(url.pathname) ||
    url.search ||
    url.hash
  )
    throw new Error("Invalid Ollama OpenAI URL");
  return url.toString().replace(/\/$/, "");
}
