import { randomBytes, scryptSync } from "node:crypto";
import { expect, test } from "vitest";
import { learningDb } from "../learning/sqlite-repository";
import {
  authenticateChild,
  createParentChildAccount,
  listParentChildren,
  requireParentMutationProof,
  requireParentRead,
  resetParentChildPassword,
  resolveExternalIdentitySubject,
  revokeParentChildLink,
} from "./identity";

function provisionParent(username: string, password: string): string {
  const accountId = randomBytes(16).toString("hex");
  const salt = randomBytes(16);
  learningDb
    .prepare(
      `INSERT INTO accounts (account_id, username, password_hash, salt, role)
       VALUES (?, ?, ?, ?, 'parent')`,
    )
    .run(accountId, username, scryptSync(password, salt, 32), salt);
  return accountId;
}

test("a parent can create, reset, and revoke only linked child accounts", async () => {
  const parentId = provisionParent("parent-lifecycle", "parent-password");
  const parentSession = await authenticateChild({
    username: "parent-lifecycle",
    password: "parent-password",
  });
  const child = await createParentChildAccount(parentId, {
    username: "linked-child",
    password: "child-password",
  });
  expect(listParentChildren(parentId)).toEqual([
    { accountId: child.accountId, username: "linked-child" },
  ]);

  await resetParentChildPassword(
    parentId,
    child.accountId,
    "new-child-password",
  );
  await expect(
    authenticateChild({ username: "linked-child", password: "child-password" }),
  ).rejects.toThrow("Invalid credentials");
  await expect(
    authenticateChild({
      username: "linked-child",
      password: "new-child-password",
    }),
  ).resolves.toMatchObject({ role: "student", principalId: child.accountId });

  revokeParentChildLink(parentId, child.accountId);
  expect(listParentChildren(parentId)).toEqual([]);
  expect(
    requireParentRead(
      new Request("http://localhost/parent", {
        headers: { cookie: `session=${parentSession.sessionToken}` },
      }),
    ),
  ).toEqual({ parentAccountId: parentId });
  await expect(
    resetParentChildPassword(parentId, child.accountId, "another-password"),
  ).rejects.toThrow("Child access denied");
});

test("parent guards require a parent session and canonical mutation origin", async () => {
  const parentId = provisionParent("parent-guard", "parent-password");
  const session = await authenticateChild({
    username: "parent-guard",
    password: "parent-password",
  });
  expect(session.principalId).toBe(parentId);
  const headers = {
    cookie: `session=${session.sessionToken}`,
    origin: "http://localhost",
  };
  expect(
    requireParentRead(new Request("http://localhost/parent", { headers })),
  ).toEqual({ parentAccountId: parentId });
  expect(
    requireParentMutationProof(
      new Request("http://localhost/parent", { method: "POST", headers }),
    ),
  ).toEqual({ parentAccountId: parentId });
  expect(() =>
    requireParentMutationProof(
      new Request("http://localhost/parent", {
        method: "POST",
        headers: { ...headers, origin: "https://example.invalid" },
      }),
    ),
  ).toThrow("Mutation proof required");
});

test("the SSO seam resolves a linked subject but does not authenticate it", () => {
  const parentId = provisionParent("parent-sso", "parent-password");
  learningDb
    .prepare(
      `INSERT INTO external_identity_links
        (account_id, provider, provider_subject, created_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run(parentId, "example-provider", "subject-123", Date.now());
  expect(
    resolveExternalIdentitySubject({
      provider: "example-provider",
      subject: "subject-123",
    }),
  ).toEqual({
    principalId: parentId,
    username: "parent-sso",
    role: "parent",
  });
  expect(
    resolveExternalIdentitySubject({ provider: "", subject: "subject-123" }),
  ).toBeUndefined();
});
