# pi-ai SDK Audit + Skill Atlas Integration Plan

**Status:** Draft — accompanies RFC-0009
**Date:** 2026-08-31

## Honest audit: how we use pi-ai today vs. how it's intended

### What we do right

| Practice                   | Where                                      | SDK intent                                                      |
| -------------------------- | ------------------------------------------ | --------------------------------------------------------------- |
| Provider abstraction       | `createProvider` + `openAICompletionsApi`  | ✓ correct — unified interface across any OpenAI-compat endpoint |
| `models.complete()`        | single-shot stateless completion           | ✓ correct for per-question generation                           |
| Structured output          | `response_format: { type: "json_object" }` | ✓ correct — forces JSON-parseable responses                     |
| `contentText()` extraction | type-safe text pull from AssistantMessage  | ✓ correct                                                       |
| `stopReason` guard         | fails on anything but `"stop"`             | ✓ correct — catches truncation, errors                          |
| Timeout + token bounds     | `assertRequestBounds`                      | ✓ correct — matches the SDK's retry/bounds philosophy           |

### What we do wrong (and should fix)

| Issue                               | Evidence                                                                                             | Impact                                                                                                                                                                                                | Fix                                                                                                                                                |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Provider recreated every call**   | `completeWithLocalOllama` calls `models.setProvider(createProvider({...}))` inside the function body | Wasted object creation + model registration on every question; likely re-triggers internal index rebuilds                                                                                             | Hoist to module-level singleton (lazy-init once per process)                                                                                       |
| **`maxRetries: 0`**                 | hardcoded                                                                                            | Transient Ollama blips cause full fallback to bank instead of one SDK-level retry                                                                                                                     | Use the SDK's built-in `RetryPolicy` with `maxRetries: 1, baseDelayMs: 2000`                                                                       |
| **No streaming**                    | `complete()` waits for entire response                                                               | A 10-15 question atlas payload (~4-6KB JSON) blocks for 30-60s; could validate per-question as chunks arrive                                                                                          | Use `stream()` or the event-stream utility for atlas generation (RFC-0009)                                                                         |
| **`cacheRetention: "none"`**        | hardcoded                                                                                            | Prompt caching is disabled even for identical system prompts                                                                                                                                          | Set to `"short"` for repeated skill practice — the system prompt is identical across calls for the same skill                                      |
| **Zod for validation, not typebox** | we use zod everywhere                                                                                | The SDK exports typebox (`Type`, `TSchema`, `StringEnum`) as its native schema language; using it for the atlas schema means the SDK can validate at the completion boundary, not just after the fact | For the atlas batch: define the schema in typebox, let the SDK enforce structure, use zod for application-level validation where it already exists |
| **Manual auth resolution**          | custom `resolve` function just returns `"ollama"`                                                    | Works, but the SDK's credential-store + helpers are designed for this                                                                                                                                 | Simplify to a static API key (local Ollama doesn't need dynamic resolution)                                                                        |

## The system prompt (versioned, structured)

Current prompt is a single string. For Skill Atlas, it becomes a proper
versioned template with few-shot anchoring:

```typescript
// packages/ai/src/prompts/atlas-instruction.ts
export const ATLAS_PROMPT_VERSION = "atlas-v1";

export function getAtlasInstruction(
  standardCode: string,
  standardText: string,
): string {
  return [
    `You are a math curriculum designer creating a practice atlas for one standard.`,
    ``,
    `Standard: ${standardCode} — ${standardText}`,
    ``,
    `Produce a JSON object with a "nodes" array of exactly 12 questions.`,
    `Each node must have these fields:`,
    `- "concept": one of 3-4 concept branches within this standard`,
    `- "tier": 1 (foundational), 2 (proficiency), or 3 (challenge)`,
    `- "question": 20-400 chars, no HTML, original (not from textbooks)`,
    `- "answer": the correct answer as a simple string`,
    `- "acceptableAnswers": array of alternative correct forms`,
    `- "hint": one sentence to help a struggling student`,
    `- "solution": array of 2-5 steps, each under 120 chars`,
    `- "diagramSvg": compact labeled SVG (only svg, rect, circle, ellipse, line, polygon, polyline, text, title, desc)`,
    ``,
    `Structure: 3-4 concept branches × 3-4 questions per branch.`,
    `Tiers within each branch should progress from 1 to 3.`,
    `Every question must be answerable from the given values alone.`,
    `Return JSON only; no prose, no markdown.`,
  ].join("\n");
}
```

## Session/state management

### What "session saving" means here (and what it doesn't)

We do **not** need pi-agent-core sessions, MCP tool registries, or agent
loops. The brief's guardrails are clear: the AI boundary is a single
completion call. What we need is **prompt + response caching**:

| Layer          | Mechanism                   | Lifetime         | Purpose                                                                        |
| -------------- | --------------------------- | ---------------- | ------------------------------------------------------------------------------ |
| Provider       | module-level singleton      | process lifetime | eliminate per-call setup                                                       |
| System prompt  | `cacheRetention: "short"`   | SDK-managed      | identical prompts across calls for same skill get provider-side prefix caching |
| Atlas result   | session pool (existing CAS) | learner session  | 12 questions generated once, served until exhausted                            |
| Atlas template | versioned constant          | git-tracked      | prompt changes are code changes, reviewed + tested                             |

### Why filesystem session saving is the wrong tool here

The user asked about filesystem session saving. For a single-completion
boundary with no multi-turn context, a filesystem session store adds:

- Serialization complexity (JSON → disk → JSON on every request)
- Stale-state risk (what if the model changed between sessions?)
- No benefit — each completion is independent

The **better way** is what we already have: the atlas lives in the
session pool (SQLite via existing CAS machinery), survives page refreshes
within the session, and the session pool is cleaned up by the existing
30-min idle / 8-hour absolute purge. If atlas persistence beyond a
session is wanted later, it goes in the curriculum store as a derived
projection — not as filesystem state.

## Performance optimization plan (for RFC-0009 build)

### 1. Provider singleton (immediate, zero-risk)

```typescript
// Hoisted to module level, initialized lazily on first use
let providerInitialized = false;
function ensureProvider(): void {
  if (providerInitialized) return;
  models.setProvider(createProvider({ ... }));
  providerInitialized = true;
}
```

### 2. SDK-level retry (immediate, zero-risk)

Replace `maxRetries: 0` with `maxRetries: 1` + the SDK's exponential
backoff. One retry catches transient Ollama hiccups without the current
"manually call generator twice in the pool" pattern.

### 3. Structured output via typebox (atlas build)

```typescript
import { Type } from "@earendil-works/pi-ai";

const AtlasNodeSchema = Type.Object({
  concept: Type.String({ minLength: 3, maxLength: 60 }),
  tier: Type.Union([Type.Literal(1), Type.Literal(2), Type.Literal(3)]),
  question: Type.String({ minLength: 20, maxLength: 400 }),
  // ... all fields
});

const AtlasSchema = Type.Object({
  nodes: Type.Array(AtlasNodeSchema, { minItems: 10, maxItems: 15 }),
});
```

The SDK validates at the completion boundary; our zod validators remain
as the application-level defense-in-depth layer.

### 4. Batch generation with streaming validation (atlas build)

For the 12-question atlas call:

```typescript
// packages/ai/src/atlas-generator.ts
const completion = await models.complete(
  model,
  {
    systemPrompt: getAtlasInstruction(standardCode, standardText),
    messages: [{ role: "user", content: "Generate the atlas now." }],
  },
  {
    timeoutMs: 90_000, // longer for batch
    maxTokens: 8_192, // enough for 12 questions with SVGs
    maxRetries: 1, // SDK handles the retry
    temperature: 0.7, // some creativity for question variety
    cacheRetention: "short", // same skill = same prompt prefix = cached
    samplingParams: { response_format: { type: "json_object" } },
  },
);
```

Not streaming (yet) — for a single JSON blob, streaming adds complexity
without clear benefit. Streaming becomes valuable if we later want to
show a progress bar or validate nodes incrementally.

### 5. Temperature strategy

| Call type                 | Temperature | Why                                             |
| ------------------------- | ----------- | ----------------------------------------------- |
| Single question (current) | 0           | deterministic, same skill → same question shape |
| Atlas batch (RFC-0009)    | 0.7         | variety across 12 questions is the point        |
| Future tutor dialogue     | 0.3         | some warmth, mostly grounded                    |

## Implementation order (if approved)

1. **Hoist provider singleton** — one-line fix, immediate perf gain
2. **Enable SDK retry** — one-line fix, removes manual retry duplication in pool
3. **Write atlas prompt + typebox schema** — the new template
4. **Build `generateSkillAtlas()`** — single completion call, typebox-validated
5. **Wire into pool** — replace per-question generator calls with atlas append
6. **Test** — spy asserts zero generator calls from the answer route
