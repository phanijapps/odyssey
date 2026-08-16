import "server-only";
import { randomUUID } from "node:crypto";
import {
  createTemporaryBronzePromotion,
  getTemporaryPromotionView,
} from "../../../../server/curriculum/promotion-store";
import { validateCurriculumUpload } from "../../../../server/curriculum/source-importer";
import { requireAdminMutationProof } from "../../../../server/identity/identity";

export const runtime = "nodejs";

/** Receives one local curriculum source and creates a temporary Bronze workflow. */
export async function POST(request: Request): Promise<Response> {
  try {
    requireAdminMutationProof(request);
  } catch {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string")
      throw new Error("Missing curriculum file");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const upload = validateCurriculumUpload({
      name: file.name,
      type: file.type,
      bytes,
    });
    const id = randomUUID();
    createTemporaryBronzePromotion({ id, upload, bytes });
    return Response.json(getTemporaryPromotionView(id), { status: 201 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to ingest curriculum file",
      },
      { status: 400 },
    );
  }
}
