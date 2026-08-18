import { expect, test } from "vitest";
import { graphSnapshot } from "./knowledge-graph";

type Entity = { id: string; kind: string; name: string };
type Relationship = {
  subject: { id: string };
  predicate: string;
  object: { id: string };
};

function fakeEngine(entities: Entity[], relationships: Relationship[]) {
  return {
    listEntitiesJson: (request: string) => {
      const scope = JSON.parse(request).scope;
      const scoped = scope.workspace === "learning" ? "learning" : "curriculum";
      return JSON.stringify(
        entities.filter((entity) => entity.kind === scoped),
      );
    },
    listRelationshipsJson: (request: string) => {
      const scope = JSON.parse(request).scope;
      const scoped = scope.workspace === "learning" ? "learning" : "curriculum";
      return JSON.stringify(
        relationships.filter((relationship) =>
          relationship.predicate.startsWith(scoped),
        ),
      );
    },
  };
}

test("tags curriculum and learning nodes with bounded names", () => {
  const engine = fakeEngine(
    [
      {
        id: "standard-1",
        kind: "curriculum",
        name: "8.EE.7 " + "x".repeat(200),
      },
      { id: "pattern-1", kind: "learning", name: "practice pattern" },
      { id: "pattern-1", kind: "learning", name: "duplicate id" },
    ],
    [],
  );
  const snapshot = graphSnapshot(() => engine as never);
  const nodes = snapshot.nodes;
  expect(nodes).toHaveLength(2);
  expect(nodes.find((n) => n.id === "standard-1")?.kind).toBe("curriculum");
  expect(nodes.find((n) => n.id === "pattern-1")?.kind).toBe("learning");
  expect(
    nodes.find((n) => n.id === "standard-1")?.name.length,
  ).toBeLessThanOrEqual(96);
});

test("links carry predicates and reference only included nodes", () => {
  const engine = fakeEngine(
    [
      { id: "a", kind: "curriculum", name: "A" },
      { id: "b", kind: "curriculum", name: "B" },
      { id: "c", kind: "learning", name: "C" },
    ],
    [
      {
        subject: { id: "a" },
        predicate: "curriculum-prereq",
        object: { id: "b" },
      },
      {
        subject: { id: "a" },
        predicate: "curriculum-prereq",
        object: { id: "b" },
      },
      {
        subject: { id: "a" },
        predicate: "learning-mastered",
        object: { id: "c" },
      },
      {
        subject: { id: "a" },
        predicate: "curriculum-dangling",
        object: { id: "missing" },
      },
    ],
  );
  const snapshot = graphSnapshot(() => engine as never);
  expect(snapshot.links).toHaveLength(2);
  expect(snapshot.links.map((l) => l.predicate).sort()).toEqual([
    "curriculum-prereq",
    "learning-mastered",
  ]);
});

test("caps the snapshot size", () => {
  const entities: Entity[] = Array.from({ length: 1000 }, (_, i) => ({
    id: `n${i}`,
    kind: "curriculum",
    name: `node ${i}`,
  }));
  const relationships: Relationship[] = Array.from(
    { length: 1000 },
    (_, i) => ({
      subject: { id: `n${i}` },
      predicate: "curriculum-next",
      object: { id: `n${(i + 1) % 1000}` },
    }),
  );
  const snapshot = graphSnapshot(
    () => fakeEngine(entities, relationships) as never,
  );
  expect(snapshot.nodes.length).toBeLessThanOrEqual(800);
  expect(snapshot.links.length).toBeLessThanOrEqual(800);
});

test("links resolve to serialized node ids even past the id cap", () => {
  const long = (prefix: string) => prefix + "-".repeat(200);
  const engine = fakeEngine(
    [
      { id: long("left"), kind: "curriculum", name: "L" },
      { id: long("right"), kind: "curriculum", name: "R" },
    ],
    [
      {
        subject: { id: long("left") },
        predicate: "curriculum-prereq",
        object: { id: long("right") },
      },
    ],
  );
  const snapshot = graphSnapshot(() => engine as never);
  const ids = new Set(snapshot.nodes.map((node) => node.id));
  for (const link of snapshot.links) {
    expect(ids.has(link.source)).toBe(true);
    expect(ids.has(link.target)).toBe(true);
  }
  expect(snapshot.links).toHaveLength(1);
});

test("an unavailable engine yields an honest empty snapshot", () => {
  expect(graphSnapshot(() => null)).toEqual({ nodes: [], links: [] });
});
