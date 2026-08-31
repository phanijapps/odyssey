import { describe, expect, it } from "vitest";
import {
  initialAtlasWalk,
  walkAtlas,
  type AtlasNode,
  type SkillAtlas,
} from "./atlas-walk";
import { textResponseInteraction } from "../validators/question-interactions";

function node(id: string, concept: string, tier: 1 | 2 | 3): AtlasNode {
  return {
    id,
    concept,
    tier,
    question: `Question ${id} about ${concept} tier ${tier}.`,
    interaction: textResponseInteraction(`Question ${id}`),
    answer: "42",
    acceptableAnswers: [],
    hint: "Think about it.",
    solution: ["Step 1.", "Step 2."],
    diagramSvg: "",
  };
}

const atlas: SkillAtlas = {
  topicId: "Mathematics::Grade 7::Ratios::7.RP.2",
  revision: "atlas-v1",
  nodes: [
    node("a1", "unit rates", 1),
    node("a1b", "unit rates", 1), // sibling at same tier
    node("a2", "unit rates", 2),
    node("a3", "unit rates", 3),
    node("b1", "proportions", 1),
    node("b2", "proportions", 2),
    node("b3", "proportions", 3),
    node("c1", "percent change", 1),
    node("c2", "percent change", 2),
    node("d1", "graphing", 1),
    node("d2", "graphing", 2),
    node("e1", "scaling", 1),
  ],
};

describe("atlas growth walk", () => {
  it("starts at tier 1 and walks deeper on correct answers", () => {
    let state = initialAtlasWalk(atlas);
    expect(state.currentTier).toBe(1);
    expect(state.askedNodeIds).toHaveLength(0);

    // First pick: any tier-1 node
    const r1 = walkAtlas(atlas, state, true);
    expect(r1.node).toBeTruthy();
    expect(r1.node!.tier).toBe(1);
    state = r1.state;

    // Correct → deepen (same concept, tier 2)
    const r2 = walkAtlas(atlas, state, true);
    expect(r2.node!.tier).toBe(2);
    expect(r2.node!.concept).toBe(r1.node!.concept);
    state = r2.state;

    // Correct again → widenNext is true now, so widen (new concept)
    const r3 = walkAtlas(atlas, state, true);
    expect(r3.node!.concept).not.toBe(r2.node!.concept);
    expect(r3.node!.tier).toBe(2);
  });

  it("gives a fresh sibling on wrong answers (same concept, same tier)", () => {
    let state = initialAtlasWalk(atlas);
    // First pick
    const r1 = walkAtlas(atlas, state, true);
    state = r1.state;

    // Wrong → sibling at same concept+tier
    const r2 = walkAtlas(atlas, state, false);
    expect(r2.node!.concept).toBe(r1.node!.concept);
    expect(r2.node!.tier).toBe(r1.node!.tier);
    expect(r2.node!.id).not.toBe(r1.node!.id);
  });

  it("never repeats a asked node", () => {
    let state = initialAtlasWalk(atlas);
    const seen = new Set<string>();
    for (let i = 0; i < atlas.nodes.length; i++) {
      const r = walkAtlas(atlas, state, i % 2 === 0);
      if (!r.node) break;
      expect(seen.has(r.node.id)).toBe(false);
      seen.add(r.node.id);
      state = r.state;
    }
    expect(seen.size).toBe(atlas.nodes.length);
  });

  it("returns null when all nodes are exhausted", () => {
    let state = initialAtlasWalk(atlas);
    // Walk all nodes
    for (let i = 0; i < atlas.nodes.length; i++) {
      const r = walkAtlas(atlas, state, true);
      state = r.state;
    }
    const exhausted = walkAtlas(atlas, state, true);
    expect(exhausted.node).toBeNull();
  });

  it("handles single-concept atlases gracefully", () => {
    const single: SkillAtlas = {
      topicId: "test",
      revision: "v1",
      nodes: [node("x1", "only concept", 1), node("x2", "only concept", 2)],
    };
    let state = initialAtlasWalk(single);
    const r1 = walkAtlas(single, state, true);
    expect(r1.node).toBeTruthy();
    state = r1.state;
    const r2 = walkAtlas(single, state, true);
    expect(r2.node).toBeTruthy();
    state = r2.state;
    expect(walkAtlas(single, state, true).node).toBeNull();
  });
});
