/** Validates strict learning and rendering payloads before every sink. */
export function validateLearningPayload(_input: unknown): void {
  throw new Error("STUB: implement strict payload validation");
}

/** Produces safe log, client-error, and audit views of an internal event. */
export function serializeSafeDiagnostic(_event: Record<string, unknown>): {
  log: Record<string, unknown>;
  clientError: { message: string };
  audit: Record<string, unknown>;
} {
  throw new Error("STUB: implement diagnostic redaction");
}
