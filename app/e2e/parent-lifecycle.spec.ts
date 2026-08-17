import { expect, test, type Page } from "@playwright/test";
import { rmSync } from "node:fs";
import { join } from "node:path";

const databasePath = join(process.cwd(), ".playwright-parent.db");

function removeTestDatabase(): void {
  for (const suffix of ["", "-shm", "-wal"])
    rmSync(`${databasePath}${suffix}`, { force: true });
}

test.beforeAll(removeTestDatabase);
test.afterAll(removeTestDatabase);

async function signIn(
  page: Page,
  username: string,
  password: string,
): Promise<void> {
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Enter practice" }).click();
}

test("parent creates, resets, and revokes a child account", async ({
  page,
}) => {
  await page.goto("/");
  await signIn(page, "e2e-parent", "e2e-parent-password");
  await page.waitForURL("**/parent");

  await page.getByLabel("Child username").fill("e2e-child");
  await page.getByLabel("Temporary password").fill("initial-child-password");
  await page.getByRole("button", { name: "Create child" }).click();
  await expect(page.getByText("Child account created.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Child Performance" }),
  ).toBeVisible();
  await expect(
    page.getByText("0 correct Practice answers · 0-day active Practice streak"),
  ).toBeVisible();

  const child = page.locator("li").filter({ hasText: "e2e-child" });
  await child.getByRole("button", { name: "Reset password" }).click();
  await page
    .getByLabel("New temporary password")
    .fill("updated-child-password");
  await page
    .getByLabel("Reset e2e-child's password")
    .getByRole("button", { name: "Reset password" })
    .click();
  await expect(page.getByText("Password reset for e2e-child.")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await child.getByRole("button", { name: "Revoke" }).click();
  await expect(page.getByText("Child access revoked.")).toBeVisible();
  await expect(child).toHaveCount(0);
});

test("parent revocation ignores an older in-flight Performance response", async ({
  page,
}) => {
  await page.goto("/");
  await signIn(page, "e2e-parent", "e2e-parent-password");
  await page.waitForURL("**/parent");
  await page.getByLabel("Child username").fill("e2e-stale-child");
  await page.getByLabel("Temporary password").fill("stale-child-password");
  await page.getByRole("button", { name: "Create child" }).click();
  await expect(page.getByText("Child account created.")).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/");

  let releaseFirstResponse: (() => void) | undefined;
  const firstResponseReleased = new Promise<void>((resolve) => {
    releaseFirstResponse = resolve;
  });
  let capturedFirstResponse: (() => void) | undefined;
  const firstResponseCaptured = new Promise<void>((resolve) => {
    capturedFirstResponse = resolve;
  });
  let holdFirstResponse = true;
  await page.route("**/api/parent/performance", async (route) => {
    if (!holdFirstResponse) return route.continue();
    holdFirstResponse = false;
    const response = await route.fetch();
    const body = await response.body();
    capturedFirstResponse!();
    await firstResponseReleased;
    await route.fulfill({ response, body });
  });

  await signIn(page, "e2e-parent", "e2e-parent-password");
  await page.waitForURL("**/parent");
  await firstResponseCaptured;
  const child = page.locator("li").filter({ hasText: "e2e-stale-child" });
  page.once("dialog", (dialog) => dialog.accept());
  await child.getByRole("button", { name: "Revoke" }).click();
  await expect(page.getByText("Child access revoked.")).toBeVisible();
  await expect(child).toHaveCount(0);
  releaseFirstResponse!();
  await expect(
    page.getByText("No active linked-child Performance is available yet."),
  ).toBeVisible();
  await expect(
    page.getByText("0 correct Practice answers · 0-day active Practice streak"),
  ).toHaveCount(0);
  await page.unroute("**/api/parent/performance");
});

test("parent preview shows a reviewed sample without affecting the child", async ({
  page,
}) => {
  await page.goto("/");
  await signIn(page, "e2e-parent", "e2e-parent-password");
  await page.waitForURL("**/parent");

  // A fresh preview child with no completed Test yields the honest empty state.
  await page.getByLabel("Child username").fill("e2e-preview-child");
  await page.getByLabel("Temporary password").fill("preview-child-password");
  await page.getByRole("button", { name: "Create child" }).click();
  await expect(page.getByText("Child account created.")).toBeVisible();
  await page.getByRole("button", { name: "Show preview" }).click();
  await expect(
    page.getByRole("heading", { name: "Preview recommended practice" }),
  ).toBeVisible();
  await expect(
    page.getByText("No recommended practice preview is available yet."),
  ).toBeVisible();

  // Seed one completed Test with a missed ratio standard for that child.
  const databasePath = join(process.cwd(), ".playwright-parent.db");
  const { DatabaseSync } = await import("node:sqlite");
  const learning = new DatabaseSync(databasePath);
  try {
    const child = learning
      .prepare("SELECT account_id FROM accounts WHERE username = ?")
      .get("e2e-preview-child") as { account_id: string | undefined };
    expect(child?.account_id).toBeTruthy();
    learning
      .prepare(
        `INSERT INTO test_sessions
          (id, learner_id, subject, grade, status, score, created_at, completed_at)
         VALUES ('e2e-preview-session', ?, 'Mathematics', 'Grade 6', 'completed', 0, '2026-03-01', '2026-03-01')`,
      )
      .run(child.account_id);
    learning
      .prepare(
        `INSERT INTO test_selected_records
          (test_session_id, selection_ordinal, gold_record_id, subject, grade,
           content_json, content_fingerprint)
         VALUES ('e2e-preview-session', 1, 'e2e-preview-gold', 'Mathematics', 'Grade 6', ?, 'fixture')`,
      )
      .run(
        JSON.stringify({
          subject: "Mathematics",
          gradeOrCourse: "Grade 6",
          domain: "Ratios and Proportional Relationships",
          standardCode: "6.RP.A.1",
          standardText:
            "Understand the concept of a ratio and use ratio language to describe a ratio relationship between two quantities.",
        }),
      );
    learning
      .prepare(
        `INSERT INTO test_questions
          (test_session_id, ordinal, gold_record_id, gold_content_fingerprint,
           planned_difficulty, correct, points, graded_at)
         VALUES ('e2e-preview-session', 1, 'e2e-preview-gold', 'fixture', 1, 0, 0, '2026-03-01')`,
      )
      .run();
  } finally {
    learning.close();
  }

  await page.getByRole("button", { name: "Show preview" }).click();
  await expect(page.getByText("6.RP.A.1")).toBeVisible();
  await expect(page.getByText(/ratio of flour to sugar/)).toBeVisible();
  await expect(page.getByText(/Preview only/)).toBeVisible();
  const pageText = await page
    .locator("section[aria-label='Practice preview']")
    .innerText();
  expect(pageText).not.toMatch(/2:1|2 to 1|hint/i);
});

test("learner Performance renders the validated A2UI surface", async ({
  page,
}) => {
  await page.goto("/");
  await signIn(page, "e2e-parent", "e2e-parent-password");
  await page.waitForURL("**/parent");

  await page.getByLabel("Child username").fill("e2e-performance-child");
  await page
    .getByLabel("Temporary password")
    .fill("performance-child-password");
  await page.getByRole("button", { name: "Create child" }).click();
  await expect(page.getByText("Child account created.")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/");
  await signIn(page, "e2e-performance-child", "performance-child-password");
  await page.route("**/api/performance", (route) =>
    route.fulfill({ status: 500, body: '{"error":"unavailable"}' }),
  );
  await page.goto("/performance");
  await expect(
    page.getByText("Performance is unavailable. Please retry."),
  ).toBeVisible();
  await page.unroute("**/api/performance");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(
    page.getByRole("heading", { name: "Performance" }),
  ).toBeVisible();
  await expect(
    page.getByText("No Practice activity is recorded yet."),
  ).toBeVisible();
  await expect(
    page.getByText("Tests do not change Practice progress or mastery."),
  ).toBeVisible();
});
