export type ValidatedTextResponseInteraction = {
  readonly type: "text-response";
  readonly prompt: string;
  readonly response: { readonly maxLength: number };
};

/** Accepts only the server-issued text response shape used by current Practice. */
export function parseTextResponseInteraction(
  value: unknown,
): ValidatedTextResponseInteraction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const interaction = value as Record<string, unknown>;
  if (
    interaction.type !== "text-response" ||
    typeof interaction.prompt !== "string" ||
    interaction.prompt.length === 0 ||
    interaction.prompt.length > 320 ||
    !interaction.response ||
    typeof interaction.response !== "object" ||
    Array.isArray(interaction.response)
  )
    return null;
  const maxLength = (interaction.response as Record<string, unknown>).maxLength;
  if (
    typeof maxLength !== "number" ||
    !Number.isInteger(maxLength) ||
    maxLength < 1 ||
    maxLength > 100
  )
    return null;
  return {
    type: "text-response",
    prompt: interaction.prompt,
    response: { maxLength },
  };
}
