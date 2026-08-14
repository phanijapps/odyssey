"use client";

import { useCallback, useEffect, useState } from "react";

/* ============================================================ Types */

type GoldRecord = {
  id: string;
  subject: string;
  framework: string;
  gradeOrCourse: string;
  domain: string;
  cluster: string;
  standardCode: string;
  standardText: string;
  topics: string[];
  source: { documentId: string; page: number };
};

type Stats = {
  totalRecords: number;
  subjects: { subject: string; count: number }[];
  grades: { grade: string; count: number }[];
  domains: { domain: string; count: number }[];
  sources: { source: string; count: number }[];
};

type TopicEntry = { topic: string; count: number };

type Stage =
  | "bronze"
  | "bronze-approved"
  | "silver"
  | "silver-approved"
  | "gold";

type Workflow = {
  readonly id: string;
  readonly stage: Stage;
  readonly bronze?: {
    readonly fileName: string;
    readonly format: string;
    readonly byteSize: number;
    readonly warnings: readonly string[];
  };
  readonly silver?: {
    readonly sourceSummary: string;
    readonly records: readonly unknown[];
    readonly warnings: readonly string[];
  };
};

type ParentSummary = {
  totalAttempts: number;
  totalCorrect: number;
  overallAccuracy: number;
  topics: {
    topicId: string;
    title: string;
    level: number;
    attempts: number;
    correct: number;
    accuracy: number;
    lastAttempt: string | null;
  }[];
  recentAttempts: {
    topicId: string;
    title: string;
    correct: boolean;
    levelBefore: number;
    levelAfter: number;
    createdAt: string;
  }[];
};

type NavItem = "overview" | "browse" | "ingest" | "parent" | "knowledge";

type KgStats = {
  entities: number;
  relationships: number;
  available: boolean;
  kgEntities?: Array<{ id: string; kind: string; name: string }>;
  kgRelationships?: Array<{
    subject: string;
    predicate: string;
    object: string;
  }>;
  learningEntities?: Array<{ id: string; kind: string; name: string }>;
  learningRelationships?: Array<{
    subject: string;
    predicate: string;
    object: string;
  }>;
};
type KgResult = {
  id: string;
  kind: string;
  name: string;
  predicate?: string;
  targetId?: string;
  scope: string;
  score: number;
};

/* ============================================================ Helpers */

const stageLabel: Record<Stage, string> = {
  bronze: "Bronze — awaiting approval",
  "bronze-approved": "Bronze approved",
  silver: "Silver — awaiting approval",
  "silver-approved": "Silver approved",
  gold: "Gold — indexed",
};

const stageAction: Record<
  Exclude<Stage, "gold">,
  { label: string; value: string }
> = {
  bronze: { label: "Approve Bronze", value: "approve-bronze" },
  "bronze-approved": { label: "Generate Silver", value: "generate-silver" },
  silver: { label: "Approve Silver", value: "approve-silver" },
  "silver-approved": { label: "Generate Gold", value: "generate-gold" },
};

const suggestedQueries = [
  "How is my child doing overall?",
  "What topics need the most help?",
  "What are their strongest areas?",
  "Show recent activity",
  "What level are they at in each topic?",
];

/* ============================================================ Component */

export default function DashboardPage() {
  const [nav, setNav] = useState<NavItem>("overview");
  const [adminChecked, setAdminChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Admin gate: dashboard requires an admin session. While checking, render
  // nothing; students/anonymous see the gate card.
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/session", { cache: "no-store" });
        if (res.ok) {
          const account = (await res.json()) as { role?: string };
          setIsAdmin(account.role === "admin");
        } else {
          setIsAdmin(false);
        }
      } catch {
        setIsAdmin(false);
      } finally {
        setAdminChecked(true);
      }
    })();
  }, []);

  // Knowledge graph state
  const [kgStats, setKgStats] = useState<KgStats | null>(null);
  const [kgQuery, setKgQuery] = useState("");
  const [kgResults, setKgResults] = useState<KgResult[]>([]);
  const [kgSearching, setKgSearching] = useState(false);

  // Gold records state
  const [records, setRecords] = useState<GoldRecord[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [topics, setTopics] = useState<TopicEntry[]>([]);
  const [loadingGold, setLoadingGold] = useState(false);
  const [filterSubject, setFilterSubject] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterDomain, setFilterDomain] = useState("");
  const [filterTopic, setFilterTopic] = useState("");
  const [searchText, setSearchText] = useState("");
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);

  // Ingestion state
  const [file, setFile] = useState<File | null>(null);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [ingestPending, setIngestPending] = useState(false);

  // Parent state
  const [parentSummary, setParentSummary] = useState<ParentSummary | null>(
    null,
  );
  const [parentMessage, setParentMessage] = useState("");
  const [parentReply, setParentReply] = useState("");
  const [parentHistory, setParentHistory] = useState<
    { role: "parent" | "system"; text: string }[]
  >([]);

  /* --- Data loading --- */

  const loadGold = useCallback(async () => {
    setLoadingGold(true);
    const params = new URLSearchParams();
    if (filterSubject) params.set("subject", filterSubject);
    if (filterGrade) params.set("grade", filterGrade);
    if (filterDomain) params.set("domain", filterDomain);
    if (filterTopic) params.set("topic", filterTopic);
    if (searchText) params.set("search", searchText);
    try {
      const res = await fetch(`/api/curriculum/gold?${params}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records ?? []);
        setStats(data.stats ?? null);
        setTopics(data.topics ?? []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingGold(false);
    }
  }, [filterSubject, filterGrade, filterDomain, filterTopic, searchText]);

  const loadParent = useCallback(async () => {
    try {
      const res = await fetch("/api/parent/summary", { cache: "no-store" });
      if (res.ok) setParentSummary(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadGold();
    void loadParent();
    void loadKg();
  }, [loadGold, loadParent]);

  const loadKg = useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge", { cache: "no-store" });
      if (res.ok) setKgStats(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  const kgSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setKgResults([]);
      return;
    }
    setKgSearching(true);
    try {
      const res = await fetch(`/api/knowledge?q=${encodeURIComponent(query)}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setKgResults(data.results ?? []);
      }
    } catch {
      /* ignore */
    } finally {
      setKgSearching(false);
    }
  }, []);

  /* --- Ingestion actions --- */

  async function submitIngest() {
    if (!file) return;
    setIngestPending(true);
    setIngestError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/curriculum/ingestions", {
        method: "POST",
        body: form,
      });
      const body = (await res.json()) as Workflow & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Unable to validate source");
      setWorkflow(body);
    } catch (cause) {
      setIngestError(
        cause instanceof Error ? cause.message : "Unable to validate source",
      );
    } finally {
      setIngestPending(false);
    }
  }

  async function advanceIngest() {
    if (!workflow || workflow.stage === "gold") return;
    setIngestPending(true);
    setIngestError(null);
    try {
      const res = await fetch(
        `/api/curriculum/ingestions/${workflow.id}/actions`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: stageAction[workflow.stage].value,
          }),
        },
      );
      const body = (await res.json()) as Workflow & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Unable to advance workflow");
      setWorkflow(body);
      if (body.stage === "gold") await loadGold();
    } catch (cause) {
      setIngestError(
        cause instanceof Error ? cause.message : "Unable to advance workflow",
      );
    } finally {
      setIngestPending(false);
    }
  }

  async function deleteRecord(id: string) {
    const res = await fetch("/api/curriculum/gold", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recordId: id }),
    });
    if (res.ok) {
      await loadGold();
      setExpandedRecord(null);
    }
  }

  /* --- Parent query actions --- */

  async function askParent(message: string) {
    if (!message.trim()) return;
    setParentHistory((prev) => [...prev, { role: "parent", text: message }]);
    setParentMessage("");
    setParentReply("");
    try {
      const res = await fetch("/api/parent/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      const reply = data.reply ?? data.error ?? "Unable to answer";
      setParentReply(reply);
      setParentHistory((prev) => [...prev, { role: "system", text: reply }]);
    } catch {
      const err = "Unable to connect";
      setParentReply(err);
      setParentHistory((prev) => [...prev, { role: "system", text: err }]);
    }
    await loadParent();
  }

  function resetFilters() {
    setFilterSubject("");
    setFilterGrade("");
    setFilterDomain("");
    setFilterTopic("");
    setSearchText("");
  }

  const activeFilterCount = [
    filterSubject,
    filterGrade,
    filterDomain,
    filterTopic,
    searchText,
  ].filter(Boolean).length;

  /* ============================================================ Render */

  return (
    <div className="app-shell">
      {!adminChecked ? null : !isAdmin ? (
        <div className="admin-gate">
          <div className="dash-card admin-gate-card">
            <h1>Admin access required</h1>
            <p>
              The curriculum dashboard is restricted to admin accounts. Sign in
              as an administrator, or return to practice.
            </p>
            <div className="admin-gate-actions">
              <a href="/" className="primary-btn">
                Go to practice
              </a>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* ---- Sidebar ---- */}
          <aside className="app-sidebar">
            <div className="sidebar-brand">
              <span className="brand-logo">O</span>
              <span className="brand-name">Odyssey</span>
            </div>
            <nav className="sidebar-nav">
              <button
                className={nav === "overview" ? "nav-item active" : "nav-item"}
                onClick={() => setNav("overview")}
              >
                <span className="nav-icon">◈</span>
                Overview
              </button>
              <button
                className={nav === "browse" ? "nav-item active" : "nav-item"}
                onClick={() => setNav("browse")}
              >
                <span className="nav-icon">▦</span>
                Browse Gold
                {stats && (
                  <span className="nav-badge">{stats.totalRecords}</span>
                )}
              </button>
              <button
                className={nav === "ingest" ? "nav-item active" : "nav-item"}
                onClick={() => setNav("ingest")}
              >
                <span className="nav-icon">↑</span>
                Ingest Source
              </button>
              <button
                className={nav === "parent" ? "nav-item active" : "nav-item"}
                onClick={() => setNav("parent")}
              >
                <span className="nav-icon">♥</span>
                Parent Portal
              </button>
              <button
                className={nav === "knowledge" ? "nav-item active" : "nav-item"}
                onClick={() => setNav("knowledge")}
              >
                <span className="nav-icon">◉</span>
                Knowledge Graph
              </button>
            </nav>
            <div className="sidebar-footer">
              <a href="/" className="nav-item">
                <span className="nav-icon">←</span>
                Practice
              </a>
            </div>
          </aside>

          {/* ---- Main ---- */}
          <div className="app-main">
            <header className="app-header">
              <h1 className="page-title">
                {nav === "overview" && "Overview"}
                {nav === "browse" && "Browse Gold Records"}
                {nav === "ingest" && "Ingest Curriculum Source"}
                {nav === "parent" && "Parent Portal"}
                {nav === "knowledge" && "Knowledge Graph"}
              </h1>
            </header>
            <div className="app-content">
              {/* ========== OVERVIEW ========== */}
              {nav === "overview" && (
                <>
                  <div className="card-grid">
                    <div className="dash-card stat-card">
                      <span className="stat-number">
                        {stats?.totalRecords ?? 0}
                      </span>
                      <span className="stat-label">Gold Records</span>
                    </div>
                    <div className="dash-card stat-card">
                      <span className="stat-number">
                        {stats?.subjects.length ?? 0}
                      </span>
                      <span className="stat-label">Subjects</span>
                    </div>
                    <div className="dash-card stat-card">
                      <span className="stat-number">
                        {stats?.grades.length ?? 0}
                      </span>
                      <span className="stat-label">Grade Levels</span>
                    </div>
                    <div className="dash-card stat-card">
                      <span className="stat-number">
                        {stats?.sources.length ?? 0}
                      </span>
                      <span className="stat-label">Sources</span>
                    </div>
                  </div>

                  {parentSummary && parentSummary.totalAttempts > 0 && (
                    <div className="dash-card section-card">
                      <div className="section-header">
                        <h2>Practice at a Glance</h2>
                        <button
                          className="link-btn-inline"
                          onClick={() => setNav("parent")}
                        >
                          View details →
                        </button>
                      </div>
                      <div className="mini-stats">
                        <div className="mini-stat">
                          <strong>{parentSummary.totalAttempts}</strong>
                          <small>Attempts</small>
                        </div>
                        <div className="mini-stat">
                          <strong>{parentSummary.overallAccuracy}%</strong>
                          <small>Accuracy</small>
                        </div>
                        <div className="mini-stat">
                          <strong>{parentSummary.topics.length}</strong>
                          <small>Topics</small>
                        </div>
                      </div>
                    </div>
                  )}

                  {stats && stats.subjects.length > 0 && (
                    <div className="dash-card section-card">
                      <h2 className="section-title">By Subject</h2>
                      <div className="chip-row">
                        {stats.subjects.map((s) => (
                          <button
                            key={s.subject}
                            className="filter-chip"
                            onClick={() => {
                              setFilterSubject(s.subject);
                              setNav("browse");
                            }}
                          >
                            {s.subject} ({s.count})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {stats && stats.grades.length > 0 && (
                    <div className="dash-card section-card">
                      <h2 className="section-title">By Grade</h2>
                      <div className="chip-row">
                        {stats.grades.map((g) => (
                          <button
                            key={g.grade}
                            className="filter-chip"
                            onClick={() => {
                              setFilterGrade(g.grade);
                              setNav("browse");
                            }}
                          >
                            {g.grade} ({g.count})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {stats && stats.domains.length > 0 && (
                    <div className="dash-card section-card">
                      <h2 className="section-title">By Domain</h2>
                      <div className="chip-row">
                        {stats.domains.map((d) => (
                          <button
                            key={d.domain}
                            className="filter-chip"
                            onClick={() => {
                              setFilterDomain(d.domain);
                              setNav("browse");
                            }}
                          >
                            {d.domain} ({d.count})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {topics.length > 0 && (
                    <div className="dash-card section-card">
                      <h2 className="section-title">By Topic</h2>
                      <div className="chip-row">
                        {topics.slice(0, 30).map((t) => (
                          <button
                            key={t.topic}
                            className="filter-chip"
                            onClick={() => {
                              setFilterTopic(t.topic);
                              setNav("browse");
                            }}
                          >
                            {t.topic} ({t.count})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ========== BROWSE GOLD ========== */}
              {nav === "browse" && (
                <>
                  <div className="dash-card filter-card">
                    <div className="filter-bar">
                      <select
                        value={filterSubject}
                        onChange={(e) => setFilterSubject(e.target.value)}
                      >
                        <option value="">All Subjects</option>
                        {stats?.subjects.map((s) => (
                          <option key={s.subject} value={s.subject}>
                            {s.subject} ({s.count})
                          </option>
                        ))}
                      </select>
                      <select
                        value={filterGrade}
                        onChange={(e) => setFilterGrade(e.target.value)}
                      >
                        <option value="">All Grades</option>
                        {stats?.grades.map((g) => (
                          <option key={g.grade} value={g.grade}>
                            {g.grade} ({g.count})
                          </option>
                        ))}
                      </select>
                      <select
                        value={filterDomain}
                        onChange={(e) => setFilterDomain(e.target.value)}
                      >
                        <option value="">All Domains</option>
                        {stats?.domains.map((d) => (
                          <option key={d.domain} value={d.domain}>
                            {d.domain} ({d.count})
                          </option>
                        ))}
                      </select>
                      <select
                        value={filterTopic}
                        onChange={(e) => setFilterTopic(e.target.value)}
                      >
                        <option value="">All Topics</option>
                        {topics.map((t) => (
                          <option key={t.topic} value={t.topic}>
                            {t.topic} ({t.count})
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Search standards…"
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                      />
                      {activeFilterCount > 0 && (
                        <button className="clear-btn" onClick={resetFilters}>
                          Clear ({activeFilterCount})
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="result-meta">
                    {loadingGold ? "Loading…" : `${records.length} records`}
                  </div>

                  <div className="record-list">
                    {records.map((r) => (
                      <div
                        key={r.id}
                        className={`dash-card record-card ${
                          expandedRecord === r.id ? "expanded" : ""
                        }`}
                      >
                        <div
                          className="record-header"
                          onClick={() =>
                            setExpandedRecord(
                              expandedRecord === r.id ? null : r.id,
                            )
                          }
                        >
                          <div className="record-main">
                            <span className="record-code">
                              {r.standardCode}
                            </span>
                            <span className="record-grade">
                              {r.gradeOrCourse}
                            </span>
                            <span className="record-domain">{r.domain}</span>
                          </div>
                          <span className="record-count">
                            {r.topics.length} topics · p.{r.source.page}
                          </span>
                        </div>
                        <p className="record-text">{r.standardText}</p>
                        {r.topics.length > 0 && (
                          <div className="record-topics">
                            {r.topics.map((t) => (
                              <span key={t} className="topic-tag">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                        {expandedRecord === r.id && (
                          <div className="record-detail">
                            <dl>
                              <dt>ID</dt>
                              <dd>{r.id}</dd>
                              <dt>Framework</dt>
                              <dd>{r.framework}</dd>
                              <dt>Cluster</dt>
                              <dd>{r.cluster}</dd>
                              <dt>Source</dt>
                              <dd>
                                {r.source.documentId} (page {r.source.page})
                              </dd>
                              {r.topics.length > 0 && (
                                <>
                                  <dt>Topics</dt>
                                  <dd>{r.topics.join(", ")}</dd>
                                </>
                              )}
                            </dl>
                            <button
                              className="delete-btn"
                              onClick={() => void deleteRecord(r.id)}
                            >
                              Delete record
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    {records.length === 0 && !loadingGold && (
                      <div className="empty-state">
                        <p>No Gold records found.</p>
                        <p>Adjust filters or ingest a new source.</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ========== INGEST ========== */}
              {nav === "ingest" && (
                <div className="dash-card ingest-panel">
                  <p className="ingest-hint">
                    Upload a PDF, CSV, JSON, or text file containing curriculum
                    standards. The Bronze → Silver → Gold pipeline extracts and
                    formalizes standards with human approval at each stage.
                  </p>
                  {!workflow ? (
                    <div className="upload-zone">
                      <label className="upload-label">
                        <input
                          type="file"
                          accept=".pdf,.csv,.json,.txt,text/plain,application/pdf,text/csv,application/json"
                          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                        />
                        <span>{file ? file.name : "Choose a file…"}</span>
                      </label>
                      <button
                        className="primary-btn"
                        disabled={!file || ingestPending}
                        onClick={() => void submitIngest()}
                      >
                        {ingestPending ? "Validating…" : "Upload Source"}
                      </button>
                    </div>
                  ) : (
                    <div className="workflow-panel">
                      <div className="workflow-stage">
                        <span className={`stage-badge stage-${workflow.stage}`}>
                          {stageLabel[workflow.stage]}
                        </span>
                      </div>
                      {workflow.bronze && (
                        <div className="workflow-info">
                          <strong>{workflow.bronze.fileName}</strong>
                          <span>
                            {" "}
                            {workflow.bronze.format.toUpperCase()} ·{" "}
                            {workflow.bronze.byteSize.toLocaleString()} bytes
                          </span>
                        </div>
                      )}
                      {workflow.silver && (
                        <div className="workflow-info">
                          <strong>Silver candidate:</strong>{" "}
                          {workflow.silver.records.length} records extracted
                        </div>
                      )}
                      {ingestError && (
                        <p className="error-text">{ingestError}</p>
                      )}
                      {workflow.stage !== "gold" && (
                        <button
                          className="primary-btn"
                          disabled={ingestPending}
                          onClick={() => void advanceIngest()}
                        >
                          {ingestPending
                            ? "Working… (LLM calls may take minutes)"
                            : stageAction[workflow.stage].label}
                        </button>
                      )}
                      {workflow.stage === "gold" && (
                        <div className="success-box">
                          ✓ Gold records indexed successfully.
                          <button
                            className="link-btn"
                            onClick={() => {
                              setWorkflow(null);
                              setFile(null);
                              void loadGold();
                              setNav("browse");
                            }}
                          >
                            View records →
                          </button>
                        </div>
                      )}
                      <button
                        className="secondary-btn"
                        onClick={() => {
                          setWorkflow(null);
                          setFile(null);
                          setIngestError(null);
                        }}
                      >
                        Start new upload
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ========== PARENT PORTAL ========== */}
              {nav === "parent" && (
                <>
                  {/* Stats */}
                  <div className="card-grid">
                    <div className="dash-card stat-card">
                      <span className="stat-number">
                        {parentSummary?.totalAttempts ?? 0}
                      </span>
                      <span className="stat-label">Total Attempts</span>
                    </div>
                    <div className="dash-card stat-card">
                      <span className="stat-number">
                        {parentSummary?.overallAccuracy ?? 0}%
                      </span>
                      <span className="stat-label">Accuracy</span>
                    </div>
                    <div className="dash-card stat-card">
                      <span className="stat-number">
                        {parentSummary?.totalCorrect ?? 0}
                      </span>
                      <span className="stat-label">Correct Answers</span>
                    </div>
                    <div className="dash-card stat-card">
                      <span className="stat-number">
                        {parentSummary?.topics.length ?? 0}
                      </span>
                      <span className="stat-label">Topics Practiced</span>
                    </div>
                  </div>

                  {/* Topic breakdown */}
                  {parentSummary && parentSummary.topics.length > 0 && (
                    <div className="dash-card section-card">
                      <h2 className="section-title">Topic Performance</h2>
                      <div className="topic-table">
                        <div className="topic-table-header">
                          <span>Topic</span>
                          <span>Accuracy</span>
                          <span>Level</span>
                          <span>Attempts</span>
                        </div>
                        {parentSummary.topics.map((t) => (
                          <div key={t.topicId} className="topic-table-row">
                            <span className="topic-name">{t.title}</span>
                            <span className="topic-acc">
                              <div className="acc-bar-wrap">
                                <div
                                  className="acc-bar"
                                  style={{
                                    width: `${t.accuracy}%`,
                                    background:
                                      t.accuracy >= 75
                                        ? "#2d6a4f"
                                        : t.accuracy >= 50
                                          ? "#d4a72c"
                                          : "#c63131",
                                  }}
                                />
                              </div>
                              <span className="acc-pct">{t.accuracy}%</span>
                            </span>
                            <span className="topic-level">L{t.level}</span>
                            <span className="topic-attempts">{t.attempts}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Query interface */}
                  <div className="dash-card section-card">
                    <div className="section-header">
                      <h2>Ask About Progress</h2>
                    </div>

                    <div className="suggested-queries">
                      {suggestedQueries.map((q) => (
                        <button
                          key={q}
                          className="suggestion-chip"
                          onClick={() => void askParent(q)}
                        >
                          {q}
                        </button>
                      ))}
                    </div>

                    <div className="chat-history">
                      {parentHistory.length === 0 && (
                        <p className="chat-placeholder">
                          Ask a question or pick a suggestion above. I'll answer
                          based on your child's practice data.
                        </p>
                      )}
                      {parentHistory.map((msg, i) => (
                        <div
                          key={i}
                          className={
                            msg.role === "parent"
                              ? "chat-msg chat-parent"
                              : "chat-msg chat-system"
                          }
                        >
                          {msg.role === "parent" ? "You: " : ""}
                          {msg.text}
                        </div>
                      ))}
                    </div>

                    <form
                      className="chat-input-row"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void askParent(parentMessage);
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Ask about your child's progress…"
                        value={parentMessage}
                        onChange={(e) => setParentMessage(e.target.value)}
                        maxLength={500}
                      />
                      <button type="submit" className="primary-btn">
                        Ask
                      </button>
                    </form>
                  </div>

                  {/* Recent activity */}
                  {parentSummary && parentSummary.recentAttempts.length > 0 && (
                    <div className="dash-card section-card">
                      <h2 className="section-title">Recent Activity</h2>
                      <div className="activity-list">
                        {parentSummary.recentAttempts
                          .slice(0, 15)
                          .map((a, i) => (
                            <div key={i} className="activity-item">
                              <span
                                className={
                                  a.correct
                                    ? "activity-dot correct"
                                    : "activity-dot incorrect"
                                }
                              >
                                {a.correct ? "✓" : "✗"}
                              </span>
                              <div className="activity-info">
                                <span className="activity-topic">
                                  {a.title}
                                </span>
                                <span className="activity-meta">
                                  Level {a.levelAfter}
                                </span>
                              </div>
                              <span className="activity-time">
                                {new Date(a.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {parentSummary?.totalAttempts === 0 && (
                    <div className="dash-card empty-state">
                      <p>No practice activity recorded yet.</p>
                      <p>
                        Practice data will appear here once your child starts.
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* ========== KNOWLEDGE GRAPH ========== */}
              {nav === "knowledge" && (
                <>
                  <div className="card-grid">
                    <div className="dash-card stat-card">
                      <span className="stat-number">
                        {kgStats?.entities ?? 0}
                      </span>
                      <span className="stat-label">Graph Entities</span>
                    </div>
                    <div className="dash-card stat-card">
                      <span className="stat-number">
                        {kgStats?.relationships ?? 0}
                      </span>
                      <span className="stat-label">Relationships</span>
                    </div>
                    <div className="dash-card stat-card">
                      <span className="stat-number">
                        {kgStats?.available ? "✓" : "✗"}
                      </span>
                      <span className="stat-label">Engram Connected</span>
                    </div>
                  </div>

                  {kgStats?.learningRelationships &&
                    kgStats.learningRelationships.length > 0 && (
                      <div className="dash-card section-card">
                        <h2 className="section-title">
                          Recent Learning Patterns
                        </h2>
                        <div className="record-list">
                          {kgStats.learningRelationships
                            .slice()
                            .reverse()
                            .slice(0, 10)
                            .map((r, i) => (
                              <div key={i} className="kg-edge">
                                <span className="kg-node">{r.subject}</span>
                                <span
                                  className={
                                    r.predicate === "masteredStep"
                                      ? "kg-pred good"
                                      : "kg-pred bad"
                                  }
                                >
                                  {r.predicate}
                                </span>
                                <span className="kg-node">{r.object}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                  {kgStats?.kgRelationships &&
                    kgStats.kgRelationships.length > 0 && (
                      <div className="dash-card section-card">
                        <h2 className="section-title">
                          Curriculum Prerequisites
                        </h2>
                        <div className="record-list">
                          {kgStats.kgRelationships.slice(0, 15).map((r, i) => (
                            <div key={i} className="kg-edge">
                              <span className="kg-node">{r.subject}</span>
                              <span className="kg-pred">{r.predicate}</span>
                              <span className="kg-node">{r.object}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  <div className="dash-card section-card">
                    <div className="section-header">
                      <h2>Search the Knowledge Graph</h2>
                      <button
                        className="link-btn-inline"
                        onClick={async () => {
                          await fetch("/api/knowledge", { method: "POST" });
                          await loadKg();
                        }}
                      >
                        Re-seed curriculum →
                      </button>
                    </div>
                    <form
                      className="chat-input-row"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void kgSearch(kgQuery);
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Search standards, attempts, patterns… (e.g. 6.RP.1, struggledOn, ratio)"
                        value={kgQuery}
                        onChange={(e) => setKgQuery(e.target.value)}
                      />
                      <button type="submit" className="primary-btn">
                        {kgSearching ? "…" : "Search"}
                      </button>
                    </form>

                    {kgResults.length > 0 && (
                      <p className="result-meta">{kgResults.length} results</p>
                    )}
                    <div className="record-list">
                      {kgResults.map((r) => (
                        <div
                          key={`${r.scope}-${r.id}`}
                          className="dash-card record-card"
                        >
                          <div className="record-header">
                            <div className="record-main">
                              <span className="record-code">{r.kind}</span>
                              <span className="record-grade">{r.scope}</span>
                            </div>
                            <span className="record-count">
                              score {r.score}
                            </span>
                          </div>
                          <p className="record-text">{r.name}</p>
                        </div>
                      ))}
                      {kgQuery && kgResults.length === 0 && !kgSearching && (
                        <p className="result-meta">No matches.</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
