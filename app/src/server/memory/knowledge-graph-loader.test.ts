import { expect, test, vi } from "vitest";

const loadConfiguredEngramAddon = vi.hoisted(() => vi.fn());

vi.mock("./engram-memory", () => ({ loadConfiguredEngramAddon }));

import { searchKnowledgeGraph } from "./knowledge-graph-search";
import { graphStats } from "./knowledge-graph";

class FakeKnowledgeEngine {
  listEntitiesJson(): string {
    return JSON.stringify([
      { id: "fraction-concept", kind: "concept", name: "Fractions" },
    ]);
  }

  listRelationshipsJson(): string {
    return "[]";
  }
}

test("knowledge-graph consumers load the configured addon through the verified boundary", () => {
  loadConfiguredEngramAddon.mockReturnValue({
    NativeKnowledgeEngine: FakeKnowledgeEngine,
  });

  expect(graphStats()).toEqual({
    entities: 1,
    relationships: 0,
    available: true,
  });
  const search = searchKnowledgeGraph({ query: "fractions" });
  expect(search.available).toBe(true);
  expect(search.results).toContainEqual(
    expect.objectContaining({ id: "fraction-concept", scope: "curriculum" }),
  );
  expect(loadConfiguredEngramAddon).toHaveBeenCalledTimes(2);
});
