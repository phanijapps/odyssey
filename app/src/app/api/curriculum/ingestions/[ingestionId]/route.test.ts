import { expect, test } from "vitest";
import { createTemporaryBronzePromotion } from "../../../../../server/curriculum/promotion-store";
import { authenticateChild } from "../../../../../server/identity/identity";
import { GET } from "./route";

async function adminRequest(path = "http://localhost"): Promise<Request> {
  const session = await authenticateChild({
    username: "test-admin",
    password: "test-admin-password",
  });
  return new Request(path, {
    headers: { cookie: `session=${session.sessionToken}` },
  });
}

const context = (ingestionId: string) => ({
  params: Promise.resolve({ ingestionId }),
});

test("returns a safe temporary workflow view to a steward without source bytes", async () => {
  createTemporaryBronzePromotion({
    id: "workflow-status",
    upload: {
      fileName: "framework.json",
      mimeType: "application/json",
      byteSize: 2,
      format: "json",
      fingerprint: "b".repeat(64),
      warnings: [],
    },
    bytes: new Uint8Array([123, 125]),
  });

  const response = await GET(await adminRequest(), context("workflow-status"));

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({
    id: "workflow-status",
    stage: "bronze",
    bronze: {
      fileName: "framework.json",
      mimeType: "application/json",
      byteSize: 2,
      format: "json",
      fingerprint: "b".repeat(64),
      warnings: [],
    },
  });
});

test("rejects anonymous and learner ingestion reads", async () => {
  expect(
    (await GET(new Request("http://localhost"), context("workflow-status")))
      .status,
  ).toBe(403);
  const learner = await authenticateChild({
    username: "test-learner",
    password: "test-learner-password",
  });
  expect(
    (
      await GET(
        new Request("http://localhost", {
          headers: { cookie: `session=${learner.sessionToken}` },
        }),
        context("workflow-status"),
      )
    ).status,
  ).toBe(403);
});

test("returns not found after temporary workflow expiry to a steward", async () => {
  const response = await GET(await adminRequest(), context("missing-workflow"));
  expect(response.status).toBe(404);
});
