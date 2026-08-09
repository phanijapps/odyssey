"use client";

import { useState } from "react";

type Stage =
  | "bronze"
  | "bronze-approved"
  | "silver"
  | "silver-approved"
  | "gold";

const stageLabel: Record<Stage, string> = {
  bronze: "Bronze awaiting approval",
  "bronze-approved": "Bronze approved",
  silver: "Silver awaiting approval",
  "silver-approved": "Silver approved",
  gold: "Gold indexed",
};

/** Desktop-only steward workflow for source promotion. */
export default function IngestionPage() {
  const [stage, setStage] = useState<Stage>("bronze");
  const next = () =>
    setStage((current) =>
      current === "bronze"
        ? "bronze-approved"
        : current === "bronze-approved"
          ? "silver"
          : current === "silver"
            ? "silver-approved"
            : "gold",
    );
  const action =
    stage === "bronze"
      ? "Approve Bronze"
      : stage === "bronze-approved"
        ? "Ingest to Silver"
        : stage === "silver"
          ? "Approve Silver"
          : stage === "silver-approved"
            ? "Ingest to Gold"
            : "Gold indexed";
  return (
    <main className="portal-shell">
      <header className="topbar">
        <div className="wordmark">
          <span className="small-mark">O</span>Odyssey · Curriculum
        </div>
        <span className="profile-chip">Desktop steward</span>
      </header>
      <section className="portal-grid">
        <aside className="sidebar">
          <p className="eyebrow">INGESTION</p>
          <h2>One source at a time.</h2>
          <p className="memory-state">
            Gold alone can generate questions and semantic search results.
          </p>
        </aside>
        <section className="practice-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">SOURCE PROMOTION</p>
              <h1>Curriculum intake</h1>
            </div>
            <span className="step-label">{stageLabel[stage]}</span>
          </div>
          <div className="question-card">
            <h2>Submitted source</h2>
            <p>
              Source document · validated provenance · extraction remains
              reviewable until Gold.
            </p>
            <div className="progress-card">
              <span className="progress-ring">
                {stage === "gold"
                  ? "G"
                  : stage.startsWith("silver")
                    ? "S"
                    : "B"}
              </span>
              <div>
                <strong>{stageLabel[stage]}</strong>
                <small>Bronze → approval → Silver → approval → Gold</small>
              </div>
            </div>
            <p className="hint">
              Extraction and formalization Pi agents cannot approve promotions.
            </p>
            <button
              className="primary-button"
              type="button"
              onClick={next}
              disabled={stage === "gold"}
            >
              {action}
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}
