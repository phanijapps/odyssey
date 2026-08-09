import { expect, test } from "vitest";
import { POST } from "./route";

function uploadRequest(input: {
  readonly name: string;
  readonly type: string;
  readonly content: string;
}): Request {
  const form = new FormData();
  form.append(
    "file",
    new Blob([input.content], { type: input.type }),
    input.name,
  );
  return new Request("http://localhost/api/curriculum/ingestions", {
    method: "POST",
    body: form,
  });
}

test("creates a temporary Bronze workflow from one supported file", async () => {
  const response = await POST(
    uploadRequest({
      name: "framework.txt",
      type: "text/plain",
      content: "Grade 6 ratios",
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

test("rejects missing and unsupported uploaded files", async () => {
  const missing = await POST(
    new Request("http://localhost/api/curriculum/ingestions", {
      method: "POST",
    }),
  );
  expect(missing.status).toBe(400);

  const unsupported = await POST(
    uploadRequest({
      name: "framework.docx",
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      content: "not supported",
    }),
  );
  expect(unsupported.status).toBe(400);
  await expect(unsupported.json()).resolves.toEqual({
    error: "Unsupported curriculum upload",
  });
});
