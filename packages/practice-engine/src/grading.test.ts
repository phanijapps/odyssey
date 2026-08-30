import { describe, expect, it } from "vitest";
import { checkAnswer } from "./grading";

describe("answer grading", () => {
  it("matches exact answers after normalization", () => {
    expect(checkAnswer("  2:1 ", "2:1")).toBe(true);
    expect(checkAnswer("Hello   World", "hello world")).toBe(true);
  });

  it("matches acceptable alternative answers", () => {
    expect(checkAnswer("4 girls", "4", ["4 girls"])).toBe(true);
    expect(checkAnswer("5", "4", ["3 girls"])).toBe(false);
  });

  it("compares numbers tolerantly and ignores reviewed unit suffixes", () => {
    expect(checkAnswer("25 marbles", "25")).toBe(true);
    expect(checkAnswer("3.0", "3")).toBe(true);
    expect(checkAnswer("2.5 mph", "2.5 miles per hour")).toBe(true);
    expect(checkAnswer("24", "25")).toBe(false);
  });

  it("does not treat unit-bearing non-numbers as numeric", () => {
    expect(checkAnswer("four cups", "4")).toBe(false);
  });
});
