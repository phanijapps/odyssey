import { expect, test } from "vitest";
import { acceptNextLevel } from "./progression";

// STUB: AC4

test("STUB: AC4 accepts the current level recommendation", () => {
  expect(acceptNextLevel(2, 2)).toBe(2);
});

test("STUB: AC4 rejects an out-of-range recommendation", () => {
  expect(() => acceptNextLevel(2, 4)).toThrow();
});
