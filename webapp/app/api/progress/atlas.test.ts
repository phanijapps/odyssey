import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  textResponseInteraction,
  type AtlasNode,
  type SkillAtlas,
} from "@odyssey/core";
import { withGoldDatabase } from "@odyssey/db";
import {
  generateSkillAtlas,
  isOllamaConfigured,
  ollamaQuestionGenerator,
} from "@odyssey/ai";
import {
  authenticateAccount,
  getSessionPoolState,
  logoutSession,
} from "../../../server/identity/identity";
import { GET } from "./route";
import { POST as answer } from "../answer/route";

vi.mock("@odyssey/ai", () => ({
  generateSkillAtlas: vi.fn(),
  isOllamaConfigured: vi.fn(() => true),
  ollamaQuestionGenerator: vi.fn(),
}));

const generate = vi.mocked(generateSkillAtlas);
const bankTopic = "Mathematics::Grade 6::Atlas::6.RP.1";
const unbankedTopic = "Mathematics::Grade 6::Atlas::6.G.1";

function atlas(topicId = bankTopic): SkillAtlas {
  const node = (id: string, concept: string, tier: 1 | 2 | 3): AtlasNode => ({
    id,
    concept,
    tier,
    question: `Practice ${id}: how many groups of 2 make 4?`,
    interaction: textResponseInteraction(
      `Practice ${id}: how many groups of 2 make 4?`,
    ),
    answer: "2",
    acceptableAnswers: [],
    hint: "Divide four by two.",
    solution: ["Divide four by two.", "Four divided by two is two."],
    diagramSvg: "",
  });
  return {
    topicId,
    revision: "test",
    nodes: [
      node("a3", "grouping", 3),
      node("a1", "grouping", 1),
      node("a1b", "grouping", 1),
      node("a2", "grouping", 2),
      node("b1", "sharing", 1),
      node("b2", "sharing", 2),
      node("b3", "sharing", 3),
    ],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function learner() {
  const session = await authenticateAccount({
    username: "test-learner",
    password: "test-learner-password",
  });
  const headers = {
    cookie: `session=${session.sessionToken}`,
    origin: "http://localhost",
    "content-type": "application/json",
  };
  const request = (topic = bankTopic, restart = false) => {
    const [subject, grade, domain, standard] = topic.split("::");
    return new Request(
      `http://localhost/api/progress?${new URLSearchParams({ subject, grade, domain, standard, topicId: topic, ...(restart ? { restart: "1" } : {}) })}`,
      { headers },
    );
  };
  return {
    request,
    session,
    read: async (topic = bankTopic, restart = false) => {
      const response = await GET(request(topic, restart));
      return { status: response.status, body: await response.json() };
    },
    answer: async (token: string, value: string, topic = bankTopic) => {
      const response = await answer(
        new Request("http://localhost/api/answer", {
          method: "POST",
          headers,
          body: JSON.stringify({
            topicId: topic,
            assignmentToken: token,
            answer: value,
          }),
        }),
      );
      expect(response.status).toBe(200);
      return response.json();
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(isOllamaConfigured).mockReturnValue(true);
  generate.mockResolvedValue(null);
  withGoldDatabase((db) => {
    for (const [code, text] of [
      ["6.RP.1", "Understand ratios and unit rates."],
      ["6.G.1", "Find the area of triangles."],
    ]) {
      db.prepare(
        `INSERT OR REPLACE INTO gold_curriculum_records
        (record_id, subject, framework, content_json, source_fingerprint, prompt_version, model, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        `atlas-${code}`,
        "Mathematics",
        "fixture",
        JSON.stringify({
          id: `atlas-${code}`,
          subject: "Mathematics",
          gradeOrCourse: "Grade 6",
          domain: "Atlas",
          standardCode: code,
          standardText: text,
        }),
        "fixture",
        "v1",
        "fixture",
        "2026-01-01",
      );
    }
  });
});

afterEach(() => vi.restoreAllMocks());

test("atlas handoff preserves an answer accepted while generation is pending", async () => {
  const pending = deferred<SkillAtlas | null>();
  generate.mockReturnValue(pending.promise);
  const user = await learner();
  const first = await user.read();
  const pool = getSessionPoolState(user.request())!.pool;
  const assigned = pool.questions.find(
    (question) => question.id === pool.activeAssignment!.questionId,
  )!;
  expect(
    (
      await user.answer(
        first.body.nextQuestion.assignmentToken,
        assigned.answer,
      )
    ).correct,
  ).toBe(true);
  const next = await user.read();
  expect(next.body.attemptCount).toBe(1);
  expect(getSessionPoolState(user.request())!.pool.generation?.status).toBe(
    "pending",
  );
  pending.resolve(atlas());
  await vi.waitFor(() =>
    expect(getSessionPoolState(user.request())!.pool.generation?.status).toBe(
      "ready",
    ),
  );
  const retained = await user.read();
  expect(retained.body.attemptCount).toBe(1);
  expect(retained.body.correctStreak).toBe(next.body.correctStreak);
  expect(retained.body.nextQuestion).toEqual(next.body.nextQuestion);
  expect(getSessionPoolState(user.request())!.pool.shownIds).toContain(
    assigned.id,
  );
  expect(generate).toHaveBeenCalledTimes(1);
});

test("concurrent initial claims launch one batch and retain the displayed assignment when it lands", async () => {
  const pending = deferred<SkillAtlas | null>();
  generate.mockReturnValue(pending.promise);
  const user = await learner();
  const [first, concurrent] = await Promise.all([user.read(), user.read()]);
  expect(first.status).toBe(200);
  expect(first.body.nextQuestion.assignmentToken).toBe(
    concurrent.body.nextQuestion.assignmentToken,
  );
  expect(generate).toHaveBeenCalledTimes(1);
  pending.resolve(atlas());
  await vi.waitFor(() =>
    expect(getSessionPoolState(user.request())?.pool.batchSize).toBe(8),
  );
  const retained = await user.read();
  expect(retained.body.nextQuestion).toEqual(first.body.nextQuestion);
  expect(retained.body.nextQuestion.answer).toBeUndefined();
});

test("an unbanked skill waits for its one atlas without a separate question call", async () => {
  const pending = deferred<SkillAtlas | null>();
  generate.mockReturnValue(pending.promise);
  const user = await learner();
  const first = await user.read(unbankedTopic);
  expect(first.status).toBe(200);
  expect(first.body).toMatchObject({
    questionPending: true,
    nextQuestion: null,
  });
  expect(ollamaQuestionGenerator).not.toHaveBeenCalled();
  pending.resolve(atlas(unbankedTopic));
  await vi.waitFor(async () => {
    const ready = await user.read(unbankedTopic);
    expect(ready.body.nextQuestion?.question).toContain("a1:");
    expect(ready.body.poolProgress).toMatchObject({
      position: 1,
      total: 7,
      difficulty: 1,
    });
  });
  expect(generate).toHaveBeenCalledTimes(1);
});

test("answers drive persisted sibling, deepen and widen choices without model calls", async () => {
  generate.mockResolvedValue(atlas(unbankedTopic));
  const user = await learner();
  let current = await user.read(unbankedTopic);
  if (!current.body.nextQuestion) current = await user.read(unbankedTopic);
  expect(current.body.nextQuestion?.question).toContain("a1:");
  for (const [value, expected, difficulty] of [
    ["wrong", "a1b:", 1],
    ["2", "a2:", 2],
    ["2", "b2:", 2],
  ] as const) {
    const result = await user.answer(
      current.body.nextQuestion.assignmentToken,
      value,
      unbankedTopic,
    );
    expect(result.points).toBe(
      value === "wrong" ? 0 : current.body.poolProgress.difficulty * 10,
    );
    current = await user.read(unbankedTopic);
    expect(current.body.nextQuestion.question).toContain(expected);
    expect(current.body.poolProgress.difficulty).toBe(difficulty);
  }
  expect(generate).toHaveBeenCalledTimes(1);
  expect(ollamaQuestionGenerator).not.toHaveBeenCalled();
});

test("old A completion cannot replace a new A batch after A to B to A", async () => {
  const oldA = deferred<SkillAtlas | null>();
  const b = deferred<SkillAtlas | null>();
  const newA = deferred<SkillAtlas | null>();
  generate
    .mockReturnValueOnce(oldA.promise)
    .mockReturnValueOnce(b.promise)
    .mockReturnValueOnce(newA.promise);
  const user = await learner();
  await user.read();
  await user.read(unbankedTopic);
  const current = await user.read();
  const before = getSessionPoolState(user.request())?.serialized;
  oldA.resolve(atlas());
  b.resolve(atlas(unbankedTopic));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(getSessionPoolState(user.request())?.serialized).toBe(before);
  newA.resolve(atlas());
  await vi.waitFor(() =>
    expect(getSessionPoolState(user.request())?.pool.batchSize).toBe(8),
  );
  expect((await user.read()).body.nextQuestion.assignmentToken).toBe(
    current.body.nextQuestion.assignmentToken,
  );
});

test("disabled generation never launches an atlas", async () => {
  vi.mocked(isOllamaConfigured).mockReturnValue(false);
  const user = await learner();
  expect((await user.read()).body.nextQuestion).toBeTruthy();
  expect(generate).not.toHaveBeenCalled();
});

test("restart cannot discard an active assignment or duplicate a pending batch", async () => {
  const pending = deferred<SkillAtlas | null>();
  generate.mockReturnValue(pending.promise);
  const user = await learner();
  const first = await user.read();
  expect((await user.read(bankTopic, true)).body.nextQuestion).toEqual(
    first.body.nextQuestion,
  );
  expect(generate).toHaveBeenCalledTimes(1);
  pending.resolve(null);
});

test("expired generation becomes retryable and discards a late completion", async () => {
  const pending = deferred<SkillAtlas | null>();
  generate.mockReturnValue(pending.promise);
  const user = await learner();
  await user.read(unbankedTopic);
  const now = Date.now();
  const clock = vi.spyOn(Date, "now").mockReturnValue(now + 240_001);
  try {
    expect((await user.read(unbankedTopic)).status).toBe(409);
    expect(console.warn).toHaveBeenCalledExactlyOnceWith(
      "Practice atlas generation failed",
      { reason: "expired", standardCode: "6.G.1" },
    );
    const expired = getSessionPoolState(
      user.request(unbankedTopic),
    )?.serialized;
    pending.resolve(atlas(unbankedTopic));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getSessionPoolState(user.request(unbankedTopic))?.serialized).toBe(
      expired,
    );
    expect(generate).toHaveBeenCalledTimes(1);
  } finally {
    clock.mockRestore();
  }
});

test("a reviewed composite topic longer than 100 characters remains answerable", async () => {
  const domain =
    "Reviewed extended domain for proportional reasoning and mathematical relationships";
  const topic = `Mathematics::Grade 6::${domain}::6.RP.1`;
  expect(topic.length).toBeGreaterThan(100);
  withGoldDatabase((db) => {
    db.prepare(
      `INSERT OR REPLACE INTO gold_curriculum_records
      (record_id, subject, framework, content_json, source_fingerprint, prompt_version, model, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "atlas-long-topic",
      "Mathematics",
      "fixture",
      JSON.stringify({
        id: "atlas-long-topic",
        subject: "Mathematics",
        gradeOrCourse: "Grade 6",
        domain,
        standardCode: "6.RP.1",
        standardText: "Understand ratios and unit rates.",
      }),
      "fixture",
      "v1",
      "fixture",
      "2026-01-01",
    );
  });
  vi.mocked(isOllamaConfigured).mockReturnValue(false);
  const user = await learner();
  const current = await user.read(topic);
  expect(current.status).toBe(200);
  const key = getSessionPoolState(user.request(topic))!.pool.questions[0]
    .answer;
  expect(
    (await user.answer(current.body.nextQuestion.assignmentToken, key, topic))
      .correct,
  ).toBe(true);
});

test("failed generation remains unavailable until explicit retry and retry uses one new batch", async () => {
  const failed = deferred<SkillAtlas | null>();
  generate.mockReturnValueOnce(failed.promise);
  const user = await learner();
  expect((await user.read(unbankedTopic)).body.questionPending).toBe(true);
  failed.resolve(null);
  await vi.waitFor(async () =>
    expect((await user.read(unbankedTopic)).status).toBe(409),
  );
  expect(console.warn).toHaveBeenCalledExactlyOnceWith(
    "Practice atlas generation failed",
    { reason: "invalid-batch", standardCode: "6.G.1" },
  );
  expect(generate).toHaveBeenCalledTimes(1);
  generate.mockResolvedValue(atlas(unbankedTopic));
  let retried = await user.read(unbankedTopic, true);
  if (!retried.body.nextQuestion) retried = await user.read(unbankedTopic);
  expect(retried.body.nextQuestion?.question).toContain("a1:");
  expect(generate).toHaveBeenCalledTimes(2);
});

test("provider failure diagnostics exclude provider text and session data", async () => {
  generate.mockRejectedValue(new Error("private-provider-output-sentinel"));
  const user = await learner();
  await vi.waitFor(async () =>
    expect((await user.read(unbankedTopic)).status).toBe(409),
  );
  expect(console.warn).toHaveBeenCalledExactlyOnceWith(
    "Practice atlas generation failed",
    { reason: "provider-error", standardCode: "6.G.1" },
  );
});

test("completed atlas has an honest terminal state and a new round requires explicit restart", async () => {
  generate.mockResolvedValue(atlas(unbankedTopic));
  const user = await learner();
  let current = await user.read(unbankedTopic);
  if (!current.body.nextQuestion) current = await user.read(unbankedTopic);
  const questions = new Set<string>();
  for (let index = 0; index < 7; index++) {
    expect(current.body.nextQuestion).toBeTruthy();
    expect(questions.has(current.body.nextQuestion.question)).toBe(false);
    questions.add(current.body.nextQuestion.question);
    await user.answer(
      current.body.nextQuestion.assignmentToken,
      "2",
      unbankedTopic,
    );
    current = await user.read(unbankedTopic);
  }
  expect(current.body).toMatchObject({
    nextQuestion: null,
    poolExhausted: true,
  });
  expect(generate).toHaveBeenCalledTimes(1);
  let restarted = await user.read(unbankedTopic, true);
  if (!restarted.body.nextQuestion) restarted = await user.read(unbankedTopic);
  expect(restarted.body.nextQuestion?.question).toContain("a1:");
  expect(generate).toHaveBeenCalledTimes(2);
});

test("logout prevents a pending batch from recreating session state", async () => {
  const pending = deferred<SkillAtlas | null>();
  generate.mockReturnValue(pending.promise);
  const user = await learner();
  await user.read();
  logoutSession(user.session.sessionToken);
  pending.resolve(atlas());
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(getSessionPoolState(user.request())).toBeNull();
  expect((await user.read()).status).toBe(401);
});

test("a cross-origin atlas answer cannot consume the assignment", async () => {
  generate.mockResolvedValue(atlas(unbankedTopic));
  const user = await learner();
  let current = await user.read(unbankedTopic);
  if (!current.body.nextQuestion) current = await user.read(unbankedTopic);
  const response = await answer(
    new Request("http://localhost/api/answer", {
      method: "POST",
      headers: {
        cookie: `session=${user.session.sessionToken}`,
        origin: "https://example.invalid",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        topicId: unbankedTopic,
        answer: "2",
        assignmentToken: current.body.nextQuestion.assignmentToken,
      }),
    }),
  );
  expect(response.status).toBe(400);
  expect((await user.read(unbankedTopic)).body.nextQuestion).toEqual(
    current.body.nextQuestion,
  );
});
