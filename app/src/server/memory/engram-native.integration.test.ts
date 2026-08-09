import { describe, expect, it } from "vitest";
import {
  getConfiguredEngramArtifact,
  loadConfiguredEngramTransport,
} from "./engram-memory";

const packagePath = process.env.ENGRAM_NODE_PACKAGE_PATH;
const enabled = Boolean(
  packagePath &&
  getConfiguredEngramArtifact() &&
  process.env.ENGRAM_INTEGRATION === "1",
);

describe.skipIf(!enabled)("local Engram native integration", () => {
  it("writes and recalls a child-scoped derived signal", async () => {
    const transport = loadConfiguredEngramTransport() as {
      write: (request: unknown) => Promise<unknown>;
      recall: (request: unknown) => Promise<unknown>;
    } | null;
    expect(transport).not.toBeNull();
    const now = new Date().toISOString();
    await transport!.write({
      content: {
        format: "json",
        text: '{"topicId":"ratio","acceptedLevel":1,"correct":true}',
        structured: { topicId: "ratio", acceptedLevel: 1, correct: true },
      },
      kind: "observation",
      policy: { retention: "durable", visibility: "private" },
      provenance: {
        actor: { id: "odyssey-learning", kind: "service" },
        observedAt: now,
        source: "odyssey-learning",
      },
      requester: { actor: { id: "odyssey-learning", kind: "service" } },
      scope: {
        tenant: "odyssey",
        subject: "child-integration",
        workspace: "learning",
      },
      idempotencyKey: `integration-${Date.now()}`,
    });
    const context = await transport!.recall({
      query: "ratio progress",
      requester: { actor: { id: "odyssey-learning", kind: "service" } },
      scope: {
        tenant: "odyssey",
        subject: "child-integration",
        workspace: "learning",
      },
      limit: 5,
    });
    expect(context).toBeDefined();
  }, 60_000);
});
