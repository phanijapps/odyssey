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
