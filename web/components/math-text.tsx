import { type ReactNode } from "react";

/* ============================================================
   Math formatting: exponents, fractions, subscripts
   ============================================================ */

function formatMath(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const patterns: Array<{
      regex: RegExp;
      render: (match: RegExpMatchArray) => ReactNode;
    }> = [
      {
        regex: /([a-zA-Z0-9\)\]])\^\{([^}]+)\}/,
        render: (m) => (
          <span key={key++}>
            {m[1]}
            <sup>{formatMath(m[2])}</sup>
          </span>
        ),
      },
      {
        regex: /([a-zA-Z0-9\)\]])\^(-?[0-9]+)/,
        render: (m) => (
          <span key={key++}>
            {m[1]}
            <sup>{m[2]}</sup>
          </span>
        ),
      },
      {
        regex: /([a-zA-Z0-9\)\]])\^([a-zA-Z])/,
        render: (m) => (
          <span key={key++}>
            {m[1]}
            <sup>{m[2]}</sup>
          </span>
        ),
      },
      {
        regex: /([a-zA-Z])_([a-zA-Z0-9])/,
        render: (m) => (
          <span key={key++}>
            {m[1]}
            <sub>{m[2]}</sub>
          </span>
        ),
      },
    ];

    let earliest: {
      index: number;
      match: RegExpMatchArray;
      render: (m: RegExpMatchArray) => ReactNode;
    } | null = null;

    for (const p of patterns) {
      const m = remaining.match(p.regex);
      if (m && m.index !== undefined) {
        if (!earliest || m.index < earliest.index) {
          earliest = { index: m.index, match: m, render: p.render };
        }
      }
    }

    if (!earliest) {
      nodes.push(highlightKeyValues(remaining, () => key++));
      break;
    }

    if (earliest.index > 0) {
      nodes.push(
        highlightKeyValues(remaining.slice(0, earliest.index), () => key++),
      );
    }
    nodes.push(earliest.render(earliest.match));
    remaining = remaining.slice(earliest.index + earliest.match[0].length);
  }

  return nodes;
}

/* ============================================================
   Key-value highlighting: numbers, units, variables, operators
   ============================================================ */

const UNIT_WORDS =
  /\b(cm|mm|m|km|in|ft|feet|inch(?:es)?|yd|yards?|mi|miles?|kg|g|lb|lbs|pounds?|oz|L|mL|cups?|tbsp|tsp|hours?|hrs?|minutes?|mins?|seconds?|secs?|days?|weeks?|dollars?|cents?|percent|%|mph|degrees?|°)\b/gi;

/** Wraps key values in styled spans: numbers, units, variables, operators. */
function highlightKeyValues(text: string, nextKey: () => number): ReactNode {
  if (!text) return text;
  const parts: ReactNode[] = [];
  // Pattern order: figure refs, numbers (incl. decimals/negatives/percent),
  // variables (single letter bounded), units, operators.
  const token =
    /\b(?:Figure|Triangle|Graph|Table|Shape)\s+[A-Z](?:'?[A-Z]?)?|(?<![\w$])(?:x|y|n|m|t)(?![\w$])|-?\d+(?:\.\d+)?(?:%|°)?|×|÷|−/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  const rx = new RegExp(token.source, "gi");
  while ((m = rx.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    const key = nextKey();
    if (/^[-\d]/.test(tok)) {
      parts.push(
        <span key={key} className="kv-num">
          {tok}
        </span>,
      );
    } else if (/^(?:×|÷|−)$/.test(tok)) {
      parts.push(
        <span key={key} className="kv-op">
          {tok}
        </span>,
      );
    } else if (/^(Figure|Triangle|Graph|Table|Shape)/i.test(tok)) {
      parts.push(
        <span key={key} className="kv-fig">
          {tok}
        </span>,
      );
    } else {
      // single-letter variable
      parts.push(
        <span key={key} className="kv-var">
          {tok}
        </span>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));

  // Post-pass: attach units to the preceding highlighted number? Keep simple —
  // units get their own subtle styling within remaining text is complex; skip
  // separate unit pass to avoid double-processing.
  return parts.length === 1 ? parts[0] : parts;
}

/** Renders text with inline math formatting and key-value highlighting. */
export function MathText({ children }: { children: string }) {
  return <span className="math-text">{formatMath(children)}</span>;
}
