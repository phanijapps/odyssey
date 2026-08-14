import { type ReactNode } from "react";

/** Converts plain-text math notation into formatted HTML nodes. */
function formatMath(text: string): ReactNode[] {
  // Process the text in segments, handling:
  // 1. Exponent notation: x^2, 5^-3, 3^{12}
  // 2. Subscripts: x_1, a_n
  // 3. Fractions in context: 1/2, 3/4

  const nodes: ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Look for the next math pattern
    const patterns: Array<{
      regex: RegExp;
      render: (match: RegExpMatchArray) => ReactNode;
    }> = [
      // Exponent with braces: x^{...}
      {
        regex: /([a-zA-Z0-9\)\]])\^\{([^}]+)\}/,
        render: (m) => (
          <span key={key++}>
            {m[1]}
            <sup>{formatMath(m[2])}</sup>
          </span>
        ),
      },
      // Exponent: x^2 or x^-3 or x^12
      {
        regex: /([a-zA-Z0-9\)\]])\^(-?[0-9]+)/,
        render: (m) => (
          <span key={key++}>
            {m[1]}
            <sup>{m[2]}</sup>
          </span>
        ),
      },
      // Exponent with letter: x^n
      {
        regex: /([a-zA-Z0-9\)\]])\^([a-zA-Z])/,
        render: (m) => (
          <span key={key++}>
            {m[1]}
            <sup>{m[2]}</sup>
          </span>
        ),
      },
      // Subscript: x_1, a_n
      {
        regex: /([a-zA-Z])_([a-zA-Z0-9])/,
        render: (m) => (
          <span key={key++}>
            {m[1]}
            <sub>{m[2]}</sub>
          </span>
        ),
      },
      // Simple fraction: number/number (like 1/2, 3/4)
      {
        regex: /(?<![a-zA-Z])(\d+)\/(\d+)(?![a-zA-Z])/,
        render: (m) => (
          <span key={key++} className="math-frac">
            <span className="math-frac-num">{m[1]}</span>
            <span className="math-frac-den">{m[2]}</span>
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
      nodes.push(remaining);
      break;
    }

    // Push text before the match
    if (earliest.index > 0) {
      nodes.push(remaining.slice(0, earliest.index));
    }

    // Push the formatted match
    nodes.push(earliest.render(earliest.match));

    // Continue after the match
    const matchEnd = earliest.index + earliest.match[0].length;
    remaining = remaining.slice(matchEnd);
  }

  return nodes;
}

/** Renders text with inline math formatting (exponents, fractions, subscripts). */
export function MathText({ children }: { children: string }) {
  return <span className="math-text">{formatMath(children)}</span>;
}
