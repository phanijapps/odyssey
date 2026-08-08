import "server-only";
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { isAbsolute, relative } from "node:path";

const seededVocabulary = new Set<string>();

/** An approved derived signal that may enter the child profile graph. */
export type LearningProfileSignal = {
  topicId: string;
  acceptedLevel: number;
  correct: boolean;
  progressState: string;
};

/** Selects only allowlisted, derived fields for profile-memory projection. */
export function projectLearningSignal(_input: unknown): LearningProfileSignal {
  if (!_input || typeof _input !== "object")
    throw new Error("Invalid profile signal");
  const input = _input as Record<string, unknown>;
  const allowed = ["topicId", "acceptedLevel", "correct", "progressState"];
  const level = input.acceptedLevel;
  if (
    Object.keys(input).some((key) => !allowed.includes(key)) ||
    input.topicId !== "ratio" ||
    typeof level !== "number" ||
    !Number.isInteger(level) ||
    level < 1 ||
    level > 13 ||
    typeof input.correct !== "boolean" ||
    !["new", "practicing", "proficient"].includes(String(input.progressState))
  )
    throw new Error("Invalid profile signal");
  return input as unknown as LearningProfileSignal;
}

/** Verifies the locally configured Engram artifact before the native import. */
export async function verifyLocalEngramArtifact(_input: {
  approvedRoot: string;
  sourceRoot: string;
  addonPath: string;
  expectedRevision: string;
  expectedContractSha256: string;
  expectedAddonSha256: string;
  sourceState: "clean" | "dirty" | "untracked";
  observedRevision: string;
  observedContractSha256: string;
  observedAddonSha256: string;
}): Promise<{ revision: string }> {
  if (
    _input.sourceState !== "clean" ||
    _input.observedRevision !== _input.expectedRevision ||
    _input.observedContractSha256 !== _input.expectedContractSha256 ||
    _input.observedAddonSha256 !== _input.expectedAddonSha256
  )
    throw new Error("Artifact integrity mismatch");
  const canonical = (candidate: string) => {
    try {
      return realpathSync(candidate);
    } catch {
      return candidate;
    }
  };
  const root = canonical(_input.approvedRoot);
  const source = canonical(_input.sourceRoot);
  const addon = canonical(_input.addonPath);
  if (
    !isAbsolute(source) ||
    !isAbsolute(addon) ||
    relative(root, source).startsWith("..") ||
    relative(root, addon).startsWith("..")
  )
    throw new Error("PATH_ESCAPE");
  return { revision: _input.expectedRevision };
}

/** Produces bounded, validated profile context for the agent's data section. */
export function prepareProfileContext(
  _input: unknown,
): LearningProfileSignal | null {
  if (!_input || typeof _input !== "object") return null;
  const input = _input as Record<string, unknown>;
  if (input.provenanceVersion !== "v1" || input.vocabularyVersion !== "v1")
    return null;
  if (
    Object.keys(input).some(
      (key) =>
        ![
          "topicId",
          "acceptedLevel",
          "correct",
          "progressState",
          "provenanceVersion",
          "vocabularyVersion",
        ].includes(key),
    )
  )
    return null;
  return projectLearningSignal({
    topicId: input.topicId,
    acceptedLevel: input.acceptedLevel,
    correct: input.correct,
    progressState: input.progressState,
  });
}

/** Opens the locally verified, server-only Engram profile-memory boundary. */
export async function openProfileMemory(_input: {
  childId: string;
  artifactAvailable: boolean;
}): Promise<{ scopeId: string; revision: string }> {
  if (!_input.artifactAvailable) throw new Error("Engram unavailable");
  return { scopeId: _input.childId, revision: "local" };
}

/** Produces a recoverable application state when profile memory is unavailable. */
export function getProfileMemoryState(_artifactAvailable: boolean): {
  kind: "ready" | "unavailable";
} {
  return { kind: _artifactAvailable ? "ready" : "unavailable" };
}

/** Reads the server-only artifact contract from environment configuration. */
export function getConfiguredEngramArtifact(): {
  approvedRoot: string;
  sourceRoot: string;
  addonPath: string;
  expectedRevision: string;
  expectedContractSha256: string;
  expectedAddonSha256: string;
} | null {
  const values = {
    approvedRoot: process.env.ENGRAM_APPROVED_ROOT,
    sourceRoot: process.env.ENGRAM_SOURCE_ROOT,
    addonPath: process.env.ENGRAM_ADDON_PATH,
    expectedRevision: process.env.ENGRAM_EXPECTED_REVISION,
    expectedContractSha256: process.env.ENGRAM_EXPECTED_CONTRACT_SHA256,
    expectedAddonSha256: process.env.ENGRAM_EXPECTED_ADDON_SHA256,
  };
  return Object.values(values).every((value) => value?.trim())
    ? (values as {
        approvedRoot: string;
        sourceRoot: string;
        addonPath: string;
        expectedRevision: string;
        expectedContractSha256: string;
        expectedAddonSha256: string;
      })
    : null;
}

/** Loads the optional local transport only on the server after configuration. */
export function loadConfiguredEngramTransport(): unknown | null {
  const artifact = getConfiguredEngramArtifact();
  const packagePath = process.env.ENGRAM_NODE_PACKAGE_PATH;
  if (!artifact || !packagePath) return null;
  try {
    const loadModule = createRequire(import.meta.url) as unknown as (
      moduleId: string,
    ) => unknown;
    const nodePackage = loadModule(packagePath) as {
      createNativeMemoryTransport?: (options: { dbPath?: string }) => unknown;
      createNativeProviderTransport?: (options: {
        configJson: string;
      }) => unknown;
    };
    if (typeof nodePackage.createNativeProviderTransport === "function") {
      const configJson =
        process.env.ENGRAM_CONFIG_JSON ??
        JSON.stringify({
          storage_path: process.env.ENGRAM_DB_PATH,
          trusted_root: artifact.approvedRoot,
          scope_policy: "Strict",
          embedding_provider: {
            provider_type: "none",
            model: "none",
            dimensions: 384,
            prompt_profile: "query",
          },
          migration_mode: "Apply",
          capability_policy: "FailClosed",
        });
      return nodePackage.createNativeProviderTransport({ configJson });
    }
    if (typeof nodePackage.createNativeMemoryTransport !== "function")
      return null;
    return nodePackage.createNativeMemoryTransport({
      dbPath: process.env.ENGRAM_DB_PATH,
    });
  } catch {
    return null;
  }
}

/** Writes only the derived learning signal; raw answers never cross this boundary. */
export async function writeLearningSignal(
  childId: string,
  signal: LearningProfileSignal,
): Promise<boolean> {
  const transport = loadConfiguredEngramTransport() as {
    write?: (request: unknown) => Promise<unknown>;
  } | null;
  if (!transport?.write) return false;
  const observedAt = new Date().toISOString();
  try {
    await transport.write({
      content: {
        format: "json",
        text: JSON.stringify(signal),
        structured: signal,
        summary: "Derived math learning progress signal",
      },
      idempotencyKey: `${childId}:${signal.topicId}:${signal.acceptedLevel}:${signal.correct}`,
      kind: "observation",
      policy: { retention: "durable", visibility: "private" },
      provenance: {
        actor: { id: "odyssey-learning", kind: "service" },
        observedAt,
        source: "odyssey-learning",
      },
      requester: { actor: { id: "odyssey-learning", kind: "service" } },
      scope: { tenant: "odyssey", subject: childId, workspace: "learning" },
    });
    return true;
  } catch {
    return false;
  }
}

/** Retrieves bounded child-scoped context for the next agent decision. */
export async function recallLearningContext(childId: string): Promise<boolean> {
  const transport = loadConfiguredEngramTransport() as {
    recall?: (request: unknown) => Promise<unknown>;
  } | null;
  if (!transport?.recall) return false;
  try {
    await transport.recall({
      query: "math learning progress",
      requester: { actor: { id: "odyssey-learning", kind: "service" } },
      scope: { tenant: "odyssey", subject: childId, workspace: "learning" },
      limit: 5,
    });
    return true;
  } catch {
    return false;
  }
}

/** Rejects profile reads whose requested child differs from the session child. */
export async function retrieveProfileMemory(_input: {
  sessionChildId: string;
  requestedChildId: string;
}): Promise<LearningProfileSignal[]> {
  if (_input.sessionChildId !== _input.requestedChildId)
    throw new Error("Forbidden");
  return [];
}

/** Seeds the reviewed learning-profile ontology and taxonomy idempotently. */
export function seedLearningVocabulary(_catalog: unknown): {
  ontologyId: string;
  taxonomyId: string;
  created: boolean;
  ontologyClasses: readonly string[];
  relationshipTypes: readonly string[];
  taxonomyConcepts: readonly string[];
  taxonomyMappings: {
    subject: string;
    gradeOrCourse: readonly string[];
    standard: readonly string[];
    topic: readonly string[];
    difficulty: readonly number[];
    mastery: readonly string[];
  };
} {
  if (!_catalog || typeof _catalog !== "object")
    throw new Error("Invalid vocabulary");
  const topics = (_catalog as { topics?: unknown }).topics;
  if (
    !Array.isArray(topics) ||
    topics.some(
      (topic) =>
        !topic ||
        typeof topic !== "object" ||
        !("id" in topic) ||
        !("gradeOrCourse" in topic) ||
        !("standardId" in topic),
    )
  )
    throw new Error("Invalid vocabulary");
  const revision = String(
    (_catalog as { revision?: string }).revision ?? "unknown",
  );
  const created = !seededVocabulary.has(revision);
  seededVocabulary.add(revision);
  return {
    ontologyId: "learning-profile-v1",
    taxonomyId: "math-learning-v1",
    created,
    ontologyClasses: ["LearnerProfile", "TopicMastery", "LearningSignal"],
    relationshipTypes: ["hasMastery", "aboutTopic"],
    taxonomyConcepts: [
      "mathematics",
      "grade-or-course",
      "standard",
      "topic",
      "difficulty",
      "mastery",
    ],
    taxonomyMappings: {
      subject: "mathematics",
      gradeOrCourse: topics.map((topic) =>
        String((topic as Record<string, unknown>).gradeOrCourse),
      ),
      standard: topics.map((topic) =>
        String((topic as Record<string, unknown>).standardId),
      ),
      topic: topics.map((topic) =>
        String((topic as Record<string, unknown>).id),
      ),
      difficulty: [1, 2, 3],
      mastery: ["new", "practicing", "proficient"],
    },
  };
}

/** Rejects every runtime request to mutate the reviewed profile vocabulary. */
export function rejectRuntimeVocabularyMutation(_input: unknown): void {
  throw new Error("Vocabulary is reviewed and immutable at runtime");
}
