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

type NavItem = "overview" | "browse" | "parents" | "health";

type ParentAccount = {
  accountId: string;
  username: string;
  children: Array<{ username: string }>;
};

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

  // Health state
  const [health, setHealth] = useState<{
    schemaVersion: number;
    catalogRecords: number;
    generatorConfigured: boolean;
  } | null>(null);
  const [backupResult, setBackupResult] = useState("");
  const [backupPending, setBackupPending] = useState(false);

  // Parent management state
  const [parents, setParents] = useState<ParentAccount[]>([]);
  const [parentUsername, setParentUsername] = useState("");
  const [parentPassword, setParentPassword] = useState("");
  const [parentsError, setParentsError] = useState<string | null>(null);
  const [parentsPending, setParentsPending] = useState(false);
  const [resetTarget, setResetTarget] = useState<string | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");

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

  const loadParents = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/parents", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { parents?: ParentAccount[] };
        setParents(data.parents ?? []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadGold();
    void loadParents();
  }, [loadGold, loadParents]);

  const loadHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/health", { cache: "no-store" });
      if (res.ok) setHealth(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  async function runBackup() {
    setBackupPending(true);
    setBackupResult("");
    try {
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        headers: { origin: window.location.origin },
      });
      const body = (await res.json()) as { file?: string; error?: string };
      setBackupResult(
        res.ok && body.file
          ? `Saved ${body.file}`
          : (body.error ?? "Backup failed"),
      );
    } catch {
      setBackupResult("Backup failed");
    } finally {
      setBackupPending(false);
    }
  }

  /* --- Parent management actions --- */

  async function createParent(event: React.FormEvent) {
    event.preventDefault();
    setParentsPending(true);
    setParentsError(null);
    try {
      const res = await fetch("/api/admin/parents", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: window.location.origin,
        },
        body: JSON.stringify({
          username: parentUsername,
          password: parentPassword,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Unable to create parent");
      setParentUsername("");
      setParentPassword("");
      await loadParents();
    } catch (cause) {
      setParentsError(
        cause instanceof Error ? cause.message : "Unable to create parent",
      );
    } finally {
      setParentsPending(false);
    }
  }

  async function resetParentPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!resetTarget) return;
    setParentsPending(true);
    setParentsError(null);
    try {
      const res = await fetch(`/api/admin/parents/${resetTarget}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: window.location.origin,
        },
        body: JSON.stringify({ password: resetPasswordValue }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Unable to reset password");
      setResetTarget(null);
      setResetPasswordValue("");
    } catch (cause) {
      setParentsError(
        cause instanceof Error ? cause.message : "Unable to reset password",
      );
    } finally {
      setParentsPending(false);
    }
  }

  /* --- Parent query actions --- */

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
                className={nav === "parents" ? "nav-item active" : "nav-item"}
                onClick={() => setNav("parents")}
              >
                <span className="nav-icon">⌘</span>
                Parents
                {parents.length > 0 && (
                  <span className="nav-badge">{parents.length}</span>
                )}
              </button>
              <button
                className={nav === "health" ? "nav-item active" : "nav-item"}
                onClick={() => {
                  setNav("health");
                  void loadHealth();
                }}
              >
                <span className="nav-icon">♥</span>
                Health
              </button>
            </nav>
            <div className="sidebar-footer">
              <a href="/" className="nav-item">
                <span className="nav-icon">←</span>
                Practice
              </a>
              <button
                type="button"
                className="nav-item"
                onClick={async () => {
                  await fetch("/api/session", { method: "DELETE" });
                  window.location.assign("/");
                }}
              >
                <span className="nav-icon">⏻</span>
                Sign out
              </button>
            </div>
          </aside>

          {/* ---- Main ---- */}
          <div className="app-main">
            <header className="app-header">
              <h1 className="page-title">
                {nav === "overview" && "Overview"}
                {nav === "browse" && "Browse Gold Records"}
                {nav === "parents" && "Manage Parents"}
                {nav === "health" && "System Health"}
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
                          </div>
                        )}
                      </div>
                    ))}
                    {records.length === 0 && !loadingGold && (
                      <div className="empty-state">
                        <p>No Gold records found.</p>
                        <p>Adjust the filters above.</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ========== HEALTH ========== */}
              {nav === "health" && (
                <>
                  <div className="card-grid">
                    <div className="dash-card stat-card">
                      <span className="stat-number">
                        {health ? `v${health.schemaVersion}` : "…"}
                      </span>
                      <span className="stat-label">Database schema</span>
                    </div>
                    <div className="dash-card stat-card">
                      <span className="stat-number">
                        {health ? health.catalogRecords : "…"}
                      </span>
                      <span className="stat-label">Catalog records</span>
                    </div>
                    <div className="dash-card stat-card">
                      <span className="stat-number">
                        {health
                          ? health.generatorConfigured
                            ? "On"
                            : "Off"
                          : "…"}
                      </span>
                      <span className="stat-label">Question generator</span>
                    </div>
                  </div>
                  <div className="dash-card section-card">
                    <h2 className="section-title">Backup</h2>
                    <p className="ingest-hint">
                      Writes a consistent snapshot of the learning database
                      (accounts and every learner's history) into
                      <code> app/data/backups/</code>. The curriculum store is
                      reproducible from the reviewed catalog seed and needs no
                      backup.
                    </p>
                    <button
                      className="primary-btn"
                      disabled={backupPending}
                      onClick={() => void runBackup()}
                    >
                      {backupPending ? "Backing up…" : "Back up now"}
                    </button>
                    {backupResult && (
                      <p className="result-meta">{backupResult}</p>
                    )}
                  </div>
                </>
              )}

              {/* ========== PARENTS ========== */}
              {nav === "parents" && (
                <>
                  <div className="dash-card section-card">
                    <h2 className="section-title">Create a parent</h2>
                    <form className="chat-input-row" onSubmit={createParent}>
                      <input
                        type="text"
                        placeholder="Parent username"
                        value={parentUsername}
                        onChange={(e) => setParentUsername(e.target.value)}
                        autoComplete="off"
                      />
                      <input
                        type="password"
                        minLength={8}
                        maxLength={256}
                        placeholder="Temporary password (8+ characters)"
                        value={parentPassword}
                        onChange={(e) => setParentPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                      <button
                        type="submit"
                        className="primary-btn"
                        disabled={parentsPending}
                      >
                        {parentsPending ? "…" : "Create"}
                      </button>
                    </form>
                    <p className="ingest-hint">
                      The parent signs in with these credentials and manages
                      their own children from the parent portal.
                    </p>
                    {parentsError && (
                      <p className="error-text">{parentsError}</p>
                    )}
                  </div>

                  <div className="dash-card section-card">
                    <h2 className="section-title">
                      Parents ({parents.length})
                    </h2>
                    {parents.length === 0 ? (
                      <p className="empty-state">
                        No parent accounts yet. Create the first one above.
                      </p>
                    ) : (
                      <div className="record-list">
                        {parents.map((parent) => (
                          <div
                            key={parent.accountId}
                            className="dash-card record-card"
                          >
                            <div className="record-header">
                              <div className="record-main">
                                <span className="record-code">
                                  {parent.username}
                                </span>
                                <span className="record-grade">
                                  {parent.children.length === 0
                                    ? "no children"
                                    : parent.children
                                        .map((child) => child.username)
                                        .join(", ")}
                                </span>
                              </div>
                              {resetTarget === parent.accountId ? (
                                <button
                                  className="secondary-btn"
                                  onClick={() => {
                                    setResetTarget(null);
                                    setResetPasswordValue("");
                                  }}
                                >
                                  Cancel
                                </button>
                              ) : (
                                <button
                                  className="link-btn"
                                  onClick={() =>
                                    setResetTarget(parent.accountId)
                                  }
                                >
                                  Reset password
                                </button>
                              )}
                            </div>
                            {resetTarget === parent.accountId && (
                              <form
                                className="chat-input-row"
                                onSubmit={resetParentPassword}
                              >
                                <input
                                  type="password"
                                  minLength={8}
                                  maxLength={256}
                                  placeholder="New password (8+ characters)"
                                  value={resetPasswordValue}
                                  onChange={(e) =>
                                    setResetPasswordValue(e.target.value)
                                  }
                                  autoComplete="new-password"
                                />
                                <button
                                  type="submit"
                                  className="primary-btn"
                                  disabled={parentsPending}
                                >
                                  {parentsPending ? "…" : "Save"}
                                </button>
                              </form>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {parentsError && (
                      <p className="error-text">{parentsError}</p>
                    )}
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
