# RFC-0009: Skill Atlas — one-shot batch generation, tree-of-complexity practice

- **Status:** Draft — awaiting owner approval
- **Date:** 2026-08-31
- **Diagnosis source:** live code audit (below) + engram recall

## The confirmed problem

The generator fires on **every answer**, sometimes twice:

| Trigger             | Call site today                                                                            | Cost                                      |
| ------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------- |
| Skill selected      | `createQuestionPool(…, generator)` → 1 cloud call, pool starts with **exactly 1 question** | 30–60s (masked: served after await)       |
| **Every answer**    | `answer/route.ts:66` → `prefetchNextQuestion(…, generator)`                                | 1 cloud call per answer                   |
| Pool empty at claim | `progress/route.ts:94` → `generateLazyQuestion(…, generator)`                              | 1 more cloud call, **user-visible delay** |

With the cloud model at ~30–60s per call, the prefetch often loses the race
against the kid's next click — so the lazy fill fires and Maya stares at
"Loading…".

## The proposal: Skill Atlas

**One generation call per skill, 10–15 questions at once, structured as a
tree of complexity. Zero agent calls per answer.**

### 1 · The tree (core domain shape)

```ts
// packages/core — pure, persisted as data
type AtlasNode = {
  id: string;
  concept: string; // branch: "unit rates" | "percent of change" …
  tier: 1 | 2 | 3; // complexity tier (maps to today's difficulty)
  unlocksAfter?: string[]; // tree edges — future BKT/prereq graph hooks
  question;
  answer;
  acceptableAnswers;
  hint;
  solution;
  diagramSvg;
  interaction; // all existing validated shapes
};
type SkillAtlas = { topicId; revision; nodes: AtlasNode[] }; // 10–15 nodes
```

One atlas = **3–4 concept branches × 3–4 tiers**, every node validated with
the existing per-question schema plus **cross-node checks** (no duplicate
questions, tier balance, sanitized SVGs — one bad node can be pruned
without discarding the set).

### 2 · The one-shot generation (ai boundary)

- New versioned prompt: "produce a skill atlas for standard X: branches,
  tiers, nodes" — one completion, one JSON payload.
- Single-request budget already enforced (`assertAgentRequestBudget`,
  tokens raised for the batch); retry **once**; any failure → bank, exactly
  like today.
- **`/api/answer` loses its prefetch generator call entirely.** The answer
  route becomes grading + persistence + tree-walk — no AI, no delay, forever.

### 3 · The flow after (delays die)

```text
Maya picks skill
  → pool created from BANK instantly (first 2–3 questions, zero wait)
  → ONE atlas call fires in the background (30–60s, kid is already practicing)
  → atlas lands → validated → nodes appended to the session pool
    (existing CAS machinery: appendSessionPoolQuestion)
  → questions 3..15 serve from the tree — instant, offline-grade speed
  → skill switch or atlas exhausted → at most ONE new call, same pattern
```

### 4 · The growth walk (selection policy in core)

Replace flat difficulty bump with a walk over the tree:

- **Correct at tier N** → unlock a tier N+1 node in the same concept
  (deepen) or a fresh concept at N (widen) — alternates, so practice feels
  like exploration, not a grind.
- **Wrong** → a **sibling node at the same tier** (fresh variant of the
  same concept — never a repeat, never a punishment drop).
- Every node carries `concept` + `unlocksAfter` metadata: **this is the
  drop-in surface for SmartScore/BKT (RFC-0008 Track 3) and tutor mode** —
  the tree becomes the prerequisite graph those features need, which is
  the "make this into anything we want" you asked for.

### 5 · Innovative extras (cheap once the atlas exists)

- **Freshness dial:** each node gets a `variantOf` id; when a concept is
  re-served after N days, a "regenerate this branch" single call can
  refresh just that slice.
- **Misconception tags:** nodes may carry `targetsMisconception` — the
  seed data for the future tutor ("you confused part-with-part and
  part-with-whole ratios").
- **Set replay:** a finished atlas can be re-walked in "review mode"
  (wrong-first ordering) with zero new calls.
- **Offline-first bonus:** once an atlas is cached per topic (phase 2:
  persist to the curriculum store, reviewed-or-session-scoped), practice
  works with the model completely off.

## Scope & acceptance sketch

1. `@odyssey/core`: `SkillAtlas` types + `walkAtlas()` selector (pure,
   unit-tested: deepen/widen/sibling rules).
2. `@odyssey/ai`: batch prompt + `generateSkillAtlas()` (one call, one
   retry, whole-set validation; per-question validators reused).
3. `webapp` routes: background atlas fetch on pool creation; answer route
   drops its generator call; pool append via existing CAS path.
4. Tests: unit (walk rules, atlas validation, pruning), route (atlas
   lands mid-session; claim serves tree nodes; answer route makes **zero**
   generator calls — asserted with a spy), e2e unchanged + green.
5. Bank + test mode: untouched (tests stay bank-only deterministic).

**Deferred (recorded, not built):** atlas persistence beyond the session,
review mode, branch regeneration, misconception tags — each lands later on
the same shape.

## Decision requested

Approve as-is / approve without the extras / adjust the tree shape or
counts (10–15). On approval this becomes a spec + build loop and ships
with the full gate ritual.
