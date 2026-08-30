import { expect, test } from "@playwright/test";
import { signIn } from "./sign-in";
import { join } from "node:path";

const databasePath = join(
  process.cwd(),
  "data",
  "e2e",
  ".playwright-parent.db",
);

test("parent creates, resets, and revokes a child account", async ({
  page,
}) => {
  await page.goto("/");
  await signIn(page, "e2e-parent", "e2e-parent-password");
  await page.waitForURL("**/parent");

  await page.getByLabel("Child username").fill("e2e-child");
  await page.getByLabel("Temporary password").fill("initial-child-password");
  await page.getByRole("button", { name: "Add child" }).click();
  await expect(page.getByText("Account created for e2e-child.")).toBeVisible();
  const child = page.locator(".record-card").filter({ hasText: "e2e-child" });
  await expect(child).toHaveCount(1);
  await expect(child.getByText(/0 correct Practice answers/)).toBeVisible();
  await expect(child.getByText("hasn't practiced yet")).toBeVisible();

  await child.getByRole("button", { name: "Reset password" }).click();
  await page
    .getByLabel("New temporary password")
    .fill("updated-child-password");
  await page
    .getByLabel("Reset e2e-child's password")
    .getByRole("button", { name: "Reset password" })
    .click();
  await expect(page.getByText("Password reset for e2e-child.")).toBeVisible();

  await child.getByRole("button", { name: "Revoke…" }).click();
  await child.getByRole("button", { name: "Revoke access" }).click();
  await expect(page.getByText("Access revoked for e2e-child.")).toBeVisible();
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
  await page.getByRole("button", { name: "Add child" }).click();
  await expect(
    page.getByText("Account created for e2e-stale-child."),
  ).toBeVisible();
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
  const child = page
    .locator(".record-card")
    .filter({ hasText: "e2e-stale-child" });
  await child.getByRole("button", { name: "Revoke…" }).click();
  await child.getByRole("button", { name: "Revoke access" }).click();
  await expect(
    page.getByText("Access revoked for e2e-stale-child."),
  ).toBeVisible();
  await expect(child).toHaveCount(0);
  releaseFirstResponse!();
  // The stale pre-revocation response must not resurrect the child card or
  // leak its aggregates anywhere on the portal.
  const childrenSection = page.locator(
    "section[aria-labelledby='children-heading']",
  );
  await expect(childrenSection.getByText("e2e-stale-child")).toHaveCount(0);
  await expect(
    childrenSection.getByText("No children yet — add the first one below."),
  ).toBeVisible();
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
  await page.getByRole("button", { name: "Add child" }).click();
  await expect(
    page.getByText("Account created for e2e-preview-child."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show preview" }).click();
  await expect(
    page.getByRole("heading", { name: "Preview next practice" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "No preview yet — one appears here after a child takes a test.",
    ),
  ).toBeVisible();

  // Seed one completed Test with a missed ratio standard for that child.
  // The plan derives from the learner scope key (`child:<username>`), not
  // the account id.
  const { DatabaseSync } = await import("node:sqlite");
  const learning = new DatabaseSync(databasePath);
  try {
    learning
      .prepare(
        `INSERT INTO test_sessions
          (id, learner_id, subject, grade, status, score, created_at, completed_at)
         VALUES ('e2e-preview-session', 'child:e2e-preview-child', 'Mathematics', 'Grade 6', 'completed', 0, '2026-03-01', '2026-03-01')`,
      )
      .run();
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
    .locator("section[aria-labelledby='preview-heading']")
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
  await page.getByRole("button", { name: "Add child" }).click();
  await expect(
    page.getByText("Account created for e2e-performance-child."),
  ).toBeVisible();

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
