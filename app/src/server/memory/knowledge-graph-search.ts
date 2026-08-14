import "server-only";
import { isKnowledgeGraphAvailable } from "./knowledge-graph";

type KnowledgeEngine = {
  listEntitiesJson(requestJson: string): string;
  listRelationshipsJson(requestJson: string): string;
};

/** Lazily loads the knowledge engine through the same loader as knowledge-graph.ts. */
function engine(): KnowledgeEngine | null {
  if (!isKnowledgeGraphAvailable()) return null;
  try {
    // eslint-disable-next-line no-eval
    const req = eval("require") as (id: string) => unknown;
    const addonPath = process.env.ENGRAM_ADDON_PATH;
    if (!addonPath) return null;
    const addon = req(addonPath) as {
      NativeKnowledgeEngine: new (path: string) => KnowledgeEngine;
    };
    return new addon.NativeKnowledgeEngine(
      process.env.ENGRAM_DB_PATH ?? "odyssey-knowledge-graph.db",
    );
  } catch {
    return null;
  }
}

export type KgSearchResult = {
  id: string;
  kind: string;
  name: string;
  predicate?: string;
  targetId?: string;
  targetName?: string;
  scope: string;
  score: number;
};

const CURRICULUM_SCOPE = {
  tenant: "odyssey",
  subject: "learning",
  workspace: "gold",
};

/** Searches entities + relationships by free text across both scopes. */
export function searchKnowledgeGraph(input: {
  query: string;
  childId?: string;
}): {
  results: KgSearchResult[];
  available: boolean;
} {
  const kg = engine();
  if (!kg) return { results: [], available: false };

  const q = input.query.trim().toLowerCase();
  if (!q) return { results: [], available: true };

  const results: KgSearchResult[] = [];
  const scopes = [
    { label: "curriculum", scope: CURRICULUM_SCOPE },
    {
      label: `learning:${input.childId ?? "child-1"}`,
      scope: {
        tenant: "odyssey",
        subject: input.childId ?? "child-1",
        workspace: "learning",
      },
    },
  ];

  for (const { label, scope } of scopes) {
    try {
      // Search entities
      const entities = JSON.parse(
        kg.listEntitiesJson(JSON.stringify({ scope })),
      ) as Array<{
        id: string;
        kind: string;
        name: string;
        aliases?: string[];
      }>;
      for (const e of entities) {
        const haystack =
          `${e.id} ${e.name} ${(e.aliases ?? []).join(" ")}`.toLowerCase();
        let score = 0;
        if (e.id.toLowerCase().includes(q)) score += 10;
        if (e.name.toLowerCase().includes(q)) score += 8;
        if (haystack.includes(q)) score += 5;
        const words = q.split(/\s+/).filter((w) => w.length > 1);
        for (const w of words) {
          if (haystack.includes(w)) score += 2;
        }
        if (score > 0) {
          results.push({
            id: e.id,
            kind: e.kind,
            name: e.name,
            scope: label,
            score,
          });
        }
      }

      // Search relationships
      const rels = JSON.parse(
        kg.listRelationshipsJson(JSON.stringify({ scope })),
      ) as Array<{
        id: string;
        subject: { id: string };
        predicate: string;
        object: { id: string };
      }>;
      for (const r of rels) {
        const haystack =
          `${r.subject.id} ${r.predicate} ${r.object.id}`.toLowerCase();
        let score = 0;
        if (haystack.includes(q)) score += 4;
        const words = q.split(/\s+/).filter((w) => w.length > 1);
        for (const w of words) {
          if (haystack.includes(w)) score += 2;
        }
        if (score > 0) {
          results.push({
            id: r.id,
            kind: "relationship",
            name: `${r.subject.id} → ${r.predicate} → ${r.object.id}`,
            predicate: r.predicate,
            targetId: r.object.id,
            scope: label,
            score,
          });
        }
      }
    } catch {
      // Skip scope on error
    }
  }

  results.sort((a, b) => b.score - a.score);
  return { results: results.slice(0, 100), available: true };
}
