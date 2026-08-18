import { expect, test } from "vitest";
import { knowledgeGraphDatabasePath } from "./knowledge-graph";

test("prefers the dedicated knowledge database path", () => {
  const original = process.env.ENGRAM_KNOWLEDGE_DB_PATH;
  process.env.ENGRAM_KNOWLEDGE_DB_PATH = "/tmp/knowledge.db";
  try {
    expect(knowledgeGraphDatabasePath()).toBe("/tmp/knowledge.db");
  } finally {
    if (original === undefined) delete process.env.ENGRAM_KNOWLEDGE_DB_PATH;
    else process.env.ENGRAM_KNOWLEDGE_DB_PATH = original;
  }
});

test("never inherits the provider transport's directory store", () => {
  const knowledge = process.env.ENGRAM_KNOWLEDGE_DB_PATH;
  const provider = process.env.ENGRAM_DB_PATH;
  delete process.env.ENGRAM_KNOWLEDGE_DB_PATH;
  process.env.ENGRAM_DB_PATH = "/some/provider/store-dir";
  try {
    expect(knowledgeGraphDatabasePath()).toBe("odyssey-knowledge-graph.db");
  } finally {
    if (knowledge === undefined) delete process.env.ENGRAM_KNOWLEDGE_DB_PATH;
    else process.env.ENGRAM_KNOWLEDGE_DB_PATH = knowledge;
    if (provider === undefined) delete process.env.ENGRAM_DB_PATH;
    else process.env.ENGRAM_DB_PATH = provider;
  }
});
