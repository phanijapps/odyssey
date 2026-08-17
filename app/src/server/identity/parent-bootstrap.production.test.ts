import { expect, test } from "vitest";

/**
 * Imports identity only after configuring its startup boundary, proving the
 * production bootstrap has no route and still yields an ordinary parent login.
 */
test("seeds exactly the explicitly configured first production parent", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalEnabled =
    process.env.ODYSSEY_ENABLE_PRODUCTION_PARENT_BOOTSTRAP;
  const originalUsername = process.env.ODYSSEY_PARENT_BOOTSTRAP_USERNAME;
  const originalPassword = process.env.ODYSSEY_PARENT_BOOTSTRAP_PASSWORD;
  process.env.NODE_ENV = "production";
  process.env.ODYSSEY_ENABLE_PRODUCTION_PARENT_BOOTSTRAP = "1";
  process.env.ODYSSEY_PARENT_BOOTSTRAP_USERNAME = "bootstrap-parent";
  process.env.ODYSSEY_PARENT_BOOTSTRAP_PASSWORD = "bootstrap-password";
  try {
    const { authenticateChild } = await import("./identity");
    await expect(
      authenticateChild({
        username: "bootstrap-parent",
        password: "bootstrap-password",
        environment: "production",
      }),
    ).resolves.toMatchObject({ role: "parent", username: "bootstrap-parent" });
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalEnabled === undefined)
      delete process.env.ODYSSEY_ENABLE_PRODUCTION_PARENT_BOOTSTRAP;
    else
      process.env.ODYSSEY_ENABLE_PRODUCTION_PARENT_BOOTSTRAP = originalEnabled;
    if (originalUsername === undefined)
      delete process.env.ODYSSEY_PARENT_BOOTSTRAP_USERNAME;
    else process.env.ODYSSEY_PARENT_BOOTSTRAP_USERNAME = originalUsername;
    if (originalPassword === undefined)
      delete process.env.ODYSSEY_PARENT_BOOTSTRAP_PASSWORD;
    else process.env.ODYSSEY_PARENT_BOOTSTRAP_PASSWORD = originalPassword;
  }
});
