import { expect, test } from "@playwright/test";
import { signIn } from "./sign-in";

test("built app loads, walks, completes and retries a generated practice round", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await signIn(page, "atlas-parent", "atlas-parent-password");
  await page.waitForURL("**/parent");
  await page.getByLabel("Child username").fill("atlas-child");
  await page.getByLabel("Temporary password").fill("atlas-child-password");
  await page.getByRole("button", { name: "Add child" }).click();
  await expect(
    page.getByText("Account created for atlas-child."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/");
  await signIn(page, "atlas-child", "atlas-child-password");
  await page.getByRole("button", { name: "Grade 6", exact: true }).click();
  await page
    .getByRole("button", { name: "Browse skills", exact: true })
    .click();
  await page.getByRole("button", { name: /^6\.G\.1\s/ }).click();
  await expect(page.getByText("Preparing your questions…")).toBeVisible();
  await expect(page.locator(".question-text")).toContainText(
    "A rectangle is 2 cm long",
  );
  await expect(
    page.getByText("Question 1 of 12", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".generated-diagram")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".generated-diagram")
        .evaluate((element: HTMLImageElement) => element.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.screenshot({
    path: "test-results/atlas-first-question.png",
    fullPage: true,
  });

  const seen = new Set<string>();
  for (let index = 0; index < 12; index++) {
    const text = await page.locator(".question-text").innerText();
    expect(seen.has(text)).toBe(false);
    seen.add(text);
    const side = Number(text.match(/\d+/)?.[0]);
    const answer = text.includes("rectangle")
      ? side * 2
      : text.includes("triangle")
        ? side
        : side * side;
    await page
      .getByPlaceholder("Your answer")
      .fill(index === 0 ? "wrong" : String(answer));
    await page.getByRole("button", { name: "Check", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Next question →" }),
    ).toBeVisible();
    const calls = await (
      await page.request.get("http://127.0.0.1:19432/calls")
    ).json();
    expect(calls.calls).toBe(1);
    await page.getByRole("button", { name: "Next question →" }).click();
    if (index === 0) {
      await expect(page.locator(".question-text")).toContainText(
        "A rectangle is 3 cm long",
      );
      await expect(page.locator(".diff-badge")).toHaveText("Building up");
    }
    if (index < 11)
      await expect(
        page.getByText(`Question ${index + 2} of 12`, { exact: true }),
      ).toBeVisible();
  }
  await expect(
    page.getByRole("heading", { name: "Practice round complete" }),
  ).toBeVisible();
  await expect(
    page.getByText("You practiced 12 questions.", { exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/atlas-completed.png",
    fullPage: true,
  });

  await page.request.post("http://127.0.0.1:19432/invalid");
  await page.getByRole("button", { name: "Start another round" }).click();
  await expect(
    page.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
  await page.request.post("http://127.0.0.1:19432/valid");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByText("Question 1 of 12", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/atlas-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);

  // A delayed old answer must not disable a newly selected skill's controls.
  let release!: () => void;
  let submitted!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const accepted = new Promise<void>((resolve) => {
    submitted = resolve;
  });
  await page.route("**/api/answer", async (route) => {
    const response = await route.fetch();
    submitted();
    await held;
    await route.fulfill({ response });
  });
  try {
    await page.getByPlaceholder("Your answer").fill("4");
    await page.getByRole("button", { name: "Check", exact: true }).click();
    await accepted;
    await page
      .getByRole("button", { name: "Browse skills", exact: true })
      .click();
    await page.getByRole("button", { name: /^6\.RP\.1\s/ }).click();
    await expect(page.getByPlaceholder("Your answer")).toBeEnabled();
    const oldAnswer = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/answer") &&
        response.request().method() === "POST",
    );
    release();
    await oldAnswer;
    await page.unrouteAll({ behavior: "wait" });
    await expect(page.getByPlaceholder("Your answer")).toBeEnabled();
    await expect(
      page.getByRole("heading", { name: "6.RP.1", exact: true }),
    ).toBeVisible();
  } finally {
    release();
  }
});
