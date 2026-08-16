import { expect, test } from "vitest";
import { createTemporaryBronzePromotion } from "../../../../../../server/curriculum/promotion-store";
import { authenticateChild } from "../../../../../../server/identity/identity";
import { POST } from "./route";

function actionRequest(action: string, headers?: HeadersInit): Request {
  return new Request("http://localhost", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ action }),
  });
}

async function adminHeaders(origin = "http://localhost"): Promise<HeadersInit> {
  const session = await authenticateChild({
    username: "test-admin",
    password: "test-admin-password",
  });
  return { cookie: `session=${session.sessionToken}`, origin };
}

const context = (ingestionId: string) => ({
  params: Promise.resolve({ ingestionId }),
});

test("enforces the two steward approval gates through the shared state machine", async () => {
  createTemporaryBronzePromotion({
    id: "workflow-actions",
    upload: {
      fileName: "framework.txt",
      mimeType: "text/plain",
      byteSize: 1,
      format: "text",
      fingerprint: "c".repeat(64),
      warnings: [],
    },
    bytes: new Uint8Array([1]),
  });
  const headers = await adminHeaders();

  const rejected = await POST(
    actionRequest("generate-silver", headers),
    context("workflow-actions"),
  );
  expect(rejected.status).toBe(409);

  await expect(
    POST(actionRequest("approve-bronze", headers), context("workflow-actions")),
  ).resolves.toMatchObject({ status: 200 });
  const earlyGold = await POST(
    actionRequest("generate-gold", headers),
    context("workflow-actions"),
  );
  expect(earlyGold.status).toBe(409);
});

test("rejects anonymous, learner, and cross-origin promotion actions", async () => {
  expect(
    (await POST(actionRequest("approve-bronze"), context("unknown"))).status,
  ).toBe(403);
  const learner = await authenticateChild({
    username: "test-learner",
    password: "test-learner-password",
  });
  expect(
    (
      await POST(
        actionRequest("approve-bronze", {
          cookie: `session=${learner.sessionToken}`,
          origin: "http://localhost",
        }),
        context("unknown"),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await POST(
        actionRequest(
          "approve-bronze",
          await adminHeaders("https://example.invalid"),
        ),
        context("unknown"),
      )
    ).status,
  ).toBe(403);
});

test("preserves unknown promotion action errors for a steward", async () => {
  const response = await POST(
    actionRequest("publish", await adminHeaders()),
    context("unknown"),
  );
  expect(response.status).toBe(400);
});
