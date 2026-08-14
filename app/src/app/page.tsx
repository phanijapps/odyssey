"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { MathText } from "@/components/math-text";

type FlatStandard = {
  id: string;
  standardCode: string;
  standardText: string;
  domain: string;
  subject: string;
  grade: string;
};

type PracticeFeedback = { kind: "success" | "error"; message: string };

export default function HomePage() {
  // Auth
  const [signedIn, setSignedIn] = useState(false);
  const [role, setRole] = useState<"student" | "admin" | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // Browse + selection
  const [allStandards, setAllStandards] = useState<FlatStandard[]>([]);
  const [selGrade, setSelGrade] = useState("Grade 6");
  const [selSubject, setSelSubject] = useState("Mathematics");
  const [activeSkill, setActiveSkill] = useState<FlatStandard | null>(null);
  const [browseOpen, setBrowseOpen] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FlatStandard[]>([]);
  const [semanticLoading, setSemanticLoading] = useState(false);

  // Practice
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<PracticeFeedback | null>(null);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [questionFailed, setQuestionFailed] = useState(false);
  const [question, setQuestion] = useState("");
  const [diagramSvg, setDiagramSvg] = useState<string | null>(null);
  const [level, setLevel] = useState(1);
  const [correctStreak, setCorrectStreak] = useState(0);
  const [poolPos, setPoolPos] = useState(0);
  const [poolTotal, setPoolTotal] = useState(0);
  const [poolDifficulty, setPoolDifficulty] = useState(2);
  const progressVersion = useRef(0);

  /* ---- Data loading ---- */

  const loadStandards = useCallback(async () => {
    try {
      const res = await fetch("/api/curriculum/browse", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const flat: FlatStandard[] = [];
      for (const s of data.subjects ?? []) {
        for (const g of s.grades ?? []) {
          for (const d of g.domains ?? []) {
            for (const std of d.standards ?? []) {
              flat.push({
                id: std.id,
                standardCode: std.standardCode,
                standardText: std.standardText,
                domain: d.domain,
                subject: s.subject,
                grade: g.grade,
              });
            }
          }
        }
      }
      setAllStandards(flat);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/session", { cache: "no-store" });
      if (!res.ok) return;
      setSignedIn(true);
      const account = (await res.json()) as { role?: string };
      setRole((account.role as "student" | "admin") ?? "student");
      await loadStandards();
      // Session continuity: resume the last practiced skill if saved.
      try {
        const saved = window.localStorage.getItem("odyssey:lastSkill");
        if (saved) {
          const skill = JSON.parse(saved) as FlatStandard;
          const stillExists = allStandardsRef.current.some(
            (s) => s.id === skill.id,
          );
          if (stillExists) {
            setSelGrade(skill.grade);
            void selectSkill(skill);
            return;
          }
        }
      } catch {
        /* corrupted storage — fall through */
      }
    })();
  }, [loadStandards]);

  const allStandardsRef = useRef<FlatStandard[]>([]);
  useEffect(() => {
    allStandardsRef.current = allStandards;
  }, [allStandards]);

  /* ---- Search (instant client-side typeahead) ---- */

  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      setSearchResults([]);
      return;
    }
    const pool = allStandards.filter(
      (s) => s.grade === selGrade && s.subject === selSubject,
    );
    const scored = pool
      .map((s) => {
        const text =
          `${s.standardCode} ${s.domain} ${s.standardText}`.toLowerCase();
        let score = 0;
        if (s.standardCode.toLowerCase().startsWith(q)) score += 50;
        if (text.includes(q)) score += 20;
        const words = q.split(/\s+/).filter((w) => w.length > 1);
        for (const w of words) {
          if (text.includes(w)) score += 5;
        }
        return { s, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);
    setSearchResults(scored.map((x) => x.s));
  }, [searchQuery, selGrade, allStandards]);

  async function semanticSearch() {
    if (!searchQuery.trim()) return;
    setSemanticLoading(true);
    try {
      const res = await fetch(
        `/api/curriculum/search?q=${encodeURIComponent(searchQuery)}&grade=${encodeURIComponent(selGrade)}&semantic=1`,
        { cache: "no-store" },
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults((data.results ?? []).map((r: FlatStandard) => r));
      }
    } catch {
      /* ignore */
    } finally {
      setSemanticLoading(false);
    }
  }

  /* ---- Skill selection → practice ---- */

  async function selectSkill(skill: FlatStandard) {
    const version = ++progressVersion.current;
    setActiveSkill(skill);
    try {
      window.localStorage.setItem("odyssey:lastSkill", JSON.stringify(skill));
    } catch {
      /* storage unavailable */
    }
    setFeedback(null);
    setAnswer("");
    setQuestionFailed(false);
    setIsLoadingQuestion(true);
    setQuestion("Loading…");
    setDiagramSvg(null);
    try {
      const params = new URLSearchParams({
        subject: skill.subject,
        grade: skill.grade,
        domain: skill.domain,
        standard: skill.standardCode,
        topicId: `${skill.subject}::${skill.grade}::${skill.domain}::${skill.standardCode}`,
      });
      const res = await fetch(`/api/progress?${params}`, { cache: "no-store" });
      if (progressVersion.current !== version) return;
      if (!res.ok) return;
      const d = await res.json();
      setLevel(d.level ?? 1);
      setCorrectStreak(d.correctStreak ?? 0);
      if (d.nextQuestion?.question) {
        setQuestion(d.nextQuestion.question);
        setDiagramSvg(d.nextQuestion?.diagramSvg ?? null);
      } else {
        setQuestion("");
        setQuestionFailed(true);
      }
      if (d.poolProgress) {
        setPoolPos(d.poolProgress.position);
        setPoolTotal(d.poolProgress.total);
        setPoolDifficulty(d.poolProgress.difficulty);
      }
    } catch {
      setQuestion("Could not load question. Try another skill.");
    } finally {
      if (progressVersion.current === version) setIsLoadingQuestion(false);
    }
  }

  async function submitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmittingAnswer || !activeSkill) return;
    const version = progressVersion.current;
    setIsSubmittingAnswer(true);
    try {
      const topicId = `${activeSkill.subject}::${activeSkill.grade}::${activeSkill.domain}::${activeSkill.standardCode}`;
      const res = await fetch("/api/answer", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: window.location.origin,
        },
        body: JSON.stringify({ topicId, answer }),
      });
      if (progressVersion.current !== version) return;
      if (!res.ok) {
        setFeedback({ kind: "error", message: "Could not save answer." });
        return;
      }
      const d = await res.json();
      setLevel(d.level);
      setCorrectStreak(d.correctStreak);
      setFeedback({
        kind: d.correct ? "success" : "error",
        message: d.correct
          ? "Nice work!"
          : `Not quite. ${d.hint ?? "Try again!"}`,
      });
      if (d.poolProgress) {
        setPoolPos(d.poolProgress.position);
        setPoolTotal(d.poolProgress.total);
        setPoolDifficulty(d.poolProgress.difficulty);
      }
      if (d.nextQuestion?.question) {
        setQuestion(d.nextQuestion.question);
        setDiagramSvg(d.nextQuestion?.diagramSvg ?? null);
      } else {
        setQuestion("");
        setQuestionFailed(true);
      }
      setAnswer("");
    } catch {
      setFeedback({ kind: "error", message: "Could not save answer." });
    } finally {
      if (progressVersion.current === version) setIsSubmittingAnswer(false);
    }
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) {
      const account = (await res.json()) as {
        childId: string;
        username: string;
        role: "student" | "admin";
      };
      setSignedIn(true);
      setRole(account.role);
      setError("");
      // Offer to save the password in the browser's password manager.
      try {
        const w = window as unknown as {
          PasswordCredential?: new (data: {
            id: string;
            password: string;
            name: string;
          }) => Credential;
        };
        if (w.PasswordCredential && navigator.credentials) {
          await navigator.credentials.store(
            new w.PasswordCredential({
              id: account.username,
              password,
              name: account.username,
            }),
          );
        }
      } catch {
        /* password manager unavailable */
      }
      await loadStandards();
      try {
        const saved = window.localStorage.getItem("odyssey:lastSkill");
        if (saved) {
          const skill = JSON.parse(saved) as FlatStandard;
          const stillExists = allStandardsRef.current.some(
            (s) => s.id === skill.id,
          );
          if (stillExists) {
            setSelGrade(skill.grade);
            void selectSkill(skill);
            return;
          }
        }
      } catch {
        /* fall through */
      }
    } else {
      setError("We could not sign you in. Check your details and try again.");
    }
  }

  /* ---- Derived data ---- */

  const subjects = [...new Set(allStandards.map((s) => s.subject))];
  const grades = [
    ...new Set(
      allStandards.filter((s) => s.subject === selSubject).map((s) => s.grade),
    ),
  ].sort();
  const skillsForGrade = allStandards
    .filter((s) => s.grade === selGrade && s.subject === selSubject)
    .sort((a, b) => a.standardCode.localeCompare(b.standardCode));

  // Group skills by domain for the sidebar
  const skillsByDomain = new Map<string, FlatStandard[]>();
  for (const s of skillsForGrade) {
    if (!skillsByDomain.has(s.domain)) skillsByDomain.set(s.domain, []);
    skillsByDomain.get(s.domain)!.push(s);
  }

  /* ---- Auth screen ---- */

  if (!signedIn) {
    return (
      <main className="shell auth-shell">
        <section className="auth-card">
          <div className="brand-mark">O</div>
          <p className="eyebrow">ODYSSEY LEARNING</p>
          <h1>A calmer way to get better at math.</h1>
          <p className="lede">Search a skill, start practicing.</p>
          <form className="stack" onSubmit={signIn}>
            <label>
              Username
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="primary-button" type="submit">
              Enter practice
            </button>
          </form>
          <p className="hint">
            Sign in with your account. Admin? Use the Dashboard after signing
            in.
          </p>
        </section>
      </main>
    );
  }

  /* ---- Main practice screen ---- */

  return (
    <main className="ixl-shell">
      {/* Single horizontal header with all controls */}
      <header className="ixl-topbar">
        <span className="small-mark">O</span>
        <span className="topbar-brand">odyssey</span>
        <select
          className="topbar-select"
          value={selSubject}
          onChange={(e) => {
            setSelSubject(e.target.value);
            setSearchQuery("");
            const firstGrade = allStandards.find(
              (s) => s.subject === e.target.value,
            )?.grade;
            if (firstGrade) setSelGrade(firstGrade);
          }}
        >
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s === "Mathematics"
                ? "Math"
                : s === "English Language Arts"
                  ? "ELA"
                  : s}
            </option>
          ))}
        </select>
        <select
          className="topbar-select"
          value={selGrade}
          onChange={(e) => {
            setSelGrade(e.target.value);
            setSearchQuery("");
          }}
        >
          {grades.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <div className="topbar-search">
          <input
            type="text"
            placeholder="Search skills…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            className="semantic-btn"
            onClick={() => void semanticSearch()}
            disabled={semanticLoading || !searchQuery.trim()}
            title="AI semantic search"
          >
            {semanticLoading ? "…" : "✨"}
          </button>
          {/* Inline dropdown results */}
          {searchQuery.trim() && (
            <div className="search-dropdown">
              {searchResults.length > 0 ? (
                searchResults.map((s) => (
                  <button
                    key={s.id}
                    className="search-result-row"
                    onClick={() => {
                      void selectSkill(s);
                      setSearchQuery("");
                    }}
                  >
                    <span className="result-code">{s.standardCode}</span>
                    <span className="result-text">{s.standardText}</span>
                  </button>
                ))
              ) : (
                <p className="search-meta">
                  No matches. Try ✨ for semantic search, or pick a skill below.
                </p>
              )}
            </div>
          )}
        </div>
        {/* Skill browser toggle */}
        <button
          className="browse-toggle"
          onClick={() => setBrowseOpen(!browseOpen)}
        >
          {browseOpen ? "Hide skills" : "Browse skills"}
        </button>
        <a href="/dashboard" className="ixl-link">
          Dashboard
        </a>
        {role && <span className="role-chip">{role}</span>}
        <button
          className="ixl-link"
          onClick={async () => {
            await fetch("/api/session", { method: "DELETE" });
            setSignedIn(false);
            setRole(null);
          }}
        >
          Sign out
        </button>
      </header>

      {/* Collapsible skill browser */}
      {browseOpen && (
        <div className="skill-browser">
          {[...skillsByDomain.entries()].map(([domain, skills]) => (
            <div key={domain} className="browser-domain">
              <p className="browser-domain-header">{domain}</p>
              <div className="browser-skills">
                {skills.map((s) => (
                  <button
                    key={s.id}
                    className={
                      activeSkill?.id === s.id
                        ? "browser-skill active"
                        : "browser-skill"
                    }
                    onClick={() => {
                      void selectSkill(s);
                      setBrowseOpen(false);
                    }}
                  >
                    <span className="browser-code">{s.standardCode}</span>
                    <span className="browser-desc">
                      <MathText>
                        {s.standardText.length > 70
                          ? s.standardText.slice(0, 70) + "…"
                          : s.standardText}
                      </MathText>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Practice area — centered, full width */}
      <section className="ixl-practice">
        {activeSkill ? (
          <>
            <div className="practice-header">
              <div>
                <p className="eyebrow">{activeSkill.subject.toUpperCase()}</p>
                <h1 className="practice-skill">{activeSkill.standardCode}</h1>
                <p className="practice-desc">
                  <MathText>{activeSkill.standardText}</MathText>
                </p>
              </div>
              <div className="practice-meta">
                {poolTotal > 0 && (
                  <div className="pool-bar">
                    {Array.from({ length: poolTotal }).map((_, i) => (
                      <div
                        key={i}
                        className={`pool-dot ${i < poolPos ? "done" : i === poolPos ? "current" : ""}`}
                      />
                    ))}
                  </div>
                )}
                <span className={`diff-badge diff-${poolDifficulty}`}>
                  {poolDifficulty === 1
                    ? "Building up"
                    : poolDifficulty === 2
                      ? "On track"
                      : "Challenge"}
                </span>
                <span className="streak-badge">🔥 {correctStreak}</span>
              </div>
            </div>

            <div className="question-card">
              <div className="question-copy">
                <h2 className="question-text">
                  <MathText>{question}</MathText>
                </h2>
                {isLoadingQuestion ? (
                  <p className="loading-text">Loading your question…</p>
                ) : (
                  <form onSubmit={submitAnswer} className="answer-row">
                    <input
                      className="answer-input"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Type your answer"
                      disabled={isSubmittingAnswer}
                      autoFocus
                    />
                    <button
                      className="primary-button"
                      type="submit"
                      disabled={isSubmittingAnswer}
                    >
                      Check
                    </button>
                  </form>
                )}
                {feedback && (
                  <p className={`feedback-${feedback.kind}`} role="status">
                    <MathText>{feedback.message}</MathText>
                  </p>
                )}
              </div>
              {diagramSvg && (
                <div className="diagram-card">
                  <img
                    className="generated-diagram"
                    src={`data:image/svg+xml,${encodeURIComponent(diagramSvg)}`}
                    alt="diagram"
                  />
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="empty-practice">
            <h1>Search a skill to start</h1>
            <p>Type in the search bar above or browse all skills.</p>
          </div>
        )}
      </section>
    </main>
  );
}

/* ---- Skill row component (kept for browse) ---- */

function SkillRow({
  skill,
  active,
  onClick,
}: {
  skill: FlatStandard;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={active ? "skill-row active" : "skill-row"}
      onClick={onClick}
    >
      <span className="skill-code">{skill.standardCode}</span>
      <span className="skill-text">{skill.standardText}</span>
    </button>
  );
}
