import { getBrowseTree } from "../../../../server/curriculum/browse";
import { embedCurriculumText } from "../../../../server/curriculum/ollama-embeddings";

type FlatStandard = {
  subject: string;
  grade: string;
  domain: string;
  id: string;
  standardCode: string;
  standardText: string;
  searchText: string;
};

let cachedStandards: FlatStandard[] | null = null;

/** Flattens the browse tree into a searchable list. */
function getFlatStandards(): FlatStandard[] {
  if (cachedStandards) return cachedStandards;
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
  cachedStandards = flat;
  return flat;
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
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const grade = url.searchParams.get("grade") ?? "";
  const semantic = url.searchParams.get("semantic") === "1";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 50);

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

  if (semantic) {
    // Semantic search via Ollama embeddings
    try {
      const queryEmbedding = await embedCurriculumText(query);
      const scored = await Promise.all(
        standards.slice(0, 200).map(async (std) => {
          const stdEmbedding = await embedCurriculumText(
            `${std.standardCode} ${std.standardText}`,
          );
          const dot = queryEmbedding.reduce(
            (sum, a, i) => sum + a * stdEmbedding[i],
            0,
          );
          const normQ = Math.sqrt(
            queryEmbedding.reduce((s, a) => s + a * a, 0),
          );
          const normS = Math.sqrt(stdEmbedding.reduce((s, a) => s + a * a, 0));
          return { std, score: dot / (normQ * normS) };
        }),
      );
      const results = scored
        .filter((s) => s.score > 0.3)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
      return Response.json({
        results: results.map((r) => ({
          id: r.std.id,
          standardCode: r.std.standardCode,
          standardText: r.std.standardText,
          domain: r.std.domain,
          subject: r.std.subject,
          grade: r.std.grade,
          score: Math.round(r.score * 100) / 100,
        })),
        total: results.length,
        semantic: true,
      });
    } catch {
      // Fall through to text search
    }
  }

  // Text-based search
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
