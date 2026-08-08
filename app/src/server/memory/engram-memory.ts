/** An approved derived signal that may enter the child profile graph. */
export type LearningProfileSignal = {
  topicId: string;
  acceptedLevel: number;
  correct: boolean;
  progressState: string;
};

/** Selects only allowlisted, derived fields for profile-memory projection. */
export function projectLearningSignal(_input: unknown): LearningProfileSignal {
  throw new Error("STUB: implement profile-signal projection");
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
  throw new Error("STUB: verify local Engram artifact");
}

/** Produces bounded, validated profile context for the agent's data section. */
export function prepareProfileContext(_input: unknown): LearningProfileSignal | null {
  throw new Error("STUB: validate profile context");
}

/** Opens the locally verified, server-only Engram profile-memory boundary. */
export async function openProfileMemory(_input: {
  childId: string;
  artifactAvailable: boolean;
}): Promise<{ scopeId: string; revision: string }> {
  throw new Error("STUB: implement local Engram profile-memory adapter");
}

/** Produces a recoverable application state when profile memory is unavailable. */
export function getProfileMemoryState(_artifactAvailable: boolean): { kind: "ready" | "unavailable" } {
  throw new Error("STUB: implement profile-memory state");
}

/** Rejects profile reads whose requested child differs from the session child. */
export async function retrieveProfileMemory(_input: {
  sessionChildId: string;
  requestedChildId: string;
}): Promise<LearningProfileSignal[]> {
  throw new Error("STUB: implement scoped profile retrieval");
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
  throw new Error("STUB: implement learning vocabulary seed");
}

/** Rejects every runtime request to mutate the reviewed profile vocabulary. */
export function rejectRuntimeVocabularyMutation(_input: unknown): void {
  throw new Error("STUB: reject runtime vocabulary mutation");
}
