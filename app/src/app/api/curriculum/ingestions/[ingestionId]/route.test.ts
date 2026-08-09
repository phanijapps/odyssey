import { expect, test } from "vitest";
import { createTemporaryBronzePromotion } from "../../../../../server/curriculum/promotion-store";
import { GET } from "./route";

test("returns a safe temporary workflow view without source bytes", async () => {
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

  const response = await GET(new Request("http://localhost"), {
    params: Promise.resolve({ ingestionId: "workflow-status" }),
  });

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

test("returns not found after temporary workflow expiry", async () => {
  const response = await GET(new Request("http://localhost"), {
    params: Promise.resolve({ ingestionId: "missing-workflow" }),
  });
  expect(response.status).toBe(404);
});
