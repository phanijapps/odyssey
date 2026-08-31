import type { LearnerQuestionInteraction } from "../validators/question-interactions";

/** One node in a skill atlas — a single practice question at a concept/tier
 *  position in the complexity tree. */
export type AtlasNode = {
  readonly id: string;
  readonly concept: string;
  readonly tier: 1 | 2 | 3;
  /** Tree edges: node ids that should be practiced before this one. */
  readonly unlocksAfter?: readonly string[];
  readonly question: string;
  readonly interaction: LearnerQuestionInteraction;
  readonly answer: string;
  readonly acceptableAnswers: readonly string[];
  readonly hint: string;
  readonly solution: readonly string[];
  readonly diagramSvg: string;
};

/** A generated tree of 10-15 practice questions for one standard. */
export type SkillAtlas = {
  readonly topicId: string;
  readonly revision: string;
  readonly nodes: readonly AtlasNode[];
};

export type AtlasWalkState = {
  askedNodeIds: string[];
  currentTier: 1 | 2 | 3;
  lastConcept: string | null;
  /** Alternates between deepen (same concept, next tier) and widen (new concept). */
  widenNext: boolean;
};

/** Initial walk state for a fresh atlas. */
export function initialAtlasWalk(atlas: SkillAtlas): AtlasWalkState {
  void atlas;
  return {
    askedNodeIds: [],
    currentTier: 1,
    lastConcept: null,
    widenNext: false,
  };
}

/**
 * Selects the next atlas node using the growth-walk policy:
 * - correct → deepen (same concept, tier+1) or widen (new concept, same tier),
 *   alternating so practice feels like exploration
 * - wrong → a fresh sibling at the same tier and concept (never a repeat)
 * - exhausted → returns null (caller falls back to bank)
 */
export function walkAtlas(
  atlas: SkillAtlas,
  state: AtlasWalkState,
  lastCorrect: boolean,
): { node: AtlasNode | null; state: AtlasWalkState } {
  const unasked = atlas.nodes.filter((n) => !state.askedNodeIds.includes(n.id));
  if (unasked.length === 0) return { node: null, state };

  const next: AtlasWalkState = { ...state };

  if (lastCorrect) {
    // Alternate between deepen and widen
    if (state.widenNext) {
      const freshConcept = unasked.find(
        (n) => n.concept !== state.lastConcept && n.tier === state.currentTier,
      );
      if (freshConcept) {
        next.askedNodeIds = [...state.askedNodeIds, freshConcept.id];
        next.lastConcept = freshConcept.concept;
        next.widenNext = false;
        return { node: freshConcept, state: next };
      }
    }
    // Deepen: same concept, next tier
    const deeper = unasked.find(
      (n) =>
        n.concept === state.lastConcept &&
        n.tier === (Math.min(3, state.currentTier + 1) as 1 | 2 | 3),
    );
    if (deeper) {
      next.askedNodeIds = [...state.askedNodeIds, deeper.id];
      next.currentTier = deeper.tier;
      next.lastConcept = deeper.concept;
      next.widenNext = true;
      return { node: deeper, state: next };
    }
    // Fallback: any unasked at current or next tier — try deepening next
    const any = unasked.find((n) => n.tier >= state.currentTier) ?? unasked[0];
    next.askedNodeIds = [...state.askedNodeIds, any.id];
    next.currentTier = any.tier;
    next.lastConcept = any.concept;
    next.widenNext = false;
    return { node: any, state: next };
  }

  // Wrong answer → sibling at same tier, same concept (fresh variant)
  const sibling = unasked.find(
    (n) => n.concept === state.lastConcept && n.tier === state.currentTier,
  );
  if (sibling) {
    next.askedNodeIds = [...state.askedNodeIds, sibling.id];
    return { node: sibling, state: next };
  }
  // No sibling: any unasked at current tier (gently), else any unasked
  const fallback =
    unasked.find((n) => n.tier === state.currentTier) ?? unasked[0];
  next.askedNodeIds = [...state.askedNodeIds, fallback.id];
  next.currentTier = fallback.tier;
  next.lastConcept = fallback.concept;
  return { node: fallback, state: next };
}
