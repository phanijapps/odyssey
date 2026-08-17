import "server-only";

const MAX_FACT_LENGTH = 240;
const MAX_SOURCE_FIELD_LENGTH = 160;
const MAX_SOURCE_URL_LENGTH = 240;

export type ReviewedFunFact = {
  readonly id: "triangle-angle-sum" | "infinite-primes";
  readonly category: "geometry" | "number-theory";
  readonly fact: string;
  readonly source: {
    readonly title: string;
    readonly edition: string;
    readonly locator: string;
    readonly canonicalUrl: string;
    readonly rightsBasis: "public-domain-edition";
  };
  readonly review: {
    readonly status: "approved";
    readonly contentVersion: "v1";
    readonly reviewedAt: "2026-08-17";
    readonly basis: "source-and-statement-verified";
  };
};

/**
 * Small, application-owned facts with an explicit source and approval record.
 * This catalog is deliberately static: no provider or model supplies learner
 * facts at request time.
 */
export const reviewedFunFacts = [
  {
    id: "triangle-angle-sum",
    category: "geometry",
    fact: "In plane geometry, a triangle's three interior angles add up to 180 degrees.",
    source: {
      title: "The Thirteen Books of Euclid's Elements",
      edition: "Thomas L. Heath translation, 1908",
      locator: "Book I, Proposition 32",
      canonicalUrl: "https://www.gutenberg.org/ebooks/21076",
      rightsBasis: "public-domain-edition",
    },
    review: {
      status: "approved",
      contentVersion: "v1",
      reviewedAt: "2026-08-17",
      basis: "source-and-statement-verified",
    },
  },
  {
    id: "infinite-primes",
    category: "number-theory",
    fact: "There are infinitely many prime numbers.",
    source: {
      title: "The Thirteen Books of Euclid's Elements",
      edition: "Thomas L. Heath translation, 1908",
      locator: "Book IX, Proposition 20",
      canonicalUrl: "https://www.gutenberg.org/ebooks/21076",
      rightsBasis: "public-domain-edition",
    },
    review: {
      status: "approved",
      contentVersion: "v1",
      reviewedAt: "2026-08-17",
      basis: "source-and-statement-verified",
    },
  },
] as const satisfies readonly ReviewedFunFact[];

/** Selects a deterministic, reviewed fact without tracking a learner event. */
export function selectReviewedFunFact(
  correctPracticeAttempts: number,
): ReviewedFunFact {
  const index = Math.max(0, correctPracticeAttempts) % reviewedFunFacts.length;
  return reviewedFunFacts[index];
}

/** Verifies that shipped catalog content remains bounded and reviewable. */
export function isReviewedFunFact(value: ReviewedFunFact): boolean {
  try {
    const sourceUrl = new URL(value.source.canonicalUrl);
    return (
      value.review.status === "approved" &&
      value.review.contentVersion === "v1" &&
      value.review.basis === "source-and-statement-verified" &&
      value.fact.length > 0 &&
      value.fact.length <= MAX_FACT_LENGTH &&
      [
        value.source.title,
        value.source.edition,
        value.source.locator,
        value.review.reviewedAt,
      ].every(
        (field) => field.length > 0 && field.length <= MAX_SOURCE_FIELD_LENGTH,
      ) &&
      sourceUrl.protocol === "https:" &&
      value.source.canonicalUrl.length <= MAX_SOURCE_URL_LENGTH &&
      value.source.rightsBasis === "public-domain-edition"
    );
  } catch {
    return false;
  }
}
