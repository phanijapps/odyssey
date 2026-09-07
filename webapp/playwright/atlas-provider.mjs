import { createServer } from "node:http";

let calls = 0;
let invalid = false;

/** Deterministic transport fixture; the application still parses and validates it. */
const server = createServer(async (request, response) => {
  if (request.url === "/health" || request.url === "/calls") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ calls }));
    return;
  }
  if (request.method === "POST" && request.url === "/invalid") {
    invalid = true;
    response.end();
    return;
  }
  if (request.method === "POST" && request.url === "/valid") {
    invalid = false;
    response.end();
    return;
  }
  if (request.method !== "POST" || request.url !== "/v1/chat/completions") {
    response.writeHead(404).end();
    return;
  }
  calls += 1;
  // Drain without recording prompts, credentials or session data.
  for await (const chunk of request) void chunk;
  const failed = invalid;
  const nodes = Array.from({ length: 12 }, (_, index) => {
    const concept = ["rectangles", "triangles", "squares"][
      Math.floor(index / 4)
    ];
    const side = index + 2;
    const question =
      concept === "rectangles"
        ? `A rectangle is ${side} cm long and 2 cm wide. What is its area in square centimeters?`
        : concept === "triangles"
          ? `A triangle has a base of ${side} cm and height of 2 cm. What is its area in square centimeters?`
          : `A square has sides of ${side} cm. What is its area in square centimeters?`;
    const answer =
      concept === "rectangles"
        ? side * 2
        : concept === "triangles"
          ? side
          : side * side;
    return {
      concept,
      tier: [1, 1, 2, 3][index % 4],
      question,
      answer: String(answer),
      acceptableAnswers: [],
      hint: "Use the area formula for this shape.",
      solution: [
        "Use the dimensions given in the question.",
        `The area is ${answer} square centimeters.`,
      ],
      diagramSvg:
        concept === "rectangles"
          ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><rect x="${(200 - side * 25) / 2}" y="20" width="${side * 25}" height="50" fill="#d4a72c" /><text x="100" y="90" text-anchor="middle" fill="#333333">${side} cm by 2 cm</text></svg>`
          : "",
    };
  });
  await new Promise((resolve) => setTimeout(resolve, 1_500));
  const content = failed ? "null" : JSON.stringify({ nodes });
  response.writeHead(200, { "content-type": "text/event-stream" });
  response.end(
    [
      `data: ${JSON.stringify({ id: "atlas-fixture", choices: [{ delta: { content }, finish_reason: null }] })}`,
      "",
      `data: ${JSON.stringify({ id: "atlas-fixture", choices: [{ delta: {}, finish_reason: "stop" }] })}`,
      "",
      "data: [DONE]",
      "",
    ].join("\n"),
  );
});

server.listen(19432, "127.0.0.1");
