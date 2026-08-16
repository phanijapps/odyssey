import { afterEach, expect, test, vi } from "vitest";
import { CurriculumPiAgent } from "./curriculum-pi-agent";

const silverOutput = {
  sourceSummary: "A Grade 6 source about ratios.",
  records: [
    {
      recordId: "source:1",
      title: "Ratio reasoning",
      officialText: "Use ratio reasoning to solve problems.",
      source: { page: 1 },
    },
  ],
  warnings: [],
};

const curriculumEnvironment = {
  model: process.env.PI_MODEL,
  key: process.env.PI_API_KEY,
};

afterEach(() => {
  vi.unstubAllGlobals();
  if (curriculumEnvironment.model === undefined) delete process.env.PI_MODEL;
  else process.env.PI_MODEL = curriculumEnvironment.model;
  if (curriculumEnvironment.key === undefined) delete process.env.PI_API_KEY;
  else process.env.PI_API_KEY = curriculumEnvironment.key;
});

function piCompletionResponse(content: string): Response {
  return new Response(
    [
      `data: ${JSON.stringify({
        id: "curriculum-1",
        choices: [{ delta: { content }, finish_reason: null }],
      })}`,
      "",
      `data: ${JSON.stringify({
        id: "curriculum-1",
        choices: [{ delta: {}, finish_reason: "stop" }],
      })}`,
      "",
      "data: [DONE]",
      "",
    ].join("\n"),
    { status: 200, headers: { "content-type": "text/event-stream" } },
  );
}

test("uses the Bronze cleanup prompt and validates JSON-only Silver output", async () => {
  const invoke = vi.fn().mockResolvedValue(JSON.stringify(silverOutput));
  const agent = new CurriculumPiAgent(invoke);

  await expect(
    agent.run({
      stage: "bronze-to-silver",
      input: {
        source: "Grade 6 ratio standard",
        sourceFingerprint: "a".repeat(64),
        format: "text",
      },
    }),
  ).resolves.toEqual({
    ...silverOutput,
    provenance: { promptVersion: "bronze-to-silver/v1" },
  });
  expect(invoke).toHaveBeenCalledWith(
    expect.objectContaining({
      stage: "bronze-to-silver",
      promptPath: expect.stringContaining("bronze-to-silver.system.md"),
      data: expect.stringContaining("<curriculum-data>"),
    }),
  );
});

test("rejects a non-loopback endpoint before requesting a curriculum completion", async () => {
  const previousUrl = process.env.OLLAMA_OPENAI_URL;
  const previousModel = process.env.PI_MODEL;
  try {
    process.env.OLLAMA_OPENAI_URL = "http://example.test/v1";
    process.env.PI_MODEL = "test-model";
    const agent = new CurriculumPiAgent();
    await expect(
      agent.run({
        stage: "bronze-to-silver",
        input: { source: "source", sourceFingerprint: "a", format: "text" },
      }),
    ).rejects.toThrow("Invalid Ollama OpenAI URL");
  } finally {
    if (previousUrl === undefined) delete process.env.OLLAMA_OPENAI_URL;
    else process.env.OLLAMA_OPENAI_URL = previousUrl;
    if (previousModel === undefined) delete process.env.PI_MODEL;
    else process.env.PI_MODEL = previousModel;
  }
});

test("rejects malformed agent output and inputs beyond the bounded request size", async () => {
  const agent = new CurriculumPiAgent(async () => "not-json");
  await expect(
    agent.run({
      stage: "bronze-to-silver",
      input: { source: "source", sourceFingerprint: "a", format: "text" },
    }),
  ).rejects.toThrow("Invalid Pi JSON response");
  await expect(
    agent.run({
      stage: "bronze-to-silver",
      input: { source: "x".repeat(120_001) },
    }),
  ).rejects.toThrow("Curriculum Pi input exceeds limit");
});

test("preserves the curriculum completion token limit through the Pi adapter", async () => {
  process.env.PI_MODEL = "curriculum-test-model";
  process.env.PI_API_KEY = "local-key";
  const fetch = vi.fn(async () =>
    piCompletionResponse(JSON.stringify(silverOutput)),
  );
  vi.stubGlobal("fetch", fetch);

  await expect(
    new CurriculumPiAgent().run({
      stage: "bronze-to-silver",
      input: { source: "source", sourceFingerprint: "a", format: "text" },
    }),
  ).resolves.toMatchObject({ sourceSummary: silverOutput.sourceSummary });

  const [, options] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  const body = JSON.parse(String(options.body));
  expect(body.max_tokens).toBe(8_192);
  expect(body.messages).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ role: "system" }),
      expect.objectContaining({
        role: "user",
        content: expect.stringContaining("<curriculum-data>"),
      }),
    ]),
  );
  expect(body).not.toHaveProperty("tools");
});
