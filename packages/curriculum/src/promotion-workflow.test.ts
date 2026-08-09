import { expect, test } from "vitest";
import {
  approveBronze,
  approveSilver,
  ingestGold,
  ingestSilver,
} from "./promotion-workflow";

test("requires separate steward approvals before Silver and Gold ingestion", () => {
  const bronze = { id: "source-1", stage: "bronze" as const };
  expect(() => ingestSilver(bronze)).toThrow("Bronze approval required");
  const silver = ingestSilver(approveBronze(bronze));
  expect(() => ingestGold(silver)).toThrow("Silver approval required");
  expect(ingestGold(approveSilver(silver))).toEqual({
    id: "source-1",
    stage: "gold",
  });
});
