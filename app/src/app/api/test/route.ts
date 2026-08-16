import { generateLazyQuestion } from "../../../server/agent/adaptive-pool";
import {
  claimAssessmentQuestionPreparation,
  finalizeAssessmentQuestion,
  getAssessmentPreparationInput,
  getAssessmentQuestionForDisplay,
  markAssessmentQuestionUnavailable,
  getActiveAssessmentState,
  getAssessmentResult,
  getAssessmentState,
  startAssessment,
} from "../../../server/learning/assessment";
import {
  resolveSession,
  requireLearnerMutationProof,
} from "../../../server/identity/identity";

function learnerFromRequest(request: Request) {
  const token = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)session=([^;]+)/)?.[1];
  const session = token ? resolveSession(token) : undefined;
  if (!session || session.role !== "student")
    throw new Error("Learner access required");
  return { learnerId: session.childId, role: session.role } as const;
}

/** Returns the retained current assignment, preparing it when needed. */
export async function presentAssessment(
  actor: { learnerId: string; role: "student" },
  assessmentId: string,
) {
  let display = getAssessmentQuestionForDisplay({ actor, assessmentId });
  if (!display) {
    const claim = claimAssessmentQuestionPreparation({ actor, assessmentId });
    if (claim.status === "claimed") {
      try {
        const assignment = getAssessmentPreparationInput({
          actor,
          assessmentId,
          ordinal: claim.ordinal,
          leaseToken: claim.leaseToken,
        });
        const generated = await generateLazyQuestion(
          assignment.standardCode,
          assignment.difficulty,
          [
            {
              standardCode: assignment.standardCode,
              standardText: assignment.standardText,
            },
          ],
        );
        if (!generated) throw new Error("Assessment generation unavailable");
        finalizeAssessmentQuestion({
          actor,
          assessmentId,
          ordinal: claim.ordinal,
          leaseToken: claim.leaseToken,
          question: generated,
        });
      } catch {
        // Keep the same ordinal retryable and expose only its unavailable state.
        markAssessmentQuestionUnavailable({
          actor,
          assessmentId,
          ordinal: claim.ordinal,
          leaseToken: claim.leaseToken,
        });
      }
    }
    display = getAssessmentQuestionForDisplay({ actor, assessmentId });
  }
  const state = getAssessmentState({ actor, assessmentId });
  return {
    assessment: state,
    ...(display ? { question: display } : {}),
    ...(state.status === "completed" || state.status === "partial"
      ? { result: getAssessmentResult({ actor, assessmentId }) }
      : {}),
  };
}

/** Starts or resumes the learner's private mixed-skill assessment. */
export async function POST(request: Request): Promise<Response> {
  try {
    const { childId } = requireLearnerMutationProof(request);
    const body: unknown = await request.json();
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      !("standardIds" in body) ||
      !Array.isArray((body as { standardIds?: unknown }).standardIds) ||
      !(body as { standardIds: unknown[] }).standardIds.every(
        (id) => typeof id === "string",
      )
    )
      throw new Error("Invalid test selection");
    const actor = { learnerId: childId, role: "student" as const };
    const state = startAssessment({
      actor,
      standardIds: (body as { standardIds: string[] }).standardIds,
    });
    return Response.json(await presentAssessment(actor, state.id), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ error: "Unable to start test" }, { status: 400 });
  }
}

/** Reads the learner's existing assessment without formative answer disclosure. */
export async function GET(request: Request): Promise<Response> {
  try {
    const actor = learnerFromRequest(request);
    const assessmentId = new URL(request.url).searchParams.get("id");
    const active = assessmentId
      ? { id: assessmentId }
      : getActiveAssessmentState({ actor });
    if (!active)
      return Response.json(
        { assessment: null },
        { headers: { "Cache-Control": "no-store" } },
      );
    return Response.json(await presentAssessment(actor, active.id), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ error: "Assessment unavailable" }, { status: 404 });
  }
}
