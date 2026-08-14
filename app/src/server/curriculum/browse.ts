import { DatabaseSync } from "node:sqlite";

type BrowseSubject = {
  readonly subject: string;
  readonly grades: readonly BrowseGrade[];
};

type BrowseGrade = {
  readonly grade: string;
  readonly domains: readonly BrowseDomain[];
};

type BrowseDomain = {
  readonly domain: string;
  readonly count: number;
  readonly standards: readonly {
    readonly id: string;
    readonly standardCode: string;
    readonly standardText: string;
  }[];
};

type BrowseNode = {
  readonly subjects: readonly BrowseSubject[];
};

/** Opens the Gold curriculum database. */
function goldDb(): DatabaseSync {
  return new DatabaseSync(
    process.env.ODYSSEY_CURRICULUM_DB_PATH ?? "odyssey-curriculum.db",
  );
}

/** Normalizes subject names to a clean label. */
function normalizeSubject(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("math")) return "Mathematics";
  if (lower.includes("eng") || lower.includes("ela"))
    return "English Language Arts";
  if (lower.includes("science")) return "Science";
  if (lower.includes("social")) return "Social Studies";
  return raw;
}

/** Returns the browseable curriculum tree from Gold records. */
export function getBrowseTree(): BrowseNode {
  const db = goldDb();
  try {
    const rows = db
      .prepare("SELECT content_json FROM gold_curriculum_records")
      .all() as Array<{ content_json: string }>;

    const records = rows.map((r) => JSON.parse(r.content_json));

    // Group by normalized subject → grade → domain
    const tree = new Map<
      string,
      Map<
        string,
        Map<
          string,
          { id: string; standardCode: string; standardText: string }[]
        >
      >
    >();

    for (const r of records) {
      const subject = normalizeSubject(r.subject ?? "unknown");
      const grade = r.gradeOrCourse ?? "unknown";
      const domain = r.domain ?? "General";

      if (!tree.has(subject)) tree.set(subject, new Map());
      const gradeMap = tree.get(subject)!;
      if (!gradeMap.has(grade)) gradeMap.set(grade, new Map());
      const domainMap = gradeMap.get(grade)!;
      if (!domainMap.has(domain)) domainMap.set(domain, []);
      domainMap.get(domain)!.push({
        id: r.id,
        standardCode: r.standardCode ?? "",
        standardText: r.standardText ?? "",
      });
    }

    // Convert to output shape
    const subjects = [...tree.entries()].map(([subject, gradeMap]) => ({
      subject,
      grades: [...gradeMap.entries()]
        .sort(([a], [b]) => gradeSort(a, b))
        .map(([grade, domainMap]) => ({
          grade,
          domains: [...domainMap.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([domain, standards]) => ({
              domain,
              count: standards.length,
              standards: standards.sort((a, b) =>
                a.standardCode.localeCompare(b.standardCode),
              ),
            })),
        })),
    }));

    return { subjects };
  } finally {
    db.close();
  }
}

/** Sorts grade labels in natural educational order. */
function gradeSort(a: string, b: string): number {
  const order = [
    "Kindergarten",
    "Grade 1",
    "Grade 2",
    "Grade 3",
    "Grade 4",
    "Grade 5",
    "Grade 6",
    "Grade 7",
    "Grade 8",
    "Grades 9-10",
    "Grades 11-12",
    "High School",
    "College and Career Readiness",
    "Grades 6-8",
    "Glossary",
  ];
  const ia = order.indexOf(a);
  const ib = order.indexOf(b);
  if (ia >= 0 && ib >= 0) return ia - ib;
  if (ia >= 0) return -1;
  if (ib >= 0) return 1;
  return a.localeCompare(b);
}

/** Returns all standards matching a subject/grade/domain for question generation. */
export function getStandardsForSelection(input: {
  readonly subject: string;
  readonly grade: string;
  readonly domain: string;
}): { standardCode: string; standardText: string; topics: string[] }[] {
  const db = goldDb();
  try {
    const rows = db
      .prepare("SELECT content_json FROM gold_curriculum_records")
      .all() as Array<{ content_json: string }>;

    return rows
      .map((r) => JSON.parse(r.content_json))
      .filter(
        (r) =>
          normalizeSubject(r.subject ?? "") === input.subject &&
          r.gradeOrCourse === input.grade &&
          r.domain === input.domain,
      )
      .map((r) => ({
        standardCode: r.standardCode ?? "",
        standardText: r.standardText ?? "",
        topics: Array.isArray(r.topics) ? r.topics : [],
      }));
  } finally {
    db.close();
  }
}
