"use client";

import { useEffect, useState } from "react";
import type { PerformanceReport } from "../../server/learning/performance";

/** Renders the server-issued learner performance report. */
export default function PerformancePage() {
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [failed, setFailed] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/performance", {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("unavailable");
        const body = (await response.json()) as { report?: PerformanceReport };
        if (!body.report) throw new Error("invalid report");
        if (!cancelled) setReport(body.report);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed)
    return (
      <main className="performance-page">
        <p role="alert">Performance is unavailable. Please retry.</p>
      </main>
    );
  if (!checked || !report)
    return (
      <main className="performance-page">
        <p>Loading performance…</p>
      </main>
    );

  return (
    <main className="performance-page">
      <div className="a2ui-column">
        <h1>Performance</h1>
        <p className={`a2ui-status a2ui-status-${report.summary.tone}`}>
          {report.summary.text}
        </p>

        <h2>Practice</h2>
        <p
          className={`a2ui-status a2ui-status-${report.practiceEvidence.tone}`}
        >
          {report.practiceEvidence.text}
        </p>
        <p>{report.practiceDetail}</p>

        <h2>Tests</h2>
        <p>{report.testsDetail}</p>

        <h2>Next Practice</h2>
        {report.guidanceCards.length > 0 ? (
          report.guidanceCards.map((card) => (
            <div key={card.id} className="guidance-card">
              <h3 className="guidance-code">{card.standardCode}</h3>
              <p className="guidance-status">{card.statusText}</p>
              {card.topicId && (
                <button
                  className="secondary-btn"
                  onClick={() =>
                    window.location.assign(
                      `/?practice=${encodeURIComponent(card.topicId as string)}`,
                    )
                  }
                >
                  Practice this skill
                </button>
              )}
            </div>
          ))
        ) : (
          <p>{report.guidanceFallback}</p>
        )}

        <h2>Practice achievements</h2>
        <p>{report.achievementsDetail}</p>

        <h2>Math fun fact</h2>
        <p>{report.funFactDetail}</p>

        <p className="eyebrow">{report.separationNote}</p>
      </div>
    </main>
  );
}
