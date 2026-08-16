import { afterEach, expect, test, vi } from "vitest";
import {
  completeWithLocalOllama,
  extractLocalOllamaCompletionText,
  LocalOllamaCompletionError,
} from "./pi-completion";

const environment = {
  model: process.env.PI_MODEL,
  apiKey: process.env.PI_API_KEY,
  url: process.env.OLLAMA_OPENAI_URL,
};

afterEach(() => {
  vi.unstubAllGlobals();
  restoreEnvironment("PI_MODEL", environment.model);
  restoreEnvironment("PI_API_KEY", environment.apiKey);
  restoreEnvironment("OLLAMA_OPENAI_URL", environment.url);
});

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function completionResponse(text: string): Response {
  const body = [
    `data: ${JSON.stringify({
      id: "completion-1",
      choices: [{ delta: { content: text }, finish_reason: null }],
    })}`,
    "",
    `data: ${JSON.stringify({
      id: "completion-1",
      choices: [{ delta: {}, finish_reason: "stop" }],
    })}`,
    "",
    "data: [DONE]",
    "",
  ].join("\n");
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

test("uses Pi's OpenAI-completions contract with loopback-only bounded requests", async () => {
  process.env.PI_MODEL = "local-test-model";
  process.env.PI_API_KEY = "local-key";
  const fetch = vi.fn(async () => completionResponse('{"answer":2}'));
  vi.stubGlobal("fetch", fetch);

  await expect(
    completeWithLocalOllama({
      systemPrompt: "Return JSON only.",
      messages: ["First input", "Second input"],
      timeoutMs: 60_000,
      maxTokens: 4_096,
    }),
  ).resolves.toBe('{"answer":2}');

  expect(fetch).toHaveBeenCalledOnce();
  const [url, options] = fetch.mock.calls[0] as unknown as [
    string,
    RequestInit,
  ];
  expect(url).toBe("http://127.0.0.1:11434/v1/chat/completions");
  expect(new Headers(options.headers).get("authorization")).toBe(
    "Bearer local-key",
  );
  expect(JSON.parse(String(options.body))).toMatchObject({
    model: "local-test-model",
    stream: true,
    max_tokens: 4_096,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "Return JSON only." },
      { role: "user", content: "First input" },
      { role: "user", content: "Second input" },
    ],
  });
  expect(JSON.parse(String(options.body))).not.toHaveProperty("tools");
});

test("uses Ollama's local fallback credential and rejects unsafe completion states", async () => {
  process.env.PI_MODEL = "local-test-model";
  delete process.env.PI_API_KEY;
  const fetch = vi.fn(async () => completionResponse("{}"));
  vi.stubGlobal("fetch", fetch);

  await completeWithLocalOllama({ systemPrompt: "", messages: ["{}"] });
  const [, options] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(new Headers(options.headers).get("authorization")).toBe(
    "Bearer ollama",
  );
  expect(() =>
    extractLocalOllamaCompletionText({
      role: "assistant",
      content: [],
      api: "openai-completions",
      provider: "local-ollama",
      model: "local-test-model",
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: "error",
      errorMessage: "provider failed",
      timestamp: 0,
    }),
  ).toThrow(new LocalOllamaCompletionError("provider failed"));
});

test("refuses requests beyond the completion boundary", async () => {
  process.env.PI_MODEL = "local-test-model";
  await expect(
    completeWithLocalOllama({
      systemPrompt: "",
      messages: ["input"],
      timeoutMs: 120_001,
    }),
  ).rejects.toThrow("Local Ollama request exceeds limit");
});
