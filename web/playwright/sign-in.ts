import type { Page } from "@playwright/test";

/**
 * Signs in and verifies the POST actually happened. A click that lands
 * before hydration performs a native form reload instead of the sign-in
 * request, so each attempt re-fills the (possibly reset) form, registers
 * its response listener before clicking, and accepts only an OK response.
 */
export async function signIn(
  page: Page,
  username: string,
  password: string,
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password").fill(password);
    const posted = page
      .waitForResponse(
        (response) =>
          response.url().includes("/api/session") &&
          response.request().method() === "POST" &&
          response.ok(),
        { timeout: 10_000 },
      )
      .then(() => true)
      .catch(() => false);
    await page.getByRole("button", { name: "Enter practice" }).click();
    if (await posted) return;
  }
  throw new Error(`Sign-in POST never succeeded for ${username}`);
}
