"use client";

import { useCallback, useEffect, useState } from "react";
import { OdysseyA2uiSurface } from "../a2ui-surface";
import {
  parseOdysseyA2uiDocument,
  type OdysseyA2uiDocument,
} from "../../a2ui/document";

/** Learner-only Performance view; all evidence and UI components are server-issued. */
export default function PerformancePage() {
  const [document, setDocument] = useState<OdysseyA2uiDocument | null>(null);
  const [error, setError] = useState("");

  const loadPerformance = useCallback(async () => {
    setError("");
    setDocument(null);
    try {
      const response = await fetch("/api/performance", { cache: "no-store" });
      if (response.status === 401 || response.status === 403) {
        window.location.assign("/");
        return;
      }
      if (!response.ok) {
        setError("Performance is unavailable. Please retry.");
        return;
      }
      const body = (await response.json()) as { document?: unknown };
      setDocument(parseOdysseyA2uiDocument(body.document));
    } catch {
      setError("Performance is unavailable. Please retry.");
    }
  }, []);

  useEffect(() => {
    void loadPerformance();
  }, [loadPerformance]);

  return (
    <main className="shell">
      <header className="topbar">
        <a className="wordmark" href="/">
          <span className="small-mark">O</span>
          Odyssey
        </a>
        <span className="eyebrow">LEARNER PERFORMANCE</span>
      </header>
      <div className="narrow-page">
        <section
          className="dash-card"
          aria-busy={!document && !error}
          aria-label="Performance"
        >
          {error ? (
            <div role="alert">
              <p className="error-text">{error}</p>
              <div className="action-row">
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => void loadPerformance()}
                >
                  Retry
                </button>
              </div>
            </div>
          ) : document ? (
            <OdysseyA2uiSurface
              document={document}
              onPracticeTarget={(topicId) => {
                window.location.assign(
                  `/?practice=${encodeURIComponent(topicId)}`,
                );
              }}
            />
          ) : (
            <p role="status" className="result-meta">
              Loading performance…
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
