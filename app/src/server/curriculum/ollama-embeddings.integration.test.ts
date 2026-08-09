import { expect, test } from "vitest";
import {
  OLLAMA_EMBEDDING_DIMENSION,
  embedCurriculumText,
} from "./ollama-embeddings";

const integrationTest =
  process.env.OLLAMA_INTEGRATION === "1" ? test : test.skip;

integrationTest("embeds curriculum text through local Ollama", async () => {
  const vector = await embedCurriculumText("Grade 6 ratio reasoning");
  expect(vector).toHaveLength(OLLAMA_EMBEDDING_DIMENSION);
  expect(vector.every(Number.isFinite)).toBe(true);
}, 45_000);
