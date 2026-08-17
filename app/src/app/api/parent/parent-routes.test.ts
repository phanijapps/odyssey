import { expect, test } from "vitest";
import { GET as summary } from "./summary/route";
import { POST as chat } from "./chat/route";

test("legacy parent routes fail closed until linked-child authorization ships", async () => {
  const summaryResponse = summary();
  expect(summaryResponse.status).toBe(410);
  expect(summaryResponse.headers.get("cache-control")).toBe("no-store");
  expect(await summaryResponse.json()).toEqual({
    error: "Parent portal is not available yet",
  });

  const chatResponse = await chat();
  expect(chatResponse.status).toBe(410);
  expect(chatResponse.headers.get("cache-control")).toBe("no-store");
  expect(await chatResponse.json()).toEqual({
    error: "Parent portal is not available yet",
  });
});
