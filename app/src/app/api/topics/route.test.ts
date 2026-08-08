import { expect, test } from "vitest";
import { GET } from "./route";

test("serves reviewed topic records", async () => {
  const response = GET();
  expect(response.status).toBe(200);
  const topics = await response.json();
  expect(topics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: "ratio",
        standardId: "6.RP.A.1",
        gradeOrCourse: "Grade 6",
      }),
      expect.objectContaining({
        id: "linear",
        standardId: "7.RP.A.2",
        gradeOrCourse: "Grade 7",
      }),
    ]),
  );
});
