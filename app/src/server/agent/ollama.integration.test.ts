import { describe, expect, test } from "vitest";
import { probeOllamaModel } from "./agent";

describe.skipIf(process.env.OLLAMA_INTEGRATION !== "1")(
  "Ollama learning integration",
  () => {
    test("returns the expected structured probe response", async () => {
      await expect(probeOllamaModel()).resolves.toBe(2);
    }, 75_000);
  },
);
