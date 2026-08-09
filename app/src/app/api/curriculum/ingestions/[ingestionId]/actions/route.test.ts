import { expect, test } from "vitest";
import { createTemporaryBronzePromotion } from "../../../../../../server/curriculum/promotion-store";
import { POST } from "./route";

function actionRequest(action: string): Request {
  return new Request("http://localhost", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action }),
  });
}

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
  const context = {
    params: Promise.resolve({ ingestionId: "workflow-actions" }),
  };

  const rejected = await POST(actionRequest("generate-silver"), context);
  expect(rejected.status).toBe(409);

  await expect(
    POST(actionRequest("approve-bronze"), context),
  ).resolves.toMatchObject({
    status: 200,
  });
  const earlyGold = await POST(actionRequest("generate-gold"), context);
  expect(earlyGold.status).toBe(409);
});

test("rejects unknown promotion actions", async () => {
  const response = await POST(actionRequest("publish"), {
    params: Promise.resolve({ ingestionId: "unknown" }),
  });
  expect(response.status).toBe(400);
});
