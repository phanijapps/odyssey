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

/** Normalizes and validates a provider diagram, or fails closed. */
export function sanitizeGeneratedDiagramSvg(raw: string): string {
  const normalized = raw.replace(
    /font-size="([\d.]+)(px)?"/g,
    (_match: string, size: string) =>
      `font-size="${(Number.parseFloat(size) * 0.9).toFixed(1)}"`,
  );
  try {
    validateLearningPayload({
      component: "GeometryDiagram",
      diagramSvg: normalized,
    });
    return normalized;
  } catch {
    return "";
  }
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
    "ellipse",
    "line",
    "polygon",
    "polyline",
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
    "cx",
    "cy",
    "r",
    "rx",
    "ry",
    "points",
    "width",
    "height",
    "rx",
    "class",
    "fill",
    "stroke",
    "stroke-width",
    "stroke-dasharray",
    "stroke-linecap",
    "stroke-linejoin",
    "font-size",
    "font-family",
    "font-weight",
    "text-anchor",
    "dominant-baseline",
    "opacity",
    "transform",
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
            return /^(?:#[0-9a-f]{3,8}|rgba?\([\d.,\s%]+\)|hsla?\([\d.,\s%deg]+\)|none|transparent|currentColor|[a-z]{3,20})$/i.test(
              value,
            );
          if (key === "stroke-width")
            return /^(?:0|[1-9]\d?)(?:\.\d+)?$/.test(value);
          if (key === "stroke-dasharray") return /^[\d.,\s]+$/.test(value);
          if (key === "font-size" || key === "opacity")
            return /^[\d.]+(?:px|em|rem)?$/.test(value);
          if (key === "transform") return /^[a-zA-Z0-9(),.\s-]+$/.test(value);
          return true;
        })
      );
    })
  );
}
