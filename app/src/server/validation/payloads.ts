/** Validates strict learning and rendering payloads before every sink. */
export function validateLearningPayload(_input: unknown): void {
  if (!_input || typeof _input !== "object") throw new Error("Invalid payload");
  const input = _input as Record<string, unknown>;
  const keys = Object.keys(input);
  if (
    input.component === "GeometryDiagram" &&
    typeof input.diagramSvg === "string" &&
    keys.every((key) => ["component", "diagramSvg"].includes(key)) &&
    isSafeSvg(input.diagramSvg)
  )
    return;
  throw new Error("Invalid payload");
}

/** Validates the finite application-owned A2UI component catalog. */
export function validateA2UIPayload(_input: unknown): void {
  if (!_input || typeof _input !== "object" || Array.isArray(_input))
    throw new Error("Invalid A2UI payload");
  const input = _input as Record<string, unknown>;
  if (input.component === "GeometryDiagram") {
    validateLearningPayload(input);
    return;
  }
  if (
    input.component === "QuestionCard" &&
    Object.keys(input).every(
      (key) => key === "component" || key === "question" || key === "level",
    ) &&
    typeof input.question === "string" &&
    input.question.length >= 1 &&
    input.question.length <= 400 &&
    Number.isInteger(input.level) &&
    Number(input.level) >= 1 &&
    Number(input.level) <= 13
  )
    return;
  if (
    input.component === "ProgressIndicator" &&
    Object.keys(input).every(
      (key) =>
        key === "component" || key === "level" || key === "correctStreak",
    ) &&
    Number.isInteger(input.level) &&
    Number(input.level) >= 1 &&
    Number(input.level) <= 13 &&
    Number.isInteger(input.correctStreak) &&
    Number(input.correctStreak) >= 0
  )
    return;
  throw new Error("Invalid A2UI payload");
}

function isSafeSvg(svg: string): boolean {
  if (
    svg.length > 20_000 ||
    /<\s*(script|style|foreignObject|image|use|animate)\b|\b(on[a-z]+|href|xlink:href)\s*=|url\s*\(|javascript:/i.test(
      svg,
    )
  )
    return false;
  const tags = [...svg.matchAll(/<\/?\s*([a-zA-Z][\w:-]*)\b([^>]*)>/g)];
  const allowed = new Set([
    "svg",
    "rect",
    "circle",
    "line",
    "text",
    "title",
    "desc",
  ]);
  const attrs = new Set([
    "aria-label",
    "viewBox",
    "role",
    "aria-labelledby",
    "x",
    "y",
    "x1",
    "y1",
    "x2",
    "y2",
    "width",
    "height",
    "rx",
    "class",
    "fill",
    "stroke",
    "stroke-width",
    "xmlns",
  ]);
  const [rootTag, rootName] = tags[0] ?? [];
  const trimmedSvg = svg.trim();
  const hasSelfClosingRoot = rootTag.endsWith("/>");
  const elementStack: string[] = [];
  let rootCount = 0;
  const isSingleSvgDocument = tags.every(([tag, name]) => {
    if (tag.startsWith("</")) return elementStack.pop() === name;
    if (elementStack.length === 0) rootCount += 1;
    if (!tag.endsWith("/>")) elementStack.push(name);
    return rootCount === 1;
  });
  return (
    rootName === "svg" &&
    !rootTag.startsWith("</") &&
    trimmedSvg.startsWith("<svg") &&
    (hasSelfClosingRoot
      ? trimmedSvg === rootTag
      : trimmedSvg.endsWith("</svg>")) &&
    isSingleSvgDocument &&
    elementStack.length === 0 &&
    tags.every(([tag, name, raw]) => {
      const attributeKeys = [...raw.matchAll(/([:\w-]+)\s*=/g)];
      const attributeValues = [...raw.matchAll(/([:\w-]+)\s*=\s*"([^"]*)"/g)];
      const unconsumed = raw
        .replace(/([:\w-]+)\s*=\s*"[^"]*"/g, "")
        .replaceAll("/", "")
        .trim();
      return (
        allowed.has(name) &&
        attributeKeys.length === attributeValues.length &&
        unconsumed.length === 0 &&
        (tag.startsWith("</") ||
          name !== "svg" ||
          attributeValues.some(
            ([, key, value]) =>
              key === "xmlns" && value === "http://www.w3.org/2000/svg",
          )) &&
        attributeValues.every(([, key, value]) => {
          if (!attrs.has(key)) return false;
          if (key === "xmlns")
            return name === "svg" && value === "http://www.w3.org/2000/svg";
          if (key === "fill" || key === "stroke")
            return /^(?:#[0-9a-f]{3,8}|none|transparent|currentColor|[a-z]{3,20})$/i.test(
              value,
            );
          if (key === "stroke-width")
            return /^(?:0|[1-9]\d?)(?:\.\d+)?$/.test(value);
          return true;
        })
      );
    })
  );
}

/** Produces safe log, client-error, and audit views of an internal event. */
export function serializeSafeDiagnostic(_event: Record<string, unknown>): {
  log: Record<string, unknown>;
  clientError: { message: string };
  audit: Record<string, unknown>;
} {
  return {
    log: { event: _event.event ?? "unknown" },
    clientError: { message: "Unable to complete this request." },
    audit: { event: _event.event ?? "unknown" },
  };
}
