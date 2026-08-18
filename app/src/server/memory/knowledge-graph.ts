import "server-only";
import { withGoldDatabase } from "../curriculum/gold-database";
import { loadConfiguredEngramAddon } from "./engram-memory";

/** Knowledge-graph scope for Odyssey curriculum + learning data. */
const SCOPE = {
  tenant: "odyssey",
  subject: "learning",
  workspace: "gold",
};

type KnowledgeEngine = {
  putEntityJson(entityJson: string): string;
  putRelationshipJson(relationshipJson: string): string;
  listEntitiesJson(requestJson: string): string;
  listRelationshipsJson(requestJson: string): string;
  neighborsJson(requestJson: string): string;
};

type BeliefEngine = {
  putBeliefJson(beliefJson: string): string;
  listBeliefsJson(requestJson: string): string;
};

let knowledgeEngine: KnowledgeEngine | null | undefined;
let beliefEngine: BeliefEngine | null | undefined;

/**
 * The knowledge engines open one SQLite file. This is deliberately NOT
 * ENGRAM_DB_PATH: that variable configures the provider transport's
 * directory-rooted store, which cannot be opened as a database file.
 */
export function knowledgeGraphDatabasePath(): string {
  return process.env.ENGRAM_KNOWLEDGE_DB_PATH ?? "odyssey-knowledge-graph.db";
}

/** Loads the verified native Engram knowledge engine (cached). */
function getKnowledgeEngine(): KnowledgeEngine | null {
  if (knowledgeEngine !== undefined) return knowledgeEngine;
  try {
    const addon = loadConfiguredEngramAddon();
    if (!addon?.NativeKnowledgeEngine) {
      knowledgeEngine = null;
      return null;
    }
    knowledgeEngine = new addon.NativeKnowledgeEngine(
      knowledgeGraphDatabasePath(),
    ) as KnowledgeEngine;
  } catch {
    knowledgeEngine = null;
  }
  return knowledgeEngine;
}

/** Loads the verified native Engram belief engine (cached). */
function getBeliefEngine(): BeliefEngine | null {
  if (beliefEngine !== undefined) return beliefEngine;
  try {
    const addon = loadConfiguredEngramAddon();
    if (!addon?.NativeBeliefEngine) {
      beliefEngine = null;
      return null;
    }
    beliefEngine = new addon.NativeBeliefEngine(
      knowledgeGraphDatabasePath(),
    ) as BeliefEngine;
  } catch {
    beliefEngine = null;
  }
  return beliefEngine;
}

function provenance() {
  return {
    source: "odyssey-learning",
    actor: { id: "odyssey-learning", kind: "service" as const },
    observedAt: new Date().toISOString(),
  };
}

/* ============================================================
   Curriculum graph seeding
   ============================================================ */

/** Seeds a standard into the knowledge graph as a concept entity. */
export function putStandardEntity(input: {
  id: string;
  standardCode: string;
  title: string;
  grade: string;
  domain: string;
  subject: string;
}): boolean {
  const engine = getKnowledgeEngine();
  if (!engine) return false;
  try {
    engine.putEntityJson(
      JSON.stringify({
        id: input.id,
        kind: "concept",
        name: `${input.standardCode} ${input.title.slice(0, 80)}`,
        aliases: [input.standardCode, input.domain],
        scope: SCOPE,
        provenance: provenance(),
        createdAt: new Date().toISOString(),
      }),
    );
    return true;
  } catch {
    return false;
  }
}

/** Seeds a prerequisite relationship between two standards. */
export function putPrerequisiteRelationship(input: {
  fromId: string;
  toId: string;
}): boolean {
  const engine = getKnowledgeEngine();
  if (!engine) return false;
  try {
    engine.putRelationshipJson(
      JSON.stringify({
        id: `prereq-${input.fromId}-${input.toId}`,
        subject: { id: input.fromId, kind: "concept" },
        predicate: "prerequisiteOf",
        object: { id: input.toId, kind: "concept" },
        scope: SCOPE,
        provenance: provenance(),
        createdAt: new Date().toISOString(),
      }),
    );
    return true;
  } catch {
    return false;
  }
}

/** Seeds all Grade 6-8 math standards from Gold into the knowledge graph. */
export function seedCurriculumGraph(): {
  entitiesWritten: number;
  relationshipsWritten: number;
} {
  const engine = getKnowledgeEngine();
  if (!engine) return { entitiesWritten: 0, relationshipsWritten: 0 };

  // Load standards from Gold DB
  let records: unknown[] = [];
  try {
    records = withGoldDatabase((database) =>
      (
        database
          .prepare("SELECT content_json FROM gold_curriculum_records")
          .all() as Array<{ content_json: string }>
      ).map((row) => JSON.parse(row.content_json)),
    );
  } catch {
    return { entitiesWritten: 0, relationshipsWritten: 0 };
  }

  let entities = 0;
  let relationships = 0;
  const now = new Date().toISOString();

  for (const record of records as Array<{
    id?: string;
    standardCode?: string;
    standardText?: string;
    gradeOrCourse?: string;
    domain?: string;
    subject?: string;
  }>) {
    if (!record.id || !record.standardCode) continue;
    try {
      engine.putEntityJson(
        JSON.stringify({
          id: record.id,
          kind: "concept",
          name: `${record.standardCode} ${(record.standardText ?? "").slice(0, 80)}`,
          aliases: [record.standardCode, record.domain ?? ""].filter(Boolean),
          scope: SCOPE,
          provenance: provenance(),
          createdAt: now,
        }),
      );
      entities++;
    } catch {
      // Skip on error
    }
  }

  // Build prerequisite chains within each domain (sorted by code)
  const byDomain = new Map<string, Array<{ id: string; code: string }>>();
  for (const record of records as Array<{
    id?: string;
    standardCode?: string;
    domain?: string;
  }>) {
    if (!record.id || !record.standardCode || !record.domain) continue;
    if (!byDomain.has(record.domain)) byDomain.set(record.domain, []);
    byDomain
      .get(record.domain)!
      .push({ id: record.id, code: record.standardCode });
  }

  for (const [, standards] of byDomain) {
    standards.sort((a, b) => a.code.localeCompare(b.code));
    for (let i = 0; i < standards.length - 1; i++) {
      try {
        engine.putRelationshipJson(
          JSON.stringify({
            id: `prereq-${standards[i].id}-${standards[i + 1].id}`,
            subject: { id: standards[i].id, kind: "concept" },
            predicate: "prerequisiteOf",
            object: { id: standards[i + 1].id, kind: "concept" },
            scope: SCOPE,
            provenance: provenance(),
            createdAt: now,
          }),
        );
        relationships++;
      } catch {
        // Skip
      }
    }
  }

  return { entitiesWritten: entities, relationshipsWritten: relationships };
}

/* ============================================================
   Learning-pattern capture
   ============================================================ */

/** Records a learning attempt into the knowledge graph. */
export function recordLearningAttempt(input: {
  childId: string;
  standardId: string;
  standardCode: string;
  correct: boolean;
  difficulty: number;
  topicId: string;
}): boolean {
  const engine = getKnowledgeEngine();
  if (!engine) return false;
  const now = new Date().toISOString();
  const attemptId = `attempt-${input.childId}-${input.standardId}-${now}`;

  try {
    // Entity for the attempt
    engine.putEntityJson(
      JSON.stringify({
        id: attemptId,
        kind: "task",
        name: `${input.correct ? "Correct" : "Incorrect"} attempt on ${input.standardCode}`,
        scope: {
          tenant: "odyssey",
          subject: input.childId,
          workspace: "learning",
        },
        provenance: provenance(),
        createdAt: now,
      }),
    );

    // Relationship: attempt -> evaluatedAgainst -> standard
    engine.putRelationshipJson(
      JSON.stringify({
        id: `eval-${attemptId}`,
        subject: { id: attemptId, kind: "task" },
        predicate: input.correct ? "masteredStep" : "struggledOn",
        object: { id: input.standardId, kind: "concept" },
        scope: {
          tenant: "odyssey",
          subject: input.childId,
          workspace: "learning",
        },
        provenance: provenance(),
        createdAt: now,
      }),
    );

    return true;
  } catch {
    return false;
  }
}

/** Updates a mastery belief for a child on a standard. */
export function putMasteryBelief(input: {
  childId: string;
  standardId: string;
  standardCode: string;
  correctRate: number;
  attempts: number;
}): boolean {
  const engine = getBeliefEngine();
  if (!engine) return false;
  try {
    engine.putBeliefJson(
      JSON.stringify({
        id: `mastery-${input.childId}-${input.standardId}`,
        scope: {
          tenant: "odyssey",
          subject: input.childId,
          workspace: "learning",
        },
        subject: { key: `mastery:${input.childId}:${input.standardId}` },
        content: `Child ${input.childId} has ${Math.round(input.correctRate * 100)}% accuracy on ${input.standardCode} over ${input.attempts} attempts`,
        confidence:
          input.attempts >= 5 ? input.correctRate : input.correctRate * 0.5,
        status: "active",
        createdAt: new Date().toISOString(),
      }),
    );
    return true;
  } catch {
    return false;
  }
}

/** Lists graph stats for diagnostics. */
export function graphStats(): {
  entities: number;
  relationships: number;
  available: boolean;
} {
  const engine = getKnowledgeEngine();
  if (!engine) return { entities: 0, relationships: 0, available: false };
  try {
    const entities = JSON.parse(
      engine.listEntitiesJson(JSON.stringify({ scope: SCOPE })),
    ) as unknown[];
    const relationships = JSON.parse(
      engine.listRelationshipsJson(JSON.stringify({ scope: SCOPE })),
    ) as unknown[];
    return {
      entities: entities.length,
      relationships: relationships.length,
      available: true,
    };
  } catch {
    return { entities: 0, relationships: 0, available: true };
  }
}

/** Returns whether the knowledge graph is available. */
export function isKnowledgeGraphAvailable(): boolean {
  return getKnowledgeEngine() !== null;
}

/** Lists graph content for the dashboard: recent entities + relationships. */
export function listGraphContent(limit = 50): {
  kgEntities: Array<{ id: string; kind: string; name: string }>;
  kgRelationships: Array<{
    subject: string;
    predicate: string;
    object: string;
  }>;
  learningEntities: Array<{ id: string; kind: string; name: string }>;
  learningRelationships: Array<{
    subject: string;
    predicate: string;
    object: string;
  }>;
} {
  const engine = getKnowledgeEngine();
  const empty = {
    kgEntities: [],
    kgRelationships: [],
    learningEntities: [],
    learningRelationships: [],
  };
  if (!engine) return empty;
  const now = new Date().toISOString();
  const childScope = {
    tenant: "odyssey",
    subject: "child-1",
    workspace: "learning",
  };
  try {
    const curriculum = JSON.parse(
      engine.listEntitiesJson(JSON.stringify({ scope: SCOPE })),
    ) as Array<{ id: string; kind: string; name: string }>;
    const curriculumRels = JSON.parse(
      engine.listRelationshipsJson(JSON.stringify({ scope: SCOPE })),
    ) as Array<{
      subject: { id: string };
      predicate: string;
      object: { id: string };
    }>;
    const learning = JSON.parse(
      engine.listEntitiesJson(JSON.stringify({ scope: childScope })),
    ) as Array<{ id: string; kind: string; name: string }>;
    const learningRels = JSON.parse(
      engine.listRelationshipsJson(JSON.stringify({ scope: childScope })),
    ) as Array<{
      subject: { id: string };
      predicate: string;
      object: { id: string };
    }>;
    return {
      kgEntities: curriculum.slice(-limit),
      kgRelationships: curriculumRels.slice(-limit).map((r) => ({
        subject: r.subject.id,
        predicate: r.predicate,
        object: r.object.id,
      })),
      learningEntities: learning.slice(-limit),
      learningRelationships: learningRels.slice(-limit).map((r) => ({
        subject: r.subject.id,
        predicate: r.predicate,
        object: r.object.id,
      })),
    };
  } catch {
    return empty;
  }
}
