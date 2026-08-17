import "server-only";
import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { isAbsolute, join, relative, sep } from "node:path";
import { getSeedCurriculumCatalog } from "../curriculum/catalog";

const seededVocabulary = new Set<string>();

/** An approved derived signal that may enter the child profile graph. */
export type LearningProfileSignal = {
  topicId: string;
  acceptedLevel: number;
  correct: boolean;
  progressState: string;
};

type AgentProfileContext = LearningProfileSignal & {
  provenanceVersion: "v1";
  vocabularyVersion: "v1";
};

type ConfiguredEngramArtifact = {
  approvedRoot: string;
  sourceRoot: string;
  addonPath: string;
  packagePath: string;
  expectedRevision: string;
  expectedContractSha256: string;
  expectedAddonSha256: string;
  expectedPackageSha256: string;
};

function canonicalPath(candidate: string): string {
  try {
    return realpathSync(candidate);
  } catch {
    return candidate;
  }
}

function assertPathIsConfined(root: string, candidate: string): void {
  const canonicalRoot = canonicalPath(root);
  const canonicalCandidate = canonicalPath(candidate);
  const pathFromRoot = relative(canonicalRoot, canonicalCandidate);
  if (
    !isAbsolute(canonicalRoot) ||
    !isAbsolute(canonicalCandidate) ||
    pathFromRoot === ".." ||
    pathFromRoot.startsWith(`..${sep}`) ||
    isAbsolute(pathFromRoot)
  )
    throw new Error("PATH_ESCAPE");
}

function assertArtifactIsConfined(input: {
  approvedRoot: string;
  sourceRoot: string;
  addonPath: string;
}): void {
  assertPathIsConfined(input.approvedRoot, input.sourceRoot);
  assertPathIsConfined(input.approvedRoot, input.addonPath);
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function runtimePackageSha256(runtimeRoot: string): string {
  const files = readdirSync(runtimeRoot, {
    encoding: "utf8",
    recursive: true,
  }).sort();
  const digest = createHash("sha256");
  for (const file of files) {
    const path = join(runtimeRoot, file);
    const stat = lstatSync(path);
    if (stat.isDirectory()) continue;
    if (!stat.isFile()) throw new Error("Artifact integrity mismatch");
    digest.update(file).update("\0").update(readFileSync(path));
  }
  return digest.digest("hex");
}

function runPreflightGit(sourceRoot: string, args: string[]): string {
  return execFileSync(
    "git",
    ["-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null", ...args],
    {
      cwd: sourceRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_OPTIONAL_LOCKS: "0",
      },
      timeout: 1_000,
    },
  );
}

/** Selects only allowlisted, derived fields for profile-memory projection. */
export function projectLearningSignal(_input: unknown): LearningProfileSignal {
  if (!_input || typeof _input !== "object")
    throw new Error("Invalid profile signal");
  const input = _input as Record<string, unknown>;
  const allowed = ["topicId", "acceptedLevel", "correct", "progressState"];
  const level = input.acceptedLevel;
  if (
    Object.keys(input).some((key) => !allowed.includes(key)) ||
    typeof input.topicId !== "string" ||
    !input.topicId ||
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
  assertArtifactIsConfined(_input);
  return { revision: _input.expectedRevision };
}

/** Verifies the configured source tree and generated files before native loading. */
export function verifyConfiguredEngramArtifact(
  artifact: ConfiguredEngramArtifact,
): { revision: string } {
  assertArtifactIsConfined(artifact);
  assertPathIsConfined(artifact.sourceRoot, artifact.packagePath);
  const sourceRoot = canonicalPath(artifact.sourceRoot);
  const runtimeRoot = join(sourceRoot, "packages", "node", "dist");
  if (
    canonicalPath(artifact.packagePath) !==
    canonicalPath(join(runtimeRoot, "index.js"))
  )
    throw new Error("Artifact integrity mismatch");
  try {
    const sourceState = runPreflightGit(artifact.sourceRoot, [
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
    ]);
    if (sourceState.trim()) throw new Error("Artifact integrity mismatch");
    const observedRevision = runPreflightGit(artifact.sourceRoot, [
      "rev-parse",
      "HEAD",
    ]).trim();
    const observedContractSha256 = sha256(
      join(artifact.sourceRoot, "packages", "node", "dist", "index.d.ts"),
    );
    const observedAddonSha256 = sha256(artifact.addonPath);
    const observedPackageSha256 = runtimePackageSha256(runtimeRoot);
    if (
      observedRevision !== artifact.expectedRevision ||
      observedContractSha256 !== artifact.expectedContractSha256 ||
      observedAddonSha256 !== artifact.expectedAddonSha256 ||
      observedPackageSha256 !== artifact.expectedPackageSha256
    )
      throw new Error("Artifact integrity mismatch");
    return { revision: artifact.expectedRevision };
  } catch (error) {
    if (error instanceof Error && error.message === "PATH_ESCAPE") throw error;
    throw new Error("Artifact integrity mismatch");
  }
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
  packagePath: string;
  expectedRevision: string;
  expectedContractSha256: string;
  expectedAddonSha256: string;
  expectedPackageSha256: string;
} | null {
  const values = {
    approvedRoot: process.env.ENGRAM_APPROVED_ROOT,
    sourceRoot: process.env.ENGRAM_SOURCE_ROOT,
    addonPath: process.env.ENGRAM_ADDON_PATH,
    packagePath: process.env.ENGRAM_NODE_PACKAGE_PATH,
    expectedRevision: process.env.ENGRAM_EXPECTED_REVISION,
    expectedContractSha256: process.env.ENGRAM_EXPECTED_CONTRACT_SHA256,
    expectedAddonSha256: process.env.ENGRAM_EXPECTED_ADDON_SHA256,
    expectedPackageSha256: process.env.ENGRAM_EXPECTED_PACKAGE_SHA256,
  };
  return Object.values(values).every((value) => value?.trim())
    ? (values as ConfiguredEngramArtifact)
    : null;
}

export type EngramNativeAddon = {
  NativeBeliefEngine?: new (dbPath: string) => unknown;
  NativeKnowledgeEngine?: new (dbPath: string) => unknown;
};

type EngramNodePackage = {
  createNativeMemoryTransport?: (options: { dbPath?: string }) => unknown;
  createNativeProviderTransport?: (options: { configJson: string }) => unknown;
};

/** Loads one verified entry point from the configured local Engram artifact. */
function loadConfiguredEngramModule<T>(
  entryPoint: (artifact: ConfiguredEngramArtifact) => string,
): { artifact: ConfiguredEngramArtifact; module: T } | null {
  const artifact = getConfiguredEngramArtifact();
  if (!artifact) return null;
  try {
    verifyConfiguredEngramArtifact(artifact);
    // Turbopack rewrites the bundled createRequire import into a shim that
    // rejects dynamic requires in development; the platform builtin always
    // yields the real CommonJS loader.
    const nodeModule = process.getBuiltinModule("module") as
      | typeof import("node:module")
      | null;
    const requireFrom = nodeModule?.createRequire ?? createRequire;
    const loadModule = requireFrom(import.meta.url) as unknown as (
      moduleId: string,
    ) => T;
    return { artifact, module: loadModule(entryPoint(artifact)) };
  } catch {
    return null;
  }
}

/** Loads the verified native addon shared by knowledge-graph consumers. */
export function loadConfiguredEngramAddon(): EngramNativeAddon | null {
  return (
    loadConfiguredEngramModule<EngramNativeAddon>(
      (artifact) => artifact.addonPath,
    )?.module ?? null
  );
}

/** Loads the optional local transport only on the server after configuration. */
export function loadConfiguredEngramTransport(): unknown | null {
  const loaded = loadConfiguredEngramModule<EngramNodePackage>(
    (artifact) => artifact.packagePath,
  );
  if (!loaded) return null;
  const { artifact, module: nodePackage } = loaded;
  try {
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

/**
 * Writes only a disposable derived learning signal; raw answers never cross this
 * boundary and SQLite remains the rebuild source.
 */
export async function writeLearningSignal(
  childId: string,
  signal: LearningProfileSignal,
): Promise<boolean> {
  const transport = loadConfiguredEngramTransport() as {
    write?: (request: unknown) => Promise<unknown>;
  } | null;
  if (!transport?.write) return false;
  const observedAt = new Date().toISOString();
  const storedSignal = {
    ...signal,
    provenanceVersion: "v1",
    vocabularyVersion: "v1",
  };
  try {
    await transport.write({
      content: {
        format: "json",
        text: JSON.stringify(storedSignal),
        structured: signal,
        summary: "Derived math learning progress signal",
      },
      idempotencyKey: `${childId}:${signal.topicId}:${signal.acceptedLevel}:${signal.correct}`,
      kind: "observation",
      policy: { retention: "ephemeral", visibility: "private" },
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

/** Parses only private, versioned application signals from untrusted recall data. */
export function parseRetrievedProfileMemory(
  payload: unknown,
): AgentProfileContext[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return [];
  const items = (payload as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  const signals: AgentProfileContext[] = [];
  for (const item of items.slice(0, 5)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as {
      content?: unknown;
      policy?: { visibility?: unknown };
      provenance?: { source?: unknown };
    };
    if (
      typeof record.content !== "string" ||
      record.content.length > 1_024 ||
      record.policy?.visibility !== "private" ||
      record.provenance?.source !== "odyssey-learning"
    )
      continue;
    try {
      const signal = prepareProfileContext(JSON.parse(record.content));
      if (signal)
        signals.push({
          ...signal,
          provenanceVersion: "v1",
          vocabularyVersion: "v1",
        });
    } catch {
      continue;
    }
  }
  return signals;
}

/** Retrieves bounded child-scoped context for the next agent decision. */
export async function recallLearningContext(childId: string): Promise<boolean> {
  return (
    (
      await retrieveProfileMemory({
        sessionChildId: childId,
        requestedChildId: childId,
      })
    ).length > 0
  );
}

/** Rejects profile reads whose requested child differs from the session child. */
export async function retrieveProfileMemory(_input: {
  sessionChildId: string;
  requestedChildId: string;
}): Promise<AgentProfileContext[]> {
  if (_input.sessionChildId !== _input.requestedChildId)
    throw new Error("Forbidden");
  const transport = loadConfiguredEngramTransport() as {
    recall?: (request: unknown) => Promise<unknown>;
  } | null;
  if (!transport?.recall) return [];
  try {
    return parseRetrievedProfileMemory(
      await transport.recall({
        query: "math learning progress",
        requester: { actor: { id: "odyssey-learning", kind: "service" } },
        scope: {
          tenant: "odyssey",
          subject: _input.sessionChildId,
          workspace: "learning",
        },
        limit: 5,
      }),
    );
  } catch {
    return [];
  }
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
