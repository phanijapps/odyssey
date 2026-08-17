import "server-only";

import { z } from "zod";

const questionPrompt = z.string().min(1).max(400);

/** The fixed versioned response shapes Odyssey may issue to a learner. */
export const learnerQuestionInteractionSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("text-response"),
      prompt: questionPrompt,
      response: z.object({ maxLength: z.literal(100) }).strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("multiple-choice"),
      prompt: questionPrompt,
      options: z.array(z.string().min(1).max(120)).min(2).max(4),
    })
    .strict(),
  z
    .object({
      type: z.literal("true-false"),
      prompt: questionPrompt,
    })
    .strict(),
]);

export type LearnerQuestionInteraction = z.infer<
  typeof learnerQuestionInteractionSchema
>;

/**
 * Current question sources issue text responses only. The response type is
 * server-chosen and deliberately contains no answer, rubric, score, or token.
 */
export function textResponseInteraction(
  prompt: string,
): LearnerQuestionInteraction {
  return learnerQuestionInteractionSchema.parse({
    type: "text-response",
    prompt,
    response: { maxLength: 100 },
  });
}
