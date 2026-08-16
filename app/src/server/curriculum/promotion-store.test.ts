import { afterEach, expect, test, vi } from "vitest";
import {
  advancePromotion,
  createTemporaryBronzePromotion,
  getTemporaryPromotionView,
  purgeExpiredTemporaryPromotions,
  TEMPORARY_PROMOTION_RETENTION_MS,
} from "./promotion-store";

afterEach(() => vi.useRealTimers());

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

test("purges expired Bronze artifacts during the next workflow request", () => {
  vi.useFakeTimers();
  const now = new Date("2026-01-01T00:00:00.000Z");
  vi.setSystemTime(now);
  createTemporaryBronzePromotion({
    id: "expired-bronze",
    upload: {
      fileName: "framework.csv",
      mimeType: "text/csv",
      byteSize: 12,
      format: "csv",
      fingerprint: "b".repeat(64),
      warnings: [],
    },
    bytes: new TextEncoder().encode("code,text\n"),
  });

  vi.setSystemTime(now.getTime() + TEMPORARY_PROMOTION_RETENTION_MS);
  expect(purgeExpiredTemporaryPromotions()).toBeGreaterThan(0);
  expect(getTemporaryPromotionView("expired-bronze")).toBeUndefined();
});

test("purges temporary workflow artifacts after Gold finalization", () => {
  createTemporaryBronzePromotion({
    id: "finalized-workflow",
    upload: {
      fileName: "framework.csv",
      mimeType: "text/csv",
      byteSize: 12,
      format: "csv",
      fingerprint: "c".repeat(64),
      warnings: [],
    },
    bytes: new TextEncoder().encode("code,text\n"),
  });

  advancePromotion("finalized-workflow", "approve-bronze");
  advancePromotion("finalized-workflow", "ingest-silver");
  advancePromotion("finalized-workflow", "approve-silver");
  expect(advancePromotion("finalized-workflow", "ingest-gold")).toEqual({
    id: "finalized-workflow",
    stage: "gold",
  });
  expect(getTemporaryPromotionView("finalized-workflow")).toBeUndefined();
});
