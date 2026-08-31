"use client";

import { useCallback, useEffect, useState } from "react";
import type { PerformanceReport } from "../../server/learning/performance";

/** Renders the server-issued learner performance report. */
export function PerformanceScreen() {
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [failed, setFailed] = useState(false);
  const [checked, setChecked] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setChecked(false);
    setFailed(false);
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
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (failed)
    return (
      <main className="perf-page">
        <div className="perf-error" role="alert">
          <p>Performance is unavailable. Please retry.</p>
          <button className="secondary-btn" onClick={retry}>
            Retry
          </button>
        </div>
      </main>
    );
  if (!checked || !report)
    return (
      <main className="perf-page">
        <p className="perf-loading">Loading performance…</p>
      </main>
    );

  return (
    <main className="perf-page">
      <a className="perf-back" href="/">
        ← Back to practice
      </a>

      <header className="perf-hero">
        <h1>Performance</h1>
        <p className={`perf-summary ${report.summary.tone}`}>
          {report.summary.text}
        </p>
      </header>

      <section className="perf-card" aria-label="Practice evidence">
        <div className="perf-card-head">
          <h2>Practice</h2>
          <span
            className={`perf-pill ${report.practiceEvidence.tone === "positive" ? "positive" : "neutral"}`}
          >
            {report.practiceEvidence.tone === "positive"
              ? "On track"
              : "Building"}
          </span>
        </div>
        <p className="perf-evidence">{report.practiceEvidence.text}</p>
        <p className="perf-detail">{report.practiceDetail}</p>
      </section>

      <section className="perf-card" aria-label="Tests">
        <div className="perf-card-head">
          <h2>Tests</h2>
        </div>
        <p className="perf-detail">{report.testsDetail}</p>
      </section>

      <section className="perf-guidance" aria-label="Next practice">
        <h2>Next Practice</h2>
        {report.guidanceCards.length > 0 ? (
          report.guidanceCards.map(
            ({ id, standardCode, statusText, topicId }) => (
              <div key={id} className="guidance-card">
                <h3 className="guidance-code">{standardCode}</h3>
                <p className="guidance-status">{statusText}</p>
                {topicId && (
                  <button
                    className="secondary-btn"
                    onClick={() =>
                      window.location.assign(
                        `/?practice=${encodeURIComponent(topicId)}`,
                      )
                    }
                  >
                    Practice this skill
                  </button>
                )}
              </div>
            ),
          )
        ) : (
          <p className="perf-detail">{report.guidanceFallback}</p>
        )}
      </section>

      <div className="perf-duo">
        <section className="perf-card" aria-label="Practice achievements">
          <h2>Practice achievements</h2>
          <p className="perf-detail">{report.achievementsDetail}</p>
        </section>
        <section className="perf-card perf-fun" aria-label="Math fun fact">
          <h2>Math fun fact</h2>
          <p className="perf-detail">{report.funFactDetail}</p>
        </section>
      </div>

      <p className="perf-note">{report.separationNote}</p>
    </main>
  );
}
