import { afterEach, expect, test, vi } from "vitest";
import {
  authenticateChild,
  grantGeneratedPracticeAllowance,
} from "../../../server/identity/identity";
import { POST as submitAnswer } from "../answer/route";
import { POST } from "./route";

const { requestOllamaLearningQuestion } = vi.hoisted(() => ({
  requestOllamaLearningQuestion: vi.fn(),
}));

vi.mock("../../../server/agent/agent", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../server/agent/agent")>()),
  requestOllamaLearningQuestion,
}));

const ollamaConfiguration = {
  integration: process.env.OLLAMA_INTEGRATION,
  provider: process.env.PI_PROVIDER,
  model: process.env.PI_MODEL,
};

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  restoreEnvironment("OLLAMA_INTEGRATION", ollamaConfiguration.integration);
  restoreEnvironment("PI_PROVIDER", ollamaConfiguration.provider);
  restoreEnvironment("PI_MODEL", ollamaConfiguration.model);
  requestOllamaLearningQuestion.mockReset();
  requestOllamaLearningQuestion.mockRejectedValue(
    new Error("Ollama integration is disabled"),
  );
});

async function authenticatedSession(): Promise<string> {
  const session = await authenticateChild({
    username: "demo",
    password: "demo",
  });
  return session.sessionToken;
}

function requestFor(
  path: string,
  sessionToken: string,
  body: unknown,
): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `session=${sessionToken}`,
      origin: "http://localhost",
    },
    body: JSON.stringify(body),
  });
}

async function authenticatedRequest(body: unknown): Promise<Request> {
  return requestFor(
    "/api/generated-question",
    await authenticatedSession(),
    body,
  );
}

test("rejects unknown generated-practice request fields", async () => {
  const sessionToken = await authenticatedSession();
  await submitAnswer(
    requestFor("/api/answer", sessionToken, {
      topicId: "ratio",
      answer: "2:1",
    }),
  );
  const response = await POST(
    requestFor("/api/generated-question", sessionToken, {
      topicId: "ratio",
      level: 13,
    }),
  );
  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toEqual({
    error: "Unable to request generated practice",
  });
});

test("requires a same-site child session before requesting generated practice", async () => {
  const response = await POST(
    new Request("http://localhost/api/generated-question", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topicId: "ratio" }),
    }),
  );
  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toEqual({
    error: "Unable to request generated practice",
  });
});

test("rejects a missing topicId before provider access", async () => {
  const sessionToken = await authenticatedSession();
  const response = await POST(
    requestFor("/api/generated-question", sessionToken, {
      topicId: "",
    }),
  );
  expect(response.status).toBe(400);
  expect(requestOllamaLearningQuestion).not.toHaveBeenCalled();
});

test("rejects a reviewed topic that does not match the answer-issued allowance", async () => {
  const sessionToken = await authenticatedSession();
  await submitAnswer(
    requestFor("/api/answer", sessionToken, {
      topicId: "ratio",
      answer: "2:1",
    }),
  );
  const response = await POST(
    requestFor("/api/generated-question", sessionToken, { topicId: "linear" }),
  );

  expect(response.status).toBe(400);
  expect(requestOllamaLearningQuestion).not.toHaveBeenCalled();
});

test("requires an accepted answer before provider access", async () => {
  const response = await POST(await authenticatedRequest({ topicId: "ratio" }));

  expect(response.status).toBe(400);
  expect(requestOllamaLearningQuestion).not.toHaveBeenCalled();
});

test("returns a recoverable state when the configured provider is unavailable", async () => {
  delete process.env.OLLAMA_INTEGRATION;
  delete process.env.PI_PROVIDER;
  delete process.env.PI_MODEL;

  const sessionToken = await authenticatedSession();
  await submitAnswer(
    requestFor("/api/answer", sessionToken, {
      topicId: "ratio",
      answer: "2:1",
    }),
  );
  const response = await POST(
    requestFor("/api/generated-question", sessionToken, { topicId: "ratio" }),
  );

  expect(response.status).toBe(503);
  await expect(response.json()).resolves.toEqual({
    error:
      "Generated practice is unavailable. Your local practice question is still ready.",
  });
});

test("uses the persisted level after an answer to request generated practice", async () => {
  const sessionToken = await authenticatedSession();
  const answerResponse = await submitAnswer(
    requestFor("/api/answer", sessionToken, {
      topicId: "ratio",
      answer: "2:1",
    }),
  );
  const answer = (await answerResponse.json()) as { level: number };
  requestOllamaLearningQuestion.mockResolvedValue({
    question:
      "A smoothie recipe uses 1 cup of water for every 2 cups of flour. How many cups of flour are needed?",
    answer: "2",
    acceptableAnswers: [],
    hint: "Divide flour by water.",
    diagramSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" aria-label="ratio diagram" />',
  });

  const response = await POST(
    requestFor("/api/generated-question", sessionToken, { topicId: "ratio" }),
  );

  expect(response.status).toBe(200);
  expect(requestOllamaLearningQuestion).toHaveBeenCalledWith(
    expect.objectContaining({
      topicId: "ratio",
      level: answer.level,
    }),
  );
});

test("consumes the generation allowance after one provider request", async () => {
  const sessionToken = await authenticatedSession();
  await submitAnswer(
    requestFor("/api/answer", sessionToken, {
      topicId: "ratio",
      answer: "2:1",
    }),
  );
  requestOllamaLearningQuestion.mockResolvedValue({
    question:
      "A smoothie recipe uses 1 cup of water for every 2 cups of flour. How many cups of flour are needed?",
    answer: "2",
    acceptableAnswers: [],
    hint: "Divide flour by water.",
    diagramSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" aria-label="ratio diagram" />',
  });
  const first = await POST(
    requestFor("/api/generated-question", sessionToken, { topicId: "ratio" }),
  );
  const second = await POST(
    requestFor("/api/generated-question", sessionToken, { topicId: "ratio" }),
  );

  expect(first.status).toBe(200);
  expect(second.status).toBe(400);
  expect(requestOllamaLearningQuestion).toHaveBeenCalledTimes(1);
});
