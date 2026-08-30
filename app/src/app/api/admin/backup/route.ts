import "server-only";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { requireAdminMutationProof } from "../../../../server/identity/identity";
import { learningDb } from "../../../../server/learning/sqlite-repository";
import { resolveDatabasePath } from "../../../../server/persistence/sqlite";

/** Builds a fresh, timestamped backup filename under data/backups/. */
function backupFilePath(now: Date): string {
  const directory = join(dirname(resolveDatabasePath("learning")), "backups");
  mkdirSync(directory, { recursive: true });
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+$/, "")
    .replace("T", "-");
  return join(directory, `learning-${stamp}.db`);
}

/** Writes a consistent snapshot of the learning database via VACUUM INTO. */
export async function POST(request: Request): Promise<Response> {
  try {
    await requireAdminMutationProof(request);
  } catch {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }
  const target = backupFilePath(new Date());
  // VACUUM INTO itself refuses to overwrite an existing file; the
  // second-scale timestamp makes collisions practically impossible.
  const escaped = target.replace(/'/g, "''");
  try {
    // VACUUM INTO is atomic on its own and cannot run inside a transaction.
    learningDb.exec(`VACUUM INTO '${escaped}'`);
    return Response.json(
      { ok: true, file: target.split("/").pop() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Backup failed" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
