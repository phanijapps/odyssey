import { rmSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { expect, test } from "vitest";
import { authenticateChild } from "../../../../server/identity/identity";
import { resolveDatabasePath } from "@odyssey/db";
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

test("backup refuses to overwrite an existing snapshot file", async () => {
  rmSync(backupsDirectory, { force: true, recursive: true });
  mkdirSync(backupsDirectory, { recursive: true });
  // Occupy every filename the next-second timestamp could produce.
  const now = new Date();
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+$/, "")
    .replace("T", "-");
  const sentinel = "sentinel";
  const occupied = join(backupsDirectory, `learning-${stamp}.db`);
  writeFileSync(occupied, sentinel);

  const admin = await authenticateChild({
    username: "test-admin",
    password: "test-admin-password",
  });
  const response = await POST(
    request(`session=${admin.sessionToken}`, "http://localhost"),
  );
  expect(response.status).toBe(500);
  expect((await import("node:fs")).readFileSync(occupied, "utf8")).toBe(
    sentinel,
  );
  rmSync(backupsDirectory, { force: true, recursive: true });
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
