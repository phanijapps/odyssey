import "server-only";
import { requireAdminRead } from "../../../../server/identity/identity";
import { learningDb } from "../../../../server/learning/sqlite-repository";
import { withGoldDatabase } from "../../../../server/curriculum/gold-database";
import { isOllamaConfigured } from "../../../../server/agent/agent";

/** Reports the local service's operational health for the admin console. */
export function GET(request: Request): Response {
  try {
    requireAdminRead(request);
    const schemaVersion = (
      learningDb.prepare("PRAGMA user_version").get() as {
        user_version: number;
      }
    ).user_version;
    const catalogRecords = withGoldDatabase(
      (database) =>
        (
          database
            .prepare("SELECT count(*) AS n FROM gold_curriculum_records")
            .get() as { n: number }
        ).n,
    );
    return Response.json(
      {
        schemaVersion,
        catalogRecords,
        generatorConfigured: isOllamaConfigured(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Admin access required" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
}
