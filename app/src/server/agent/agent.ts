/** Builds a bounded fixture response through the same adapter shape as Pi Mono. */
export async function requestLearningFixture(_input: {
  childId: string;
  topicId: string;
  level: number;
}): Promise<{ question: string; diagramSvg: string }> {
  return {
    question: `Solve the ratio problem for ${_input.topicId} at level ${_input.level}.`,
    diagramSvg:
      '<svg aria-label="ratio diagram" viewBox="0 0 100 60"><line x1="10" y1="30" x2="90" y2="30" /></svg>',
  };
}

/** Rejects an agent request that exceeds the configured runtime budget. */
export function assertAgentRequestBudget(_budget: {
  requestCount: number;
  timeoutMs: number;
  retryCount: number;
  maxTokens: number;
  maxCostUsd: number;
}): void {
  if (
    _budget.requestCount > 1 ||
    _budget.retryCount > 1 ||
    _budget.timeoutMs > 15_000 ||
    _budget.maxTokens > 2_048 ||
    _budget.maxCostUsd > 0.02
  ) {
    throw new Error("Agent budget exceeded");
  }
}

/** Encodes validated profile context as delimited data for the model request. */
export function buildAgentProfileData(_profileContext: unknown): {
  content: string;
} {
  if (
    !_profileContext ||
    typeof _profileContext !== "object" ||
    "instruction" in _profileContext
  )
    throw new Error("Invalid profile context");
  const input = _profileContext as Record<string, unknown>;
  const allowed = [
    "topicId",
    "acceptedLevel",
    "correct",
    "progressState",
    "provenanceVersion",
    "vocabularyVersion",
  ];
  if (!allowed.every((key) => key in input))
    throw new Error("Invalid profile context");
  const data = JSON.stringify({
    topicId: input.topicId,
    acceptedLevel: input.acceptedLevel,
    correct: input.correct,
    progressState: input.progressState,
  });
  return { content: `<profile-data>${data}</profile-data>` };
}

/** Returns the minimal persisted audit representation of an agent request. */
export function redactAgentAudit(
  _event: Record<string, unknown>,
): Record<string, unknown> {
  return { event: _event.event ?? "agent-request" };
}
