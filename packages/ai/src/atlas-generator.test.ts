import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { completeWithLocalOllama } from "./providers/pi-completion";
import { generateSkillAtlas } from "./atlas-generator";

vi.mock("./providers/pi-completion", () => ({
  completeWithLocalOllama: vi.fn(),
}));

const input = {
  topicId: "ratio",
  standardCode: "6.RP.1",
  standardText: "Understand ratios and unit rates.",
};
const completion = vi.mocked(completeWithLocalOllama);

function rawNode(index: number) {
  return {
    concept: index < 3 ? "unit rates" : "proportions",
    tier: (index % 3) + 1,
    question: `A pack of ${index + 2} pencils costs ${index + 2} dollars. What is the cost per pencil?`,
    answer: "1",
    acceptableAnswers: ["1 dollar"],
    hint: "Divide the cost by the number of pencils.",
    solution: [
      "Find the cost and number of pencils.",
      "Divide the cost by the count to get 1.",
    ],
    diagramSvg: "",
  };
}

beforeEach(() => {
  vi.stubEnv("OLLAMA_INTEGRATION", "1");
  vi.stubEnv("PI_PROVIDER", "ollama");
  vi.stubEnv("PI_MODEL", "test-model");
  completion.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("bounded skill atlas generation", () => {
  it("does not call a completion provider when generation is disabled", async () => {
    vi.stubEnv("OLLAMA_INTEGRATION", "0");
    await expect(generateSkillAtlas(input)).resolves.toBeNull();
    expect(completion).not.toHaveBeenCalled();
  });

  it.each(["null", "[]", "42", '{"nodes":null}', "not json"])(
    "rejects malformed envelope %s without throwing",
    async (payload) => {
      completion.mockResolvedValue(payload);
      await expect(generateSkillAtlas(input)).resolves.toBeNull();
    },
  );

  it("accepts a balanced batch and preserves its exact answer key", async () => {
    const nodes = Array.from({ length: 6 }, (_, index) => rawNode(index));
    nodes[0].answer = "1.000";
    completion.mockResolvedValue(JSON.stringify({ nodes }));
    const atlas = await generateSkillAtlas(input);
    expect(atlas?.nodes).toHaveLength(6);
    expect(atlas?.nodes[0].answer).toBe("1.000");
    expect(new Set(atlas?.nodes.map((node) => node.id)).size).toBe(6);
    expect(completion).toHaveBeenCalledTimes(1);
  });

  it.each([
    null,
    { answer: " " },
    { question: "Too short" },
    { question: "x".repeat(401) },
    { hint: "Short" },
    { solution: ["Only one step"] },
    { solution: ["Valid first step", " "] },
    { acceptableAnswers: [" "] },
    { diagramSvg: "x".repeat(20_001) },
    { answer: "2".repeat(121) },
    { answer: "2".repeat(101) },
    { acceptableAnswers: Array(6).fill("1") },
    { acceptableAnswers: ["x".repeat(121)] },
    { acceptableAnswers: ["x".repeat(101)] },
    { concept: "x".repeat(61) },
    { hint: "x".repeat(201) },
    { solution: ["x".repeat(201), "Divide by the number of pencils."] },
    {
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    },
    { providerInstruction: "untrusted" },
  ])("prunes an invalid node independently: %j", async (invalid) => {
    const nodes = Array.from({ length: 6 }, (_, index) => rawNode(index));
    completion.mockResolvedValue(
      JSON.stringify({
        nodes: [
          ...nodes,
          invalid === null ? null : { ...rawNode(6), ...invalid },
        ],
      }),
    );
    const atlas = await generateSkillAtlas(input);
    expect(atlas?.nodes).toHaveLength(6);
    expect(atlas?.nodes.map((node) => node.question)).toEqual(
      nodes.map((node) => node.question),
    );
  });

  it("rejects over-sized batches and batches missing foundational coverage", async () => {
    completion.mockResolvedValue(
      JSON.stringify({
        nodes: Array.from({ length: 16 }, (_, index) => rawNode(index)),
      }),
    );
    await expect(generateSkillAtlas(input)).resolves.toBeNull();
    completion.mockResolvedValue(
      JSON.stringify({
        nodes: Array.from({ length: 6 }, (_, index) => ({
          ...rawNode(index),
          tier: 3,
        })),
      }),
    );
    await expect(generateSkillAtlas(input)).resolves.toBeNull();
  });

  it("rejects extra envelope fields, oversized JSON and insufficient surviving coverage", async () => {
    const nodes = Array.from({ length: 6 }, (_, index) => rawNode(index));
    for (const payload of [
      JSON.stringify({ nodes, extra: true }),
      " ".repeat(320_001),
      JSON.stringify({
        nodes: nodes.map((node) => ({ ...node, concept: "same concept" })),
      }),
      JSON.stringify({ nodes: nodes.slice(0, 3) }),
      JSON.stringify({ nodes: [...nodes.slice(0, 3), null] }),
    ]) {
      completion.mockResolvedValue(payload);
      await expect(generateSkillAtlas(input)).resolves.toBeNull();
    }
  });

  it("prunes repeated questions while retaining balanced coverage", async () => {
    const nodes = Array.from({ length: 6 }, (_, index) => rawNode(index));
    completion.mockResolvedValue(
      JSON.stringify({ nodes: [...nodes, nodes[0]] }),
    );
    expect((await generateSkillAtlas(input))?.nodes).toHaveLength(6);
  });

  it("bounds completion work and never includes a session topic identifier in the prompt", async () => {
    completion.mockResolvedValue(
      JSON.stringify({
        nodes: Array.from({ length: 6 }, (_, index) => rawNode(index)),
      }),
    );
    await generateSkillAtlas({ ...input, topicId: "private-topic-sentinel" });
    const request = completion.mock.calls[0][0];
    expect(request.timeoutMs).toBe(90_000);
    expect(request.maxTokens).toBe(16_384);
    expect(request.systemPrompt).toContain(input.standardCode);
    expect(request.systemPrompt).toContain(input.standardText);
    expect(request.systemPrompt).toMatch(/double quotes.*SVG attribute/);
    expect(request.systemPrompt).toContain("escaped inside the JSON string");
    expect(JSON.stringify(request)).not.toContain("private-topic-sentinel");
  });
});
