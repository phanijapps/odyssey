import { expect, test } from "vitest";
import {
  createTemporaryBronzePromotion,
  getTemporaryPromotionView,
} from "./promotion-store";

test("keeps Bronze source bytes in the temporary workflow only", () => {
  const workflow = createTemporaryBronzePromotion({
    id: "bronze-source",
    upload: {
      fileName: "framework.csv",
      mimeType: "text/csv",
      byteSize: 12,
      format: "csv",
      fingerprint: "a".repeat(64),
      warnings: [],
    },
    bytes: new TextEncoder().encode("code,text\n"),
  });

  expect(workflow.promotion.stage).toBe("bronze");
  expect(getTemporaryPromotionView("bronze-source")).toEqual({
    id: "bronze-source",
    stage: "bronze",
    bronze: {
      fileName: "framework.csv",
      mimeType: "text/csv",
      byteSize: 12,
      format: "csv",
      fingerprint: "a".repeat(64),
      warnings: [],
    },
  });
});
