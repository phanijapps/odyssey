import { getBrowseTree } from "@odyssey/db";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

type FlatStandard = {
  subject: string;
  grade: string;
  domain: string;
  id: string;
  standardCode: string;
  standardText: string;
  searchText: string;
};

/** Flattens the current browse tree into a searchable list. */
function getFlatStandards(): FlatStandard[] {
  const tree = getBrowseTree();
  const flat: FlatStandard[] = [];
  for (const subject of tree.subjects) {
    for (const grade of subject.grades) {
      for (const domain of grade.domains) {
        for (const std of domain.standards) {
          flat.push({
            subject: subject.subject,
            grade: grade.grade,
            domain: domain.domain,
            id: std.id,
            standardCode: std.standardCode,
            standardText: std.standardText,
            searchText:
              `${std.standardCode} ${domain.domain} ${std.standardText}`.toLowerCase(),
          });
        }
      }
    }
  }
  return flat;
}

/** Parses one user-supplied result limit without allowing unbounded retrieval. */
function parseLimit(raw: string | null): number {
  if (raw === null) return DEFAULT_LIMIT;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(parsed, 1), MAX_LIMIT);
}

/** Scores a standard against a query using simple text matching. */
function textScore(std: FlatStandard, query: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  let score = 0;
  // Exact code match is highest priority
  if (std.standardCode.toLowerCase() === q) score += 100;
  if (std.standardCode.toLowerCase().startsWith(q)) score += 50;
  if (std.standardCode.toLowerCase().includes(q)) score += 30;
  // Domain match
  if (std.domain.toLowerCase().includes(q)) score += 15;
  // Text match - count word overlaps
  const qWords = q.split(/\s+/).filter((w) => w.length > 1);
  for (const word of qWords) {
    if (std.searchText.includes(word)) score += 5;
  }
  return score;
}

/** Returns ranked standards matching a query, optionally filtered by grade. */
export function GET(request: Request): Response {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const grade = url.searchParams.get("grade") ?? "";
  const limit = parseLimit(url.searchParams.get("limit"));

  let standards = getFlatStandards();
  if (grade) standards = standards.filter((s) => s.grade === grade);

  if (!query.trim()) {
    return Response.json({
      results: standards.slice(0, limit).map((s) => ({
        id: s.id,
        standardCode: s.standardCode,
        standardText: s.standardText,
        domain: s.domain,
        subject: s.subject,
        grade: s.grade,
      })),
      total: standards.length,
    });
  }

  const scored = standards
    .map((std) => ({ std, score: textScore(std, query) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return Response.json({
    results: scored.map((s) => ({
      id: s.std.id,
      standardCode: s.std.standardCode,
      standardText: s.std.standardText,
      domain: s.std.domain,
      subject: s.std.subject,
      grade: s.std.grade,
      score: s.score,
    })),
    total: scored.length,
  });
}
