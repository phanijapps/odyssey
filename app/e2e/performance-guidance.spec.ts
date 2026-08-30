import { expect, test } from "@playwright/test";
import { signIn } from "./sign-in";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const databasePath = join(
  process.cwd(),
  "data",
  "e2e",
  ".playwright-parent.db",
);
const curriculumDatabasePath = join(
  process.cwd(),
  "data",
  "e2e",
  ".playwright-curriculum.db",
);

/** Seeds the one reviewed Gold standard the guidance target must resolve to. */
function seedReviewedCurriculum(): void {
  const curriculum = new DatabaseSync(curriculumDatabasePath);
  try {
    curriculum
      .prepare(
        `INSERT OR IGNORE INTO gold_curriculum_records
          (record_id, subject, framework, content_json, source_fingerprint, prompt_version, model, created_at)
         VALUES ('e2e-guidance-gold', 'Mathematics', 'local', ?, 'fixture', 'fixture', 'fixture', '2026-01-01')`,
      )
      .run(
        JSON.stringify({
          id: "e2e-guidance-gold",
          subject: "Mathematics",
          gradeOrCourse: "Grade 8",
          domain: "Expressions",
          standardCode: "8.EE.7",
          standardText: "Use linear equations.",
        }),
      );
  } finally {
    curriculum.close();
  }
}

/** The open browse route both warms dev compilation and creates the store. */
async function ensureCurriculumStore(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await page.request.get("/api/curriculum/browse");
    if (!response.ok()) continue;
    // Open read-write: a read-only open cannot recover a hot WAL beside the
    // live dev-server writer.
    const database = new DatabaseSync(curriculumDatabasePath);
    try {
      const table = database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'gold_curriculum_records'",
        )
        .get();
      if (table) return;
    } finally {
      database.close();
    }
    await page.waitForTimeout(500);
  }
  throw new Error("curriculum store did not initialize");
}

/** Seeds one completed Test with a reviewed miss (8.EE.7) and a stale miss (8.EE.9). */
function seedCompletedTest(childUsername: string): void {
  const learning = new DatabaseSync(databasePath);
  try {
    const child = learning
      .prepare(
        "SELECT child_id FROM auth_sessions WHERE username = ? ORDER BY last_seen DESC LIMIT 1",
      )
      .get(childUsername) as { child_id: string } | undefined;
    if (!child)
      throw new Error(`Missing seeded child account ${childUsername}`);
    learning
      .prepare(
        `INSERT OR IGNORE INTO test_sessions
          (id, learner_id, subject, grade, status, score, created_at, completed_at)
         VALUES ('e2e-guidance-session', ?, 'Mathematics', 'Grade 8', 'completed', 0, '2026-03-01', '2026-03-01')`,
      )
      .run(child.child_id);
    for (const [ordinal, standardCode, goldRecordId] of [
      [1, "8.EE.7", "e2e-guidance-gold-reviewed"],
      [2, "8.EE.9", "e2e-guidance-gold-stale"],
    ] as const) {
      learning
        .prepare(
          `INSERT OR IGNORE INTO test_selected_records
            (test_session_id, selection_ordinal, gold_record_id, subject, grade,
             content_json, content_fingerprint)
           VALUES ('e2e-guidance-session', ?, ?, 'Mathematics', 'Grade 8', ?, 'fixture')`,
        )
        .run(
          ordinal,
          goldRecordId,
          JSON.stringify({
            subject: "Mathematics",
            gradeOrCourse: "Grade 8",
            domain: "Expressions",
            standardCode,
            standardText: "Use linear equations.",
          }),
        );
      learning
        .prepare(
          `INSERT OR IGNORE INTO test_questions
            (test_session_id, ordinal, gold_record_id, gold_content_fingerprint,
             planned_difficulty, correct, points, graded_at)
           VALUES ('e2e-guidance-session', ?, ?, 'fixture', 1, 0, 0, '2026-03-01')`,
        )
        .run(ordinal, goldRecordId);
    }
  } finally {
    learning.close();
  }
}

test("learner starts existing Practice from a Performance guidance card", async ({
  page,
}) => {
  await page.goto("/");
  await ensureCurriculumStore(page);
  seedReviewedCurriculum();

  await signIn(page, "e2e-parent", "e2e-parent-password");
  await page.waitForURL("**/parent");
  await page.getByLabel("Child username").fill("e2e-guidance-child");
  await page.getByLabel("Temporary password").fill("guidance-child-password");
  await page.getByRole("button", { name: "Add child" }).click();
  await expect(
    page.getByText("Account created for e2e-guidance-child."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/");

  await signIn(page, "e2e-guidance-child", "guidance-child-password");
  await page.getByRole("button", { name: "Grade 8" }).click();

  seedCompletedTest("e2e-guidance-child");
  await page.setViewportSize({ width: 390, height: 744 });
  await page.goto("/performance");
  await expect(
    page.getByRole("heading", { name: "Next Practice" }),
  ).toBeVisible();

  const availableCard = page.locator(".guidance-card").filter({
    hasText: "8.EE.7",
  });
  await expect(availableCard).toBeVisible();
  await expect(
    availableCard.getByText(/Practice is recommended/),
  ).toBeVisible();

  await page.screenshot({
    path: "test-results/performance-guidance-narrow-viewport.png",
    fullPage: true,
  });
  const overflowsNarrowViewport = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflowsNarrowViewport).toBeLessThanOrEqual(0);

  const staleCard = page
    .locator(".guidance-card")
    .filter({ hasText: "8.EE.9" });
  await expect(staleCard).toBeVisible();
  await expect(
    staleCard.getByText(/no longer in the reviewed curriculum/),
  ).toBeVisible();
  await expect(
    staleCard.getByRole("button", { name: "Practice this skill" }),
  ).toHaveCount(0);

  const action = availableCard.getByRole("button", {
    name: "Practice this skill",
  });
  await action.focus();
  await expect(action).toBeFocused();
  await action.press("Enter");

  await expect(
    page.getByRole("heading", { name: "8.EE.7", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Use linear equations.")).toBeVisible();
  // The practice question itself must render alongside its interaction —
  // guards the plain renderer against regressing to an input-only card.
  await expect(page.locator("h2.question-text")).not.toBeEmpty();
  await expect(page).toHaveURL(/\/(\?.*)?$/);
});

test("parent-suggested practice flows to the learner portal", async ({
  page,
}) => {
  await page.goto("/");
  await ensureCurriculumStore(page);
  seedReviewedCurriculum();

  // Parent creates the child; with no completed Test the picker is honest.
  await signIn(page, "e2e-parent", "e2e-parent-password");
  await page.waitForURL("**/parent");
  await page.getByLabel("Child username").fill("e2e-suggest-child");
  await page.getByLabel("Temporary password").fill("suggest-child-password");
  await page.getByRole("button", { name: "Add child" }).click();
  await expect(
    page.getByText("Account created for e2e-suggest-child."),
  ).toBeVisible();
  const card = page
    .locator(".record-card")
    .filter({ hasText: "e2e-suggest-child" });
  await card.getByRole("button", { name: "Suggest practice…" }).click();
  await expect(card.getByText(/No recommended skills yet/)).toBeVisible();

  // A completed test with a reviewed miss creates the recommendation. The
  // child has not signed in yet, so seed by the learner scope key directly.
  {
    const learning = new DatabaseSync(databasePath);
    try {
      learning
        .prepare(
          `INSERT OR IGNORE INTO test_sessions
            (id, learner_id, subject, grade, status, score, created_at, completed_at)
           VALUES ('e2e-suggest-session', 'child:e2e-suggest-child', 'Mathematics', 'Grade 8', 'completed', 0, '2026-03-01', '2026-03-01')`,
        )
        .run();
      learning
        .prepare(
          `INSERT OR IGNORE INTO test_selected_records
            (test_session_id, selection_ordinal, gold_record_id, subject, grade,
             content_json, content_fingerprint)
           VALUES ('e2e-suggest-session', 1, 'e2e-guidance-gold-reviewed', 'Mathematics', 'Grade 8', ?, 'fixture')`,
        )
        .run(
          JSON.stringify({
            subject: "Mathematics",
            gradeOrCourse: "Grade 8",
            domain: "Expressions",
            standardCode: "8.EE.7",
            standardText: "Use linear equations.",
          }),
        );
      learning
        .prepare(
          `INSERT OR IGNORE INTO test_questions
            (test_session_id, ordinal, gold_record_id, gold_content_fingerprint,
             planned_difficulty, correct, points, graded_at)
           VALUES ('e2e-suggest-session', 1, 'e2e-guidance-gold-reviewed', 'fixture', 1, 0, 0, '2026-03-01')`,
        )
        .run();
    } finally {
      learning.close();
    }
  }
  // Close the still-open panel, then reopen — reopening always refetches.
  await card.getByRole("button", { name: "Suggest practice…" }).click();
  await card.getByRole("button", { name: "Suggest practice…" }).click();
  await expect(
    card.getByRole("button", { name: "8.EE.7", exact: true }),
  ).toBeVisible();
  await card.getByRole("button", { name: "8.EE.7", exact: true }).click();
  await card.getByRole("button", { name: "Suggest for tonight" }).click();
  await expect(card.getByText(/Suggested: 8.EE.7/)).toBeVisible();

  // The parent can cancel an active suggestion, then suggest it again.
  await card.getByRole("button", { name: "Cancel suggestion" }).click();
  await expect(
    page.getByText("Suggestion cancelled for e2e-suggest-child."),
  ).toBeVisible();
  // The panel stays open and now shows the picker again.
  await expect(
    card.getByRole("button", { name: "8.EE.7", exact: true }),
  ).toBeVisible();
  await card.getByRole("button", { name: "8.EE.7", exact: true }).click();
  await card.getByRole("button", { name: "Suggest for tonight" }).click();
  await expect(card.getByText(/Suggested: 8.EE.7/)).toBeVisible();

  // The child sees a quiet banner and dismisses it.
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/");
  await signIn(page, "e2e-suggest-child", "suggest-child-password");
  // First-time setup: the banner renders as soon as the portal shell does.
  await page.getByRole("button", { name: "Grade 8" }).click();
  await expect(
    page.getByText("Your parent suggests practicing 8.EE.7"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Not now" }).click();
  await expect(page.locator(".suggestion-banner")).toHaveCount(0);

  // The parent re-suggests; the child accepts into the existing flow.
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/");
  await signIn(page, "e2e-parent", "e2e-parent-password");
  await page.waitForURL("**/parent");
  const againCard = page
    .locator(".record-card")
    .filter({ hasText: "e2e-suggest-child" });
  await againCard.getByRole("button", { name: "Suggest practice…" }).click();
  await expect(
    againCard.getByRole("button", { name: "8.EE.7", exact: true }),
  ).toBeVisible();
  await againCard.getByRole("button", { name: "8.EE.7", exact: true }).click();
  await againCard.getByRole("button", { name: "Suggest for tonight" }).click();
  await expect(againCard.getByText(/Suggested: 8.EE.7/)).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/");
  await signIn(page, "e2e-suggest-child", "suggest-child-password");
  await page.getByRole("button", { name: "Practice it" }).click();
  await expect(
    page.getByRole("heading", { name: "8.EE.7", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Use linear equations.")).toBeVisible();
});
