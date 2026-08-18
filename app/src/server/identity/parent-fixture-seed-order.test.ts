import { expect, test } from "vitest";

/**
 * Imports identity only after configuring the startup boundary, proving the
 * explicitly configured bootstrap parent still seeds when the devparent
 * fixture is also enabled — the bootstrap must run before the fixtures so
 * explicit credentials win over the zero-parents guard.
 */
test("local bootstrap and devparent fixture seed together in development", async () => {
  const environment = process.env as Record<string, string | undefined>;
  const snapshot = [
    "NODE_ENV",
    "ODYSSEY_ENABLE_DEVELOPMENT_FIXTURE_ACCOUNTS",
    "ODYSSEY_ENABLE_LOCAL_PARENT_BOOTSTRAP",
    "ODYSSEY_PARENT_BOOTSTRAP_USERNAME",
    "ODYSSEY_PARENT_BOOTSTRAP_PASSWORD",
  ].map((key) => [key, environment[key]] as const);
  environment.NODE_ENV = "development";
  process.env.ODYSSEY_ENABLE_DEVELOPMENT_FIXTURE_ACCOUNTS = "1";
  process.env.ODYSSEY_ENABLE_LOCAL_PARENT_BOOTSTRAP = "1";
  process.env.ODYSSEY_PARENT_BOOTSTRAP_USERNAME = "order-bootstrap-parent";
  process.env.ODYSSEY_PARENT_BOOTSTRAP_PASSWORD = "bootstrap-password";
  try {
    const { authenticateChild } = await import("./identity");
    await expect(
      authenticateChild({
        username: "order-bootstrap-parent",
        password: "bootstrap-password",
      }),
    ).resolves.toMatchObject({ role: "parent" });
    await expect(
      authenticateChild({ username: "devparent", password: "parent" }),
    ).resolves.toMatchObject({ role: "parent" });
  } finally {
    for (const [key, value] of snapshot) {
      if (value === undefined) delete process.env[key];
      else environment[key] = value;
    }
  }
});
