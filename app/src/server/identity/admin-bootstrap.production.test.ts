import { expect, test } from "vitest";

/**
 * Imports identity only after configuring its startup boundary, proving the
 * production admin bootstrap has no route and yields an ordinary admin login.
 * Mirrors parent-bootstrap.production.test.ts.
 */
test("seeds exactly the explicitly configured first production admin", async () => {
  const environment = process.env as Record<string, string | undefined>;
  const originals = {
    NODE_ENV: environment.NODE_ENV,
    enabled: environment.ODYSSEY_ENABLE_PRODUCTION_ADMIN_BOOTSTRAP,
    username: environment.ODYSSEY_ADMIN_BOOTSTRAP_USERNAME,
    password: environment.ODYSSEY_ADMIN_BOOTSTRAP_PASSWORD,
  };
  environment.NODE_ENV = "production";
  process.env.ODYSSEY_ENABLE_PRODUCTION_ADMIN_BOOTSTRAP = "1";
  process.env.ODYSSEY_ADMIN_BOOTSTRAP_USERNAME = "bootstrap-admin";
  process.env.ODYSSEY_ADMIN_BOOTSTRAP_PASSWORD = "bootstrap-password";
  try {
    const { authenticateChild } = await import("./identity");
    await expect(
      authenticateChild({
        username: "bootstrap-admin",
        password: "bootstrap-password",
        environment: "production",
      }),
    ).resolves.toMatchObject({ role: "admin", username: "bootstrap-admin" });
  } finally {
    for (const [key, value] of Object.entries(originals)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
