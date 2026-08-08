/** Builds a bounded fixture response through the same adapter shape as Pi Mono. */
export async function requestLearningFixture(
  _input: { childId: string; topicId: string; level: number },
): Promise<{ question: string; diagramSvg: string }> {
  throw new Error("STUB: implement local learning fixture");
}

/** Rejects an agent request that exceeds the configured runtime budget. */
export function assertAgentRequestBudget(_budget: {
  requestCount: number;
  timeoutMs: number;
  retryCount: number;
  maxTokens: number;
  maxCostUsd: number;
}): void {
  throw new Error("STUB: implement agent request budgeting");
}

/** Returns the minimal persisted audit representation of an agent request. */
export function redactAgentAudit(_event: Record<string, unknown>): Record<string, unknown> {
  throw new Error("STUB: implement agent audit redaction");
}
