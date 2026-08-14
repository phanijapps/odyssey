import "server-only";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { DatabaseSync } from "node:sqlite";
import {
  approveBronze,
  approveSilver,
  ingestGold,
  ingestSilver,
  type CurriculumPromotion,
} from "../../../../packages/curriculum/src/promotion-workflow";
import type { CurriculumUpload } from "./source-importer";
import type { SilverCandidate, GoldCandidate } from "./curriculum-pi-agent";

const executeFile = promisify(execFile);

type TemporaryCurriculumWorkflow = {
  readonly promotion: CurriculumPromotion;
  readonly bronze?: CurriculumUpload;
  readonly sourceBytes?: Uint8Array;
  readonly silver?: SilverCandidate;
  readonly gold?: GoldCandidate;
};

export type TemporaryPromotionView = {
  readonly id: string;
  readonly stage: CurriculumPromotion["stage"];
  readonly bronze?: CurriculumUpload;
  readonly silver?: SilverCandidate;
  readonly gold?: GoldCandidate;
};

/** Durable SQLite-backed store for curriculum promotion workflows. */
const ingestionDb = new DatabaseSync(
  process.env.ODYSSEY_CURRICULUM_DB_PATH ??
    process.env.ODYSSEY_DB_PATH ??
    "odyssey-curriculum.db",
);

ingestionDb.exec(`
CREATE TABLE IF NOT EXISTS promotion_workflows (
  id TEXT PRIMARY KEY,
  stage TEXT NOT NULL,
  bronze_json TEXT,
  source_bytes BLOB,
  silver_json TEXT,
  gold_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);

/** Holds unapproved Bronze and Silver workflow state, persisted across restarts. */
export function createBronzePromotion(id: string): CurriculumPromotion {
  if (!id) throw new Error("Invalid curriculum promotion");
  const existing = ingestionDb
    .prepare("SELECT id FROM promotion_workflows WHERE id = ?")
    .get(id);
  if (existing) throw new Error("Invalid curriculum promotion");
  const promotion: CurriculumPromotion = { id, stage: "bronze" };
  ingestionDb
    .prepare("INSERT INTO promotion_workflows (id, stage) VALUES (?, ?)")
    .run(id, "bronze");
  return promotion;
}

/** Restores all workflow state from the durable store into memory. */
function loadWorkflow(id: string): TemporaryCurriculumWorkflow | undefined {
  const row = ingestionDb
    .prepare(
      "SELECT stage, bronze_json, source_bytes, silver_json, gold_json FROM promotion_workflows WHERE id = ?",
    )
    .get(id) as
    | {
        stage: string;
        bronze_json: string | null;
        source_bytes: Uint8Array | null;
        silver_json: string | null;
        gold_json: string | null;
      }
    | undefined;
  if (!row) return undefined;
  const promotion = {
    id,
    stage: row.stage as CurriculumPromotion["stage"],
  } as CurriculumPromotion;
  const bronze = row.bronze_json
    ? (JSON.parse(row.bronze_json) as CurriculumUpload)
    : undefined;
  const sourceBytes = row.source_bytes
    ? new Uint8Array(row.source_bytes)
    : undefined;
  const silver = row.silver_json
    ? (JSON.parse(row.silver_json) as SilverCandidate)
    : undefined;
  const gold = row.gold_json
    ? (JSON.parse(row.gold_json) as GoldCandidate)
    : undefined;
  return { promotion, bronze, sourceBytes, silver, gold };
}

/** Persists a workflow's mutable state to the durable store. */
function saveWorkflow(id: string, workflow: TemporaryCurriculumWorkflow): void {
  ingestionDb
    .prepare(
      `UPDATE promotion_workflows
       SET stage = ?, bronze_json = ?, source_bytes = ?, silver_json = ?, gold_json = ?
       WHERE id = ?`,
    )
    .run(
      workflow.promotion.stage,
      workflow.bronze ? JSON.stringify(workflow.bronze) : null,
      workflow.sourceBytes ?? null,
      workflow.silver ? JSON.stringify(workflow.silver) : null,
      workflow.gold ? JSON.stringify(workflow.gold) : null,
      id,
    );
}

/** Creates a local-only Bronze workflow; raw bytes never leave this module. */
export function createTemporaryBronzePromotion(input: {
  readonly id: string;
  readonly upload: CurriculumUpload;
  readonly bytes: Uint8Array;
}): TemporaryCurriculumWorkflow {
  const promotion = createBronzePromotion(input.id);
  const workflow = {
    promotion,
    bronze: input.upload,
    sourceBytes: input.bytes,
  };
  saveWorkflow(input.id, workflow);
  return workflow;
}

/** Returns review metadata without exposing temporary source bytes. */
export function getTemporaryPromotionView(
  id: string,
): TemporaryPromotionView | undefined {
  const workflow = loadWorkflow(id);
  if (!workflow) return undefined;
  return {
    id: workflow.promotion.id,
    stage: workflow.promotion.stage,
    ...(workflow.bronze ? { bronze: workflow.bronze } : {}),
    ...(workflow.silver ? { silver: workflow.silver } : {}),
    ...(workflow.gold ? { gold: workflow.gold } : {}),
  };
}

/** Returns approved Bronze data for the server-only Silver transformation. */
export async function getApprovedBronzeForSilver(id: string): Promise<{
  readonly source: string;
  readonly sourceFingerprint: string;
  readonly format: CurriculumUpload["format"];
}> {
  const workflow = loadWorkflow(id);
  if (
    !workflow?.bronze ||
    !workflow.sourceBytes ||
    workflow.promotion.stage !== "bronze-approved"
  )
    throw new Error("Bronze approval required");
  return {
    source: await extractSourceText(
      workflow.sourceBytes,
      workflow.bronze.format,
    ),
    sourceFingerprint: workflow.bronze.fingerprint,
    format: workflow.bronze.format,
  };
}

/** Saves a schema-validated Silver candidate in the durable workflow. */
export function saveSilverCandidate(id: string, silver: SilverCandidate): void {
  const workflow = loadWorkflow(id);
  if (!workflow || workflow.promotion.stage !== "silver")
    throw new Error("Silver ingestion unavailable");
  const updated = { ...workflow, silver };
  saveWorkflow(id, updated);
}

/** Returns separately approved Silver plus its Bronze provenance for Gold formalization. */
export function getApprovedSilverForGold(id: string): {
  readonly approvedSilver: SilverCandidate;
  readonly framework: string;
  readonly sourceFingerprint: string;
} {
  const workflow = loadWorkflow(id);
  if (
    !workflow?.bronze ||
    !workflow.silver ||
    workflow.promotion.stage !== "silver-approved"
  )
    throw new Error("Silver approval required");
  return {
    approvedSilver: workflow.silver,
    framework: workflow.bronze.fileName,
    sourceFingerprint: workflow.bronze.fingerprint,
  };
}

/** Retains a validated Gold handoff until semantic persistence completes. */
export function saveGoldCandidate(id: string, gold: GoldCandidate): void {
  const workflow = loadWorkflow(id);
  if (!workflow || workflow.promotion.stage !== "silver-approved")
    throw new Error("Gold formalization unavailable");
  const updated = { ...workflow, gold };
  saveWorkflow(id, updated);
}

/** Advances a temporary workflow; Gold callers receive the final handoff record. */
export function advancePromotion(
  id: string,
  action: "approve-bronze" | "ingest-silver" | "approve-silver" | "ingest-gold",
): CurriculumPromotion {
  const workflow = loadWorkflow(id);
  if (!workflow) throw new Error("Unknown curriculum promotion");
  const current = workflow.promotion;
  const next =
    action === "approve-bronze"
      ? approveBronze(current)
      : action === "ingest-silver"
        ? ingestSilver(current)
        : action === "approve-silver"
          ? approveSilver(current)
          : ingestGold(current);
  const updated = { ...workflow, promotion: next };
  saveWorkflow(id, updated);
  return next;
}

/** Discards an unfinished local workflow and all of its temporary artifacts. */
export function expireTemporaryPromotion(id: string): void {
  ingestionDb.prepare("DELETE FROM promotion_workflows WHERE id = ?").run(id);
}

async function extractSourceText(
  bytes: Uint8Array,
  format: CurriculumUpload["format"],
): Promise<string> {
  if (format !== "pdf") return new TextDecoder().decode(bytes);
  const directory = await mkdtemp(join(tmpdir(), "odyssey-curriculum-"));
  const sourcePath = join(directory, "source.pdf");
  const outputPath = join(directory, "source.txt");
  try {
    await writeFile(sourcePath, bytes);
    await executeFile("pdftotext", ["-layout", sourcePath, outputPath], {
      timeout: 15_000,
    });
    const source = await readFile(outputPath, "utf8");
    if (!source.trim()) throw new Error("PDF contains no extractable text");
    return source;
  } catch (error) {
    throw new Error(
      error instanceof Error &&
        error.message === "PDF contains no extractable text"
        ? error.message
        : "Unable to extract PDF text",
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}
