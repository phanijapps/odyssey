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

type Mode = "practice" | "test";

type AnswerResult = {
  correct: boolean;
  correctAnswer: string;
  solution: string[];
  hint: string;
  points: number;
  answeredDifficulty: number;
  testMode: boolean;
  testPosition: number;
  testTotal: number;
};

const GRADE_KEY = "odyssey:grade";
const SKILL_KEY = "odyssey:lastSkill";
const MODE_KEY = "odyssey:mode";

export default function HomePage() {
  // Auth
  const [signedIn, setSignedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [role, setRole] = useState<"student" | "admin" | null>(null);

  // First-time setup
  const [needsGrade, setNeedsGrade] = useState(false);

  // Browse + selection
  const [allStandards, setAllStandards] = useState<FlatStandard[]>([]);
  const [selGrade, setSelGrade] = useState("");
  const [selSubject, setSelSubject] = useState("Mathematics");
  const [activeSkill, setActiveSkill] = useState<FlatStandard | null>(null);
  const [browseOpen, setBrowseOpen] = useState(false);

  // Mode
  const [mode, setMode] = useState<Mode>("practice");

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FlatStandard[]>([]);
  const [semanticLoading, setSemanticLoading] = useState(false);

  // Practice state
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<PracticeFeedback | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
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

  // Test state
  const [testScore, setTestScore] = useState(0);
  const [testIndex, setTestIndex] = useState(0);
  const [testDone, setTestDone] = useState(false);
  const [testLog, setTestLog] = useState<
    { correct: boolean; points: number; difficulty: number }[]
  >([]);

  const progressVersion = useRef(0);
  const allStandardsRef = useRef<FlatStandard[]>([]);

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
      allStandardsRef.current = flat;
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
      // Restore mode + grade; first-time setup when no grade saved.
      let savedGrade: string | null = null;
      try {
        savedGrade = window.localStorage.getItem(GRADE_KEY);
        const savedMode = window.localStorage.getItem(MODE_KEY);
        if (savedMode === "test" || savedMode === "practice")
          setMode(savedMode);
      } catch {
        /* storage unavailable */
      }
      if (savedGrade) {
        setSelGrade(savedGrade);
        resumeLastSkill();
      } else {
        setNeedsGrade(true);
      }
    })();
  }, [loadStandards]);

  function resumeLastSkill() {
    try {
      const saved = window.localStorage.getItem(SKILL_KEY);
      if (!saved) return;
      const skill = JSON.parse(saved) as FlatStandard;
      if (allStandardsRef.current.some((s) => s.id === skill.id)) {
        void selectSkill(skill);
      }
    } catch {
      /* corrupted storage */
    }
  }

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
    setSearchResults(
      pool
        .map((s) => {
          const text =
            `${s.standardCode} ${s.domain} ${s.standardText}`.toLowerCase();
          let score = 0;
          if (s.standardCode.toLowerCase().startsWith(q)) score += 50;
          if (text.includes(q)) score += 20;
          for (const w of q.split(/\s+/).filter((w) => w.length > 1)) {
            if (text.includes(w)) score += 5;
          }
          return { s, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 15)
        .map((x) => x.s),
    );
  }, [searchQuery, selGrade, selSubject, allStandards]);

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
        setSearchResults((data.results ?? []) as FlatStandard[]);
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
    setFeedback(null);
    setResult(null);
    setAnswer("");
    setQuestionFailed(false);
    setTestDone(false);
    setTestScore(0);
    setTestIndex(0);
    setTestLog([]);
    setIsLoadingQuestion(true);
    setQuestion("Loading…");
    setDiagramSvg(null);
    try {
      window.localStorage.setItem(SKILL_KEY, JSON.stringify(skill));
    } catch {
      /* ignore */
    }
    try {
      const params = new URLSearchParams({
        subject: skill.subject,
        grade: skill.grade,
        domain: skill.domain,
        standard: skill.standardCode,
        topicId: `${skill.subject}::${skill.grade}::${skill.domain}::${skill.standardCode}`,
        mode,
      });
      const res = await fetch(`/api/progress?${params}`, { cache: "no-store" });
      if (progressVersion.current !== version) return;
      if (!res.ok) return;
      const d = await res.json();
      setLevel(d.level ?? 1);
      setCorrectStreak(d.correctStreak ?? 0);
      setPoolPos(d.poolProgress?.position ?? 0);
      setPoolTotal(d.poolProgress?.total ?? 0);
      setPoolDifficulty(d.poolProgress?.difficulty ?? 2);
      setTestIndex(Math.max(0, (d.poolProgress?.position ?? 1) - 1));
      if (d.nextQuestion?.question) {
        setQuestion(d.nextQuestion.question);
        setDiagramSvg(d.nextQuestion.diagramSvg ?? null);
      } else {
        setQuestion("");
        setQuestionFailed(true);
      }
    } catch {
      setQuestion("Could not load question. Try another skill.");
    } finally {
      if (progressVersion.current === version) setIsLoadingQuestion(false);
    }
  }

  /* ---- Answering ---- */

  async function submitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmittingAnswer || !activeSkill || result) return;
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
      const d = (await res.json()) as AnswerResult & {
        level: number;
        correctStreak: number;
        nextQuestion?: { question?: string; diagramSvg?: string } | null;
        poolProgress?: { position: number; total: number; difficulty: number };
      };
      setLevel(d.level);
      setCorrectStreak(d.correctStreak);
      setResult(d);
      setFeedback({
        kind: d.correct ? "success" : "error",
        message: d.correct
          ? mode === "test"
            ? `Correct! +${d.points} points`
            : "Correct!"
          : `Not quite. The correct answer is ${d.correctAnswer}.`,
      });
      if (mode === "test") {
        setTestScore((s) => s + d.points);
        setTestLog((l) => [
          ...l,
          {
            correct: d.correct,
            points: d.points,
            difficulty: d.answeredDifficulty,
          },
        ]);
      }
      if (d.poolProgress) {
        setPoolPos(d.poolProgress.position);
        setPoolTotal(d.poolProgress.total);
        setPoolDifficulty(d.poolProgress.difficulty);
      }
      setAnswer("");
    } catch {
      setFeedback({ kind: "error", message: "Could not save answer." });
    } finally {
      if (progressVersion.current === version) setIsSubmittingAnswer(false);
    }
  }

  /** Next: advance to the question the server already prepared. */
  async function nextQuestion() {
    if (!activeSkill) return;
    setResult(null);
    setFeedback(null);
    setIsLoadingQuestion(true);
    setQuestion("Loading…");
    if (mode === "test" && result) {
      const nextIndex = result.testPosition; // server counts the just-served one
      setTestIndex(nextIndex);
      if (result.testPosition >= result.testTotal) {
        setTestDone(true);
        setIsLoadingQuestion(false);
        setQuestion("");
        return;
      }
    }
    try {
      const params = new URLSearchParams({
        subject: activeSkill.subject,
        grade: activeSkill.grade,
        domain: activeSkill.domain,
        standard: activeSkill.standardCode,
        topicId: `${activeSkill.subject}::${activeSkill.grade}::${activeSkill.domain}::${activeSkill.standardCode}`,
        mode,
      });
      const res = await fetch(`/api/progress?${params}`, { cache: "no-store" });
      if (!res.ok) return;
      const d = await res.json();
      if (d.nextQuestion?.question) {
        setQuestion(d.nextQuestion.question);
        setDiagramSvg(d.nextQuestion.diagramSvg ?? null);
      } else if (mode === "test") {
        setTestDone(true);
        setQuestion("");
      } else {
        setQuestion("");
        setQuestionFailed(true);
      }
    } catch {
      setQuestion("Could not load the next question.");
    } finally {
      setIsLoadingQuestion(false);
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
        const savedGrade = window.localStorage.getItem(GRADE_KEY);
        if (savedGrade) {
          setSelGrade(savedGrade);
          resumeLastSkill();
        } else {
          setNeedsGrade(true);
        }
      } catch {
        setNeedsGrade(true);
      }
    } else {
      setError("We could not sign you in. Check your details and try again.");
    }
  }

  function pickGrade(g: string) {
    try {
      window.localStorage.setItem(GRADE_KEY, g);
    } catch {
      /* ignore */
    }
    setSelGrade(g);
    setNeedsGrade(false);
  }

  function switchMode(next: Mode) {
    setMode(next);
    try {
      window.localStorage.setItem(MODE_KEY, next);
    } catch {
      /* ignore */
    }
    setResult(null);
    setFeedback(null);
    setTestDone(false);
    setTestScore(0);
    setTestIndex(0);
    setTestLog([]);
    if (activeSkill) void selectSkill(activeSkill);
  }

  /* ---- Derived data ---- */

  const grades = [...new Set(allStandards.map((s) => s.grade))].sort();
  const subjects = [...new Set(allStandards.map((s) => s.subject))];
  const gradeChoices = [
    "Kindergarten",
    "Grade 1",
    "Grade 2",
    "Grade 3",
    "Grade 4",
    "Grade 5",
    "Grade 6",
    "Grade 7",
    "Grade 8",
    "Grades 9-10",
    "Grades 11-12",
    "High School",
  ].filter((g) => grades.includes(g));
  const skillsForGrade = allStandards
    .filter((s) => s.grade === selGrade && s.subject === selSubject)
    .sort((a, b) => a.standardCode.localeCompare(b.standardCode));
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
          <p className="hint">Sign in with your account.</p>
        </section>
      </main>
    );
  }

  /* ---- First-time setup: pick grade ---- */

  if (needsGrade) {
    return (
      <main className="shell auth-shell">
        <section className="auth-card">
          <div className="brand-mark">O</div>
          <p className="eyebrow">WELCOME TO ODYSSEY</p>
          <h1>What grade are you in?</h1>
          <p className="lede">We&apos;ll start you there.</p>
          <div className="grade-picker">
            {gradeChoices.map((g) => (
              <button
                key={g}
                className="grade-chip"
                onClick={() => pickGrade(g)}
              >
                {g}
              </button>
            ))}
          </div>
        </section>
      </main>
    );
  }

  /* ---- Main practice screen ---- */

  const testQuestionNumber = Math.min(testIndex + 1, poolTotal || 9);

  return (
    <main className="ixl-shell">
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
            try {
              window.localStorage.setItem(GRADE_KEY, e.target.value);
            } catch {
              /* ignore */
            }
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
        <div className="mode-toggle">
          <button
            className={mode === "practice" ? "mode-btn active" : "mode-btn"}
            onClick={() => switchMode("practice")}
          >
            Practice
          </button>
          <button
            className={mode === "test" ? "mode-btn active" : "mode-btn"}
            onClick={() => switchMode("test")}
          >
            Test
          </button>
        </div>
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

      {/* Skill browser */}
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
                      {s.standardText.length > 70
                        ? s.standardText.slice(0, 70) + "…"
                        : s.standardText}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="ixl-practice">
        {activeSkill ? (
          <>
            <div className="practice-header">
              <div>
                <p className="eyebrow">{activeSkill.subject.toUpperCase()}</p>
                <h1 className="practice-skill">{activeSkill.standardCode}</h1>
                <p className="practice-desc">{activeSkill.standardText}</p>
              </div>
              <div className="practice-meta">
                {mode === "test" ? (
                  <span className="test-progress">
                    Question {testQuestionNumber} of {poolTotal || 9}
                  </span>
                ) : (
                  poolTotal > 0 && (
                    <div className="pool-bar">
                      {Array.from({ length: poolTotal }).map((_, i) => (
                        <div
                          key={i}
                          className={`pool-dot ${i < poolPos ? "done" : i === poolPos ? "current" : ""}`}
                        />
                      ))}
                    </div>
                  )
                )}
                {mode === "practice" && (
                  <span className={`diff-badge diff-${poolDifficulty}`}>
                    {poolDifficulty === 1
                      ? "Building up"
                      : poolDifficulty === 2
                        ? "On track"
                        : "Challenge"}
                  </span>
                )}
                {mode === "test" && (
                  <span className="score-badge">Score {testScore}</span>
                )}
                {mode === "practice" && (
                  <span className="streak-badge">🔥 {correctStreak}</span>
                )}
              </div>
            </div>

            {testDone ? (
              <div className="question-card test-report">
                <div className="question-copy">
                  <h2 className="practice-skill">Test complete!</h2>
                  <p className="test-score-line">
                    You scored <strong>{testScore}</strong> out of{" "}
                    <strong>180</strong> points.
                  </p>
                  <div className="test-breakdown">
                    {testLog.map((entry, i) => (
                      <div key={i} className="test-entry">
                        <span
                          className={
                            entry.correct ? "kg-pred good" : "kg-pred bad"
                          }
                        >
                          Q{i + 1} · Level {entry.difficulty} ·{" "}
                          {entry.correct ? "✓" : "✗"} +{entry.points}
                        </span>
                      </div>
                    ))}
                  </div>
                  <button
                    className="primary-button"
                    onClick={() => activeSkill && void selectSkill(activeSkill)}
                  >
                    Take a new test
                  </button>
                  <button
                    className="secondary-btn"
                    onClick={() => switchMode("practice")}
                  >
                    Back to practice
                  </button>
                </div>
              </div>
            ) : (
              <div className="question-card">
                <div className="question-copy">
                  {questionFailed ? (
                    <div className="retry-panel">
                      <p className="retry-message">
                        We couldn&rsquo;t generate a question for this skill
                        just now. The local model may be busy — try again.
                      </p>
                      <button
                        className="primary-button"
                        onClick={() =>
                          activeSkill && void selectSkill(activeSkill)
                        }
                      >
                        Try again
                      </button>
                    </div>
                  ) : (
                    <>
                      <h2 className="question-text">
                        <MathText>{question}</MathText>
                      </h2>
                      {isLoadingQuestion ? (
                        <p className="loading-text">Loading your question…</p>
                      ) : result ? (
                        <>
                          <div
                            className={`solution-panel ${result.correct ? "good" : "bad"}`}
                          >
                            <p className="solution-title">
                              {result.correct
                                ? "Correct! Here's how it works:"
                                : `The correct answer is ${result.correctAnswer}`}
                            </p>
                            <ol className="solution-steps">
                              {result.solution.map((step, i) => (
                                <li key={i}>
                                  <MathText>{step}</MathText>
                                </li>
                              ))}
                            </ol>
                          </div>
                          <button
                            className="primary-button next-btn"
                            onClick={() => void nextQuestion()}
                          >
                            Next question →
                          </button>
                        </>
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
                            disabled={isSubmittingAnswer || !answer.trim()}
                          >
                            Check
                          </button>
                        </form>
                      )}
                      {feedback && !result && (
                        <p
                          className={`feedback-${feedback.kind}`}
                          role="status"
                        >
                          <MathText>{feedback.message}</MathText>
                        </p>
                      )}
                    </>
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
            )}
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
