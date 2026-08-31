import { randomBytes, scryptSync } from "node:crypto";
import { expect, test } from "vitest";
import { learningDb } from "@odyssey/db";

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

test("suppresses the admin bootstrap once any admin exists", async () => {
  // A pre-existing admin row must suppress the bootstrap entirely.
  const salt = randomBytes(16);
  const existingId = randomBytes(16).toString("hex");
  learningDb
    .prepare(
      `INSERT INTO accounts (account_id, username, password_hash, salt, role)
       VALUES (?, 'pre-existing-admin', ?, ?, 'admin')
       ON CONFLICT(username) DO NOTHING`,
    )
    .run(existingId, scryptSync("pre-existing-password", salt, 32), salt);
  const adminsBefore = (
    learningDb
      .prepare("SELECT count(*) AS n FROM accounts WHERE role = 'admin'")
      .get() as { n: number }
  ).n;

  const environment = process.env as Record<string, string | undefined>;
  const originals = {
    NODE_ENV: environment.NODE_ENV,
    enabled: environment.ODYSSEY_ENABLE_PRODUCTION_ADMIN_BOOTSTRAP,
    username: environment.ODYSSEY_ADMIN_BOOTSTRAP_USERNAME,
    password: environment.ODYSSEY_ADMIN_BOOTSTRAP_PASSWORD,
  };
  environment.NODE_ENV = "production";
  process.env.ODYSSEY_ENABLE_PRODUCTION_ADMIN_BOOTSTRAP = "1";
  process.env.ODYSSEY_ADMIN_BOOTSTRAP_USERNAME = "second-admin";
  process.env.ODYSSEY_ADMIN_BOOTSTRAP_PASSWORD = "second-password";
  try {
    const { authenticateChild } = await import("./identity");
    // The configured bootstrap admin is NOT created: only one admin exists.
    await expect(
      authenticateChild({
        username: "second-admin",
        password: "second-password",
        environment: "production",
      }),
    ).rejects.toThrow("Invalid credentials");
    const admins = learningDb
      .prepare("SELECT count(*) AS n FROM accounts WHERE role = 'admin'")
      .get() as { n: number };
    expect(admins.n).toBe(adminsBefore);
  } finally {
    for (const [key, value] of Object.entries(originals)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    learningDb
      .prepare("DELETE FROM accounts WHERE account_id = ?")
      .run(existingId);
  }
});
