import "server-only";
import type { CurriculumRecord } from "../../../../packages/curriculum/src/curriculum-model";
import { loadConfiguredEngramTransport } from "../memory/engram-memory";

export type CurriculumRelation = {
  readonly from: string;
  readonly to: string;
  readonly type: string;
};

/** Projects approved Gold records into the separately scoped Engram curriculum graph. */
export async function writeGoldCurriculumGraph(
  records: readonly CurriculumRecord[],
  relations: readonly CurriculumRelation[],
): Promise<boolean> {
  const transport = loadConfiguredEngramTransport() as {
    write?: (request: unknown) => Promise<unknown>;
  } | null;
  if (!transport?.write) return false;
  try {
    for (const record of records) {
      await transport.write({
        content: {
          format: "json",
          text: JSON.stringify({ record, relations }),
          structured: { record, relations },
          summary: `Approved curriculum record ${record.standardCode}`,
        },
        idempotencyKey: `curriculum:${record.id}`,
        kind: "document",
        policy: { retention: "durable", visibility: "private" },
        provenance: {
          actor: { id: "odyssey-learning", kind: "service" },
          observedAt: new Date().toISOString(),
          source: "odyssey-learning",
        },
        requester: { actor: { id: "odyssey-learning", kind: "service" } },
        scope: { tenant: "odyssey", subject: "curriculum", workspace: "gold" },
      });
    }
    return true;
  } catch {
    return false;
  }
}

/** Returns Gold record identifiers recalled from the curriculum-scoped graph. */
export async function findGoldGraphCandidates(
  query: string,
): Promise<string[]> {
  const transport = loadConfiguredEngramTransport() as {
    recall?: (request: unknown) => Promise<unknown>;
  } | null;
  if (!transport?.recall || !query.trim()) return [];
  try {
    const response = (await transport.recall({
      query,
      requester: { actor: { id: "odyssey-learning", kind: "service" } },
      scope: { tenant: "odyssey", subject: "curriculum", workspace: "gold" },
      limit: 20,
    })) as { items?: unknown };
    if (!Array.isArray(response.items)) return [];
    return response.items.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const content = (item as { content?: unknown }).content;
      if (typeof content !== "string") return [];
      try {
        const record = JSON.parse(content) as { record?: { id?: unknown } };
        return typeof record.record?.id === "string" ? [record.record.id] : [];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}
