import type { FlatStandard } from "./types";

/** Composes the one canonical Practice topic identity for a reviewed standard. */
export function composeTopicId(skill: FlatStandard): string {
  return `${skill.subject}::${skill.grade}::${skill.domain}::${skill.standardCode}`;
}

/**
 * Resolves a server-issued Practice topic identity to its reviewed standard.
 * Returns null for any stale or malformed identity; it never substitutes a
 * nearest match.
 */
export function findStandardByTopicId(
  standards: readonly FlatStandard[],
  topicId: string,
): FlatStandard | null {
  return (
    standards.find((standard) => composeTopicId(standard) === topicId) ?? null
  );
}
