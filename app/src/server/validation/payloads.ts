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
  ]);
  return (
    tags.length > 0 &&
    tags.every(([, name, raw]) => {
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
        attributeValues.every(([, key, value]) => {
          if (!attrs.has(key)) return false;
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
