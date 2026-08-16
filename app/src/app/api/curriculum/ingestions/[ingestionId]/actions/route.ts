import "server-only";
import {
  advancePromotion,
  expireTemporaryPromotion,
  getTemporaryPromotionView,
} from "../../../../../../server/curriculum/promotion-store";
import { CurriculumPiAgent } from "../../../../../../server/curriculum/curriculum-pi-agent";
import {
  generateGoldCandidate,
  generateSilverCandidate,
} from "../../../../../../server/curriculum/curriculum-promotion-service";
import { createLocalGoldSemanticIndex } from "../../../../../../server/curriculum/gold-semantic-index";
import { requireAdminMutationProof } from "../../../../../../server/identity/identity";

type RouteContext = { params: Promise<{ ingestionId: string }> };

const transitions = {
  "approve-bronze": "approve-bronze",
  "approve-silver": "approve-silver",
} as const;

/** Applies an explicit steward action to a temporary curriculum workflow. */
export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { ingestionId } = await context.params;
  try {
    requireAdminMutationProof(request);
  } catch {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }
  try {
    const action = await parseAction(request);
    if (action === "expire") {
      expireTemporaryPromotion(ingestionId);
      return Response.json({ id: ingestionId, stage: "expired" });
    }
    if (action === "generate-silver") {
      await generateSilverCandidate(ingestionId, new CurriculumPiAgent());
      return Response.json(getTemporaryPromotionView(ingestionId));
    }
    if (action === "generate-gold") {
      const { gold, sourceFingerprint } = await generateGoldCandidate(
        ingestionId,
        new CurriculumPiAgent(),
      );
      const result = await createLocalGoldSemanticIndex().persist({
        canonicalRecords: gold.canonicalRecords,
        relations: gold.relations,
        sourceFingerprint,
        promptVersion: gold.provenance.promptVersion,
        model: process.env.PI_MODEL ?? "local-ollama",
      });
      advancePromotion(ingestionId, "ingest-gold");
      expireTemporaryPromotion(ingestionId);
      return Response.json({ id: ingestionId, stage: "gold", ...result });
    }
    const promotion = advancePromotion(ingestionId, transitions[action]);
    return Response.json(
      getTemporaryPromotionView(ingestionId) ?? {
        id: promotion.id,
        stage: promotion.stage,
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid curriculum action";
    const status = /required|unavailable|Unknown curriculum promotion/.test(
      message,
    )
      ? 409
      : 400;
    return Response.json({ error: message }, { status });
  }
}

async function parseAction(
  request: Request,
): Promise<
  keyof typeof transitions | "generate-silver" | "generate-gold" | "expire"
> {
  const body = await request.json();
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== 1 ||
    typeof body.action !== "string" ||
    (!(body.action in transitions) &&
      body.action !== "generate-silver" &&
      body.action !== "generate-gold" &&
      body.action !== "expire")
  )
    throw new Error("Invalid curriculum action");
  return body.action as
    | keyof typeof transitions
    | "generate-silver"
    | "generate-gold"
    | "expire";
}
