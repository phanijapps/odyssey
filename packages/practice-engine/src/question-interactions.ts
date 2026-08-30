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

/** Issues a bounded server-owned text response without answer material. */
export function textResponseInteraction(
  prompt: string,
): LearnerQuestionInteraction {
  return learnerQuestionInteractionSchema.parse({
    type: "text-response",
    prompt,
    response: { maxLength: 100 },
  });
}

/** Issues server-selected choices; correctness remains with the assignment. */
export function multipleChoiceInteraction(
  prompt: string,
  options: readonly string[],
): LearnerQuestionInteraction {
  return learnerQuestionInteractionSchema.parse({
    type: "multiple-choice",
    prompt,
    options,
  });
}

/** Issues the fixed boolean choices; correctness remains with the assignment. */
export function trueFalseInteraction(
  prompt: string,
): LearnerQuestionInteraction {
  return learnerQuestionInteractionSchema.parse({ type: "true-false", prompt });
}
