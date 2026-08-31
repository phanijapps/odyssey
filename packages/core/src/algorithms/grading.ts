/**
 * Grading for learner-submitted answers: exact and acceptable-string
 * comparison after normalization, plus tolerant numeric comparison that
 * ignores the reviewed bank's unit suffixes.
 */
export function checkAnswer(
  submitted: string,
  expected: string,
  acceptable?: readonly string[],
): boolean {
  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const submittedNorm = normalize(submitted);
  const expectedNorm = normalize(expected);
  if (submittedNorm === expectedNorm) return true;
  if (acceptable?.some((a) => normalize(a) === submittedNorm)) return true;
  const isPureNumber = (s: string) =>
    /^-?\d+(?:\.\d+)?$/.test(
      s
        .replace(
          /\s*(cups?|pounds?|lbs?|marbles?|girls?|apples?|pages?|degrees?|feet|hours?|minutes?|mph|miles per hour)\s*$/i,
          "",
        )
        .trim(),
    );
  if (isPureNumber(submittedNorm) && isPureNumber(expectedNorm)) {
    const submittedNum = Number.parseFloat(submittedNorm);
    const expectedNum = Number.parseFloat(expectedNorm);
    if (!Number.isNaN(submittedNum) && !Number.isNaN(expectedNum))
      return Math.abs(submittedNum - expectedNum) < 0.01;
  }
  return false;
}
