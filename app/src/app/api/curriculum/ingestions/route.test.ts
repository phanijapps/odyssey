import { expect, test } from "vitest";
import { authenticateChild } from "../../../../server/identity/identity";
import { POST } from "./route";

async function adminHeaders(origin = "http://localhost"): Promise<HeadersInit> {
  const session = await authenticateChild({
    username: "test-admin",
    password: "test-admin-password",
  });
  return { cookie: `session=${session.sessionToken}`, origin };
}

function uploadRequest(input: {
  readonly name: string;
  readonly type: string;
  readonly content: string;
  readonly headers?: HeadersInit;
}): Request {
  const form = new FormData();
  form.append(
    "file",
    new Blob([input.content], { type: input.type }),
    input.name,
  );
  return new Request("http://localhost/api/curriculum/ingestions", {
    method: "POST",
    headers: input.headers,
    body: form,
  });
}

test("creates a temporary Bronze workflow for a same-origin steward", async () => {
  const response = await POST(
    uploadRequest({
      name: "framework.txt",
      type: "text/plain",
      content: "Grade 6 ratios",
      headers: await adminHeaders(),
    }),
  );

  expect(response.status).toBe(201);
  await expect(response.json()).resolves.toMatchObject({
    stage: "bronze",
    bronze: {
      fileName: "framework.txt",
      format: "text",
      byteSize: 14,
    },
  });
});

test("rejects anonymous, learner, and cross-origin curriculum uploads", async () => {
  const upload = { name: "framework.txt", type: "text/plain", content: "x" };
  expect((await POST(uploadRequest(upload))).status).toBe(403);

  const learner = await authenticateChild({
    username: "test-learner",
    password: "test-learner-password",
  });
  expect(
    (
      await POST(
        uploadRequest({
          ...upload,
          headers: {
            cookie: `session=${learner.sessionToken}`,
            origin: "http://localhost",
          },
        }),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await POST(
        uploadRequest({
          ...upload,
          headers: await adminHeaders("https://example.invalid"),
        }),
      )
    ).status,
  ).toBe(403);
});

test("preserves validation errors for an authorized steward", async () => {
  const headers = await adminHeaders();
  const missing = await POST(
    new Request("http://localhost/api/curriculum/ingestions", {
      method: "POST",
      headers,
    }),
  );
  expect(missing.status).toBe(400);

  const unsupported = await POST(
    uploadRequest({
      name: "framework.docx",
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      content: "not supported",
      headers,
    }),
  );
  expect(unsupported.status).toBe(400);
  await expect(unsupported.json()).resolves.toEqual({
    error: "Unsupported curriculum upload",
  });
});
