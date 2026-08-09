import "server-only";
import {
  advancePromotion,
  expireTemporaryPromotion,
  getTemporaryPromotionView,
} from "../../../../../../server/curriculum/promotion-store";
import { CurriculumPiAgent } from "../../../../../../server/curriculum/curriculum-pi-agent";
import { generateSilverCandidate } from "../../../../../../server/curriculum/curriculum-promotion-service";

type RouteContext = { params: Promise<{ ingestionId: string }> };

const transitions = {
  "approve-bronze": "approve-bronze",
  "approve-silver": "approve-silver",
  "generate-gold": "ingest-gold",
} as const;

/** Applies an explicit steward action to a temporary curriculum workflow. */
export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { ingestionId } = await context.params;
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
): Promise<keyof typeof transitions | "generate-silver" | "expire"> {
  const body = await request.json();
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== 1 ||
    typeof body.action !== "string" ||
    (!(body.action in transitions) &&
      body.action !== "generate-silver" &&
      body.action !== "expire")
  )
    throw new Error("Invalid curriculum action");
  return body.action as keyof typeof transitions | "generate-silver" | "expire";
}
