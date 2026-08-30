import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { expect, test } from "vitest";
import { authenticateChild } from "../../../../server/identity/identity";
import { resolveDatabasePath } from "../../../../server/persistence/sqlite";
import { POST } from "./route";

function request(cookie?: string, origin?: string): Request {
  return new Request("http://localhost/api/admin/backup", {
    method: "POST",
    headers: {
      ...(cookie ? { cookie } : undefined),
      ...(origin ? { origin } : undefined),
    },
  });
}

const backupsDirectory = join(
  dirname(resolveDatabasePath("learning")),
  "backups",
);

test("backup requires an admin session with same-origin proof", async () => {
  expect((await POST(request())).status).toBe(403);
  const learner = await authenticateChild({
    username: "test-learner",
    password: "test-learner-password",
  });
  expect(
    (await POST(request(`session=${learner.sessionToken}`, "http://localhost")))
      .status,
  ).toBe(403);
  const admin = await authenticateChild({
    username: "test-admin",
    password: "test-admin-password",
  });
  // Valid session, wrong origin: still rejected.
  expect(
    (
      await POST(
        request(`session=${admin.sessionToken}`, "https://evil.invalid"),
      )
    ).status,
  ).toBe(403);
});

test("backup writes a snapshot file under data/backups", async () => {
  rmSync(backupsDirectory, { force: true, recursive: true });
  const admin = await authenticateChild({
    username: "test-admin",
    password: "test-admin-password",
  });
  const response = await POST(
    request(`session=${admin.sessionToken}`, "http://localhost"),
  );
  expect(response.status).toBe(200);
  const body = (await response.json()) as { ok: boolean; file: string };
  expect(body.ok).toBe(true);
  expect(body.file).toMatch(/^learning-\d{8}-\d{6}\.db$/);
  rmSync(backupsDirectory, { force: true, recursive: true });
});
