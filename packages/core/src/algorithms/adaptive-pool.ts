import { questionBank, type QuestionBankEntry } from "./question-bank";
import {
  textResponseInteraction,
  type LearnerQuestionInteraction,
} from "../validators/question-interactions";

export type Difficulty = 1 | 2 | 3;

export type PoolQuestion = {
  readonly id: string;
  readonly question: string;
  /** Server-selected learner input shape; never contains an answer key. */
  readonly interaction: LearnerQuestionInteraction;
  readonly answer: string;
  readonly acceptableAnswers: readonly string[];
  readonly hint: string;
  readonly solution: readonly string[];
  readonly diagramSvg: string;
  readonly difficulty: Difficulty;
};

export type PoolMode = "practice" | "test";

/** A validated generated question exactly as the generation boundary returns it. */
export type GeneratedQuestion = {
  readonly question: string;
  readonly answer: string;
  readonly acceptableAnswers: readonly string[];
  readonly hint: string;
  readonly solution: readonly string[];
  readonly diagramSvg: string;
};

/**
 * The optional generation boundary, injected by the application. A rejected
 * promise falls back to the reviewed bank; the engine never imports a model
 * client itself.
 */
export type QuestionGenerator = (input: {
  topicId: string;
  level: number;
  standards?: readonly { standardCode: string; standardText: string }[];
}) => Promise<GeneratedQuestion>;

export type QuestionPool = {
  readonly topicId: string;
  readonly questions: PoolQuestion[];
  readonly shownIds: string[];
  readonly currentDifficulty: Difficulty;
  readonly batchPosition: number;
  readonly batchSize: number;
  readonly mode?: PoolMode;
  /** Test mode only: the fixed difficulty order, e.g. [1,1,1,2,2,2,3,3,3]. */
  readonly testPlan?: readonly Difficulty[];
};

const BATCH_SIZE = 6;

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

/**
 * Best reviewed bank sample for a standard's text, or null when no bank topic
 * genuinely covers it. Used by the parent Practice preview; the entry's answer
 * material is stripped by that caller.
 */
export function reviewedSampleForStandard(
  standardText: string,
): QuestionBankEntry | null {
  for (const key of bankKeysForStandard(standardText)) {
    const bank = questionBank[key];
    if (!bank || bank.length === 0) continue;
    const words = new Set(
      standardText
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter((word) => word.length > 3),
    );
    let best = bank[0];
    let bestScore = -1;
    for (const entry of bank) {
      const score = entry.question
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter((word) => words.has(word)).length;
      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }
    return best;
  }
  return null;
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
    interaction: entry.interaction ?? textResponseInteraction(entry.question),
    answer: entry.expectedAnswer,
    acceptableAnswers: entry.acceptableAnswers ?? [],
    hint: entry.hint,
    solution: [entry.hint, `The correct answer is ${entry.expectedAnswer}.`],
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
  generator?: QuestionGenerator,
): Promise<PoolQuestion | null> {
  const standardText = standards?.[0]?.standardText;

  // Bank first: instant when the reviewed bank covers this skill.
  const bank = makeBankQuestion(
    topicId,
    difficulty,
    existingTexts,
    standardText,
  );
  if (bank) return bank;

  // Bank doesn't cover this skill — generator as fallback (one question,
  // atlas handles everything after this).
  if (generator) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const ai = await generator({
          topicId,
          level: difficulty * 3,
          standards,
        });
        if (!existingTexts.has(ai.question)) {
          return {
            id: `ai-${topicId}-${difficulty}-${Date.now()}-${attempt}`,
            question: ai.question,
            interaction: textResponseInteraction(ai.question),
            answer: ai.answer,
            acceptableAnswers: ai.acceptableAnswers,
            hint: ai.hint,
            solution: ai.solution,
            diagramSvg: ai.diagramSvg,
            difficulty,
          };
        }
      } catch {
        // Transient failure (timeout / malformed JSON) — retry once.
      }
    }
  }
  return null;
}

/** Pre-generates the next question in the background at the given difficulty
 *  so answering is instant. Fire-and-forget: errors are swallowed. */
export function prefetchNextQuestion(
  topicId: string,
  difficulty: Difficulty,
  standards:
    | readonly { standardCode: string; standardText: string }[]
    | undefined,
  onReady: (q: PoolQuestion) => void,
  generator?: QuestionGenerator,
): void {
  void makeQuestion(topicId, difficulty, standards, new Set(), generator)
    .then((q) => {
      if (q) onReady(q);
    })
    .catch(() => {
      // Background prefetch is best-effort.
    });
}

/** Test plan: three questions per level in ascending order. Each level is
 *  worth 10 / 20 / 30 points, so a test scores out of 180. */
export function buildTestPlan(): Difficulty[] {
  return [1, 1, 1, 2, 2, 2, 3, 3, 3] as Difficulty[];
}

/** Creates a new pool with one question ready. In test mode the first
 *  question is generated at the plan's first difficulty (easy). */
export async function createQuestionPool(
  topicId: string,
  standards?: readonly { standardCode: string; standardText: string }[],
  mode: PoolMode = "practice",
  generator?: QuestionGenerator,
): Promise<QuestionPool> {
  const testPlan = mode === "test" ? buildTestPlan() : undefined;
  const firstDifficulty: Difficulty = mode === "test" ? testPlan![0] : 2;
  const first = await makeQuestion(
    topicId,
    firstDifficulty,
    standards,
    new Set(),
    generator,
  );
  return {
    topicId,
    questions: first ? [first] : [],
    shownIds: [],
    currentDifficulty: firstDifficulty,
    batchPosition: 0,
    batchSize: mode === "test" ? testPlan!.length : BATCH_SIZE,
    mode,
    ...(testPlan ? { testPlan } : {}),
  };
}

/** Generates a single question on-demand for the next pool position. */
export async function generateLazyQuestion(
  topicId: string,
  difficulty: Difficulty,
  standards?: readonly { standardCode: string; standardText: string }[],
  existingQuestions?: readonly PoolQuestion[],
  generator?: QuestionGenerator,
): Promise<PoolQuestion | null> {
  const existingTexts = new Set(
    (existingQuestions ?? []).map((q) => q.question),
  );
  return makeQuestion(topicId, difficulty, standards, existingTexts, generator);
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
