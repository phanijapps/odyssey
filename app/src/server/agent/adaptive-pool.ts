import "server-only";
import { questionBank, type QuestionBankEntry } from "./question-bank";
import { validateLearningPayload } from "../validation/payloads";
import { isOllamaConfigured, requestOllamaLearningQuestion } from "./agent";

export type Difficulty = 1 | 2 | 3;

export type PoolQuestion = {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
  readonly acceptableAnswers: readonly string[];
  readonly hint: string;
  readonly diagramSvg: string;
  readonly difficulty: Difficulty;
};

export type QuestionPool = {
  readonly topicId: string;
  readonly questions: PoolQuestion[];
  readonly shownIds: string[];
  readonly currentDifficulty: Difficulty;
  readonly batchPosition: number;
  readonly batchSize: number;
};

const BATCH_SIZE = 6;

/** Sanitizes the SVG with a fallback if validation fails. */
function safeDiagram(raw: string): string {
  try {
    validateLearningPayload({ component: "GeometryDiagram", diagramSvg: raw });
    return raw;
  } catch {
    // Unusable diagram: return empty so clients render no diagram column
    // rather than a placeholder stub.
    return "";
  }
}

/** Maps curriculum-skill keywords (from a standard's text) to bank topics.
 *  A bank question about the wrong skill is worse than no question, so this
 *  only returns keys whose content genuinely matches the standard. */
function bankKeysForStandard(standardText: string): string[] {
  const t = standardText.toLowerCase();
  const keys: string[] = [];
  if (
    /\bslope\b|\blinear\b|proportional relationship|y = mx|coordinate plane/.test(
      t,
    )
  ) {
    keys.push("linear");
  }
  if (/\bratio\b|ratio language|unit rate|unit price|constant speed/.test(t)) {
    keys.push("ratio", "unit-rate");
  }
  if (/percent|discount|tip|percent of a quantity/.test(t)) {
    keys.push("percent");
  }
  if (/\bfraction\b|quotients of fractions|divide.*fractions/.test(t)) {
    keys.push("fractions");
  }
  if (
    /greatest common factor|least common multiple|rational number|ordering/.test(
      t,
    )
  ) {
    keys.push("integers", "fractions");
  }
  if (
    /\bexponent\b|whole-number exponents|scientific notation|power of 10/.test(
      t,
    )
  ) {
    keys.push("exponents");
  }
  if (/square root|cube root|\birrational\b/.test(t)) {
    keys.push("square-roots");
  }
  if (
    /solve.*equation|equations of the form|linear equations|inequalit/.test(t)
  ) {
    keys.push("equations");
  }
  if (
    /evaluate expressions|equivalent expressions|properties of operations/.test(
      t,
    )
  ) {
    keys.push("expressions");
  }
  if (/\bfunction\b|input.*output|f\(x\)/.test(t)) {
    keys.push("functions");
  }
  return keys;
}

/** Maps a bare topic id (no standard selected) to bank topics by domain. */
function bankKeysForTopic(topicId: string): string[] {
  const lower = topicId.toLowerCase();
  if (lower.includes("ratio") || lower.includes("proportional")) {
    return ["ratio", "unit-rate", "percent"];
  }
  if (lower.includes("number system") || lower.includes("fractions")) {
    return ["fractions", "integers"];
  }
  if (
    lower.includes("expressions and equations") ||
    lower.includes("expressions")
  ) {
    return ["expressions", "equations", "exponents"];
  }
  if (lower.includes("functions")) {
    return ["functions", "linear"];
  }
  if (
    lower.includes("square") ||
    lower.includes("root") ||
    lower.includes("pythagorean")
  ) {
    return ["square-roots"];
  }
  return [];
}

/** Falls back to the question bank only when it genuinely matches the skill. */
function makeBankQuestion(
  topicId: string,
  difficulty: Difficulty,
  existingTexts: Set<string>,
  standardText?: string,
): PoolQuestion | null {
  // Exact topic key first (legacy callers pass a real bank key).
  let bank: readonly QuestionBankEntry[] | undefined = questionBank[topicId];
  // When a specific standard is selected, match by its text — never by the
  // broader domain (8.EE.6 is slope, not expression evaluation).
  if (!bank && standardText) {
    for (const key of bankKeysForStandard(standardText)) {
      if (questionBank[key]) {
        bank = questionBank[key];
        break;
      }
    }
  }
  if (!bank && !standardText) {
    for (const key of bankKeysForTopic(topicId)) {
      if (questionBank[key]) {
        bank = questionBank[key];
        break;
      }
    }
  }
  // No genuine match: return null so the caller can offer a retry instead of
  // showing a question about a different skill.
  if (!bank || bank.length === 0) return null;
  const candidates = bank.filter((e) => !existingTexts.has(e.question));
  const pool_ = candidates.length > 0 ? candidates : bank;
  // Prefer the entry sharing the most words with the standard text, so a
  // slope standard picks the slope question, not a generic y = kx one.
  let entry = pool_[0];
  if (standardText) {
    const words = new Set(
      standardText
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter((w) => w.length > 3),
    );
    let best = -1;
    for (const candidate of pool_) {
      const q = candidate.question.toLowerCase();
      let score = 0;
      for (const w of words) if (q.includes(w)) score++;
      if (score > best) {
        best = score;
        entry = candidate;
      }
    }
  }
  return {
    id: `bank-${topicId}-${difficulty}-${Date.now()}`,
    question: entry.question,
    answer: entry.expectedAnswer,
    acceptableAnswers: entry.acceptableAnswers ?? [],
    hint: entry.hint,
    diagramSvg: entry.diagramSvg,
    difficulty,
  };
}

/** Generates a single AI question (one retry on transient failure), then a
 *  genuinely-matching bank fallback. Returns null when neither can serve
 *  this skill — callers surface a retry instead of a mismatched question. */
async function makeQuestion(
  topicId: string,
  difficulty: Difficulty,
  standards:
    | readonly { standardCode: string; standardText: string }[]
    | undefined,
  existingTexts: Set<string>,
): Promise<PoolQuestion | null> {
  const standardText = standards?.[0]?.standardText;
  if (isOllamaConfigured()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const ai = await requestOllamaLearningQuestion({
          topicId,
          level: difficulty * 3,
          standards,
        });
        if (existingTexts.has(ai.question)) continue;
        return {
          id: `ai-${topicId}-${difficulty}-${Date.now()}-${attempt}`,
          question: ai.question,
          answer: ai.answer,
          acceptableAnswers: ai.acceptableAnswers,
          hint: ai.hint,
          diagramSvg: safeDiagram(ai.diagramSvg),
          difficulty,
        };
      } catch {
        // Transient failure (timeout / malformed JSON) — retry once.
      }
    }
  }
  return makeBankQuestion(topicId, difficulty, existingTexts, standardText);
}

/** Generates only the first question (medium) for fast startup.
 *  Remaining questions are generated lazily by generateLazyQuestion. */
export async function generateQuestionPool(
  topicId: string,
  standards?: readonly { standardCode: string; standardText: string }[],
): Promise<PoolQuestion[]> {
  const first = await makeQuestion(topicId, 2, standards, new Set());
  return first ? [first] : [];
}

/** Creates a new adaptive pool with one question ready. */
export async function createQuestionPool(
  topicId: string,
  standards?: readonly { standardCode: string; standardText: string }[],
): Promise<QuestionPool> {
  const questions = await generateQuestionPool(topicId, standards);
  return {
    topicId,
    questions,
    shownIds: [],
    currentDifficulty: 2,
    batchPosition: 0,
    batchSize: BATCH_SIZE,
  };
}

/** Generates a single question on-demand for the next pool position. */
export async function generateLazyQuestion(
  topicId: string,
  difficulty: Difficulty,
  standards?: readonly { standardCode: string; standardText: string }[],
  existingQuestions?: readonly PoolQuestion[],
): Promise<PoolQuestion | null> {
  const existingTexts = new Set(
    (existingQuestions ?? []).map((q) => q.question),
  );
  return makeQuestion(topicId, difficulty, standards, existingTexts);
}

/** Selects the next unseen question from the pool. */
export function selectNextQuestion(pool: QuestionPool): {
  question: PoolQuestion | null;
  pool: QuestionPool;
} {
  const unseen = pool.questions.filter((q) => !pool.shownIds.includes(q.id));
  if (unseen.length === 0) return { question: null, pool };
  let candidates = unseen.filter(
    (q) => q.difficulty === pool.currentDifficulty,
  );
  if (candidates.length === 0) {
    candidates = unseen.filter((q) =>
      pool.currentDifficulty === 3
        ? q.difficulty >= 2
        : pool.currentDifficulty === 1
          ? q.difficulty <= 2
          : true,
    );
  }
  if (candidates.length === 0) candidates = unseen;
  const question = candidates[0];
  return {
    question,
    pool: {
      ...pool,
      shownIds: [...pool.shownIds, question.id],
      batchPosition: pool.batchPosition + 1,
    },
  };
}

/** Adjusts difficulty: wrong → easier, correct → harder. */
export function adjustDifficulty(
  pool: QuestionPool,
  correct: boolean,
): QuestionPool {
  const next = correct
    ? Math.min(3, pool.currentDifficulty + 1)
    : Math.max(1, pool.currentDifficulty - 1);
  return { ...pool, currentDifficulty: next as Difficulty };
}

/** Returns true if the pool has more unseen questions. */
export function hasMoreQuestions(pool: QuestionPool): boolean {
  return pool.questions.some((q) => !pool.shownIds.includes(q.id));
}

/** Summarizes pool progress for the UI. */
export function poolProgress(pool: QuestionPool): {
  position: number;
  total: number;
  difficulty: Difficulty;
} {
  return {
    position: pool.batchPosition,
    total: pool.batchSize,
    difficulty: pool.currentDifficulty,
  };
}
