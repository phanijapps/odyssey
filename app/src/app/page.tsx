"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AssessmentPanel } from "./learner/assessment-panel";
import { LearnerHeader } from "./learner/learner-header";
import { LearningHistory } from "./learner/learning-history";
import { PracticePanel } from "./learner/practice-panel";
import { SkillBrowser } from "./learner/skill-browser";
import {
  Assessment,
  AssessmentQuestion,
  AssessmentResponse,
  AssessmentResult,
  AnswerResult,
  FlatStandard,
  HistoryEntry,
  Mode,
  PracticeFeedback,
} from "./learner/types";

const GRADE_KEY = "odyssey:grade";
const SKILL_KEY = "odyssey:lastSkill";
const MODE_KEY = "odyssey:mode";

export default function HomePage() {
  // Auth
  const [signedIn, setSignedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [role, setRole] = useState<"student" | "admin" | "parent" | null>(null);

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
  const [answerMaxLength, setAnswerMaxLength] = useState(100);
  const [feedback, setFeedback] = useState<PracticeFeedback | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [questionFailed, setQuestionFailed] = useState(false);
  const [question, setQuestion] = useState("");
  /** Opaque server-issued binding for the displayed Practice question. */
  const [assignmentToken, setAssignmentToken] = useState<string | null>(null);
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
  const [testSelectedIds, setTestSelectedIds] = useState<string[]>([]);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [assessmentQuestion, setAssessmentQuestion] =
    useState<AssessmentQuestion | null>(null);
  const [assessmentResult, setAssessmentResult] =
    useState<AssessmentResult | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

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
      if (account.role === "parent") {
        window.location.assign("/parent");
        return;
      }
      setRole((account.role as "student" | "admin") ?? "student");
      await loadStandards();
      // Restore mode + grade; first-time setup when no grade saved.
      let savedGrade: string | null = null;
      try {
        savedGrade = window.localStorage.getItem(GRADE_KEY);
        const savedMode = window.localStorage.getItem(MODE_KEY);
        if (savedMode === "test" || savedMode === "practice") {
          setMode(savedMode);
          if (savedMode === "test") await loadActiveTest();
        }
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

  async function selectSkill(skill: FlatStandard, requestedMode: Mode = mode) {
    if (requestedMode === "test") {
      if (assessment?.status === "active") return;
      setTestSelectedIds((selected) =>
        selected.includes(skill.id)
          ? selected.filter((id) => id !== skill.id)
          : selected.length < 3
            ? [...selected, skill.id]
            : selected,
      );
      return;
    }
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
    setAssignmentToken(null);
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
        mode: requestedMode,
      });
      const res = await fetch(`/api/progress?${params}`, { cache: "no-store" });
      if (progressVersion.current !== version) return;
      if (!res.ok) {
        setQuestion("");
        setQuestionFailed(true);
        return;
      }
      const d = await res.json();
      if (progressVersion.current !== version) return;
      setLevel(d.level ?? 1);
      setCorrectStreak(d.correctStreak ?? 0);
      setPoolPos(d.poolProgress?.position ?? 0);
      setPoolTotal(d.poolProgress?.total ?? 0);
      setPoolDifficulty(d.poolProgress?.difficulty ?? 2);
      setTestIndex(Math.max(0, (d.poolProgress?.position ?? 1) - 1));
      if (d.nextQuestion?.question) {
        setQuestion(d.nextQuestion.question);
        setAnswerMaxLength(
          d.nextQuestion.interaction?.type === "text-response"
            ? d.nextQuestion.interaction.response.maxLength
            : 100,
        );
        setAssignmentToken(
          typeof d.nextQuestion.assignmentToken === "string"
            ? d.nextQuestion.assignmentToken
            : null,
        );
        setDiagramSvg(d.nextQuestion.diagramSvg ?? null);
      } else {
        setQuestion("");
        setQuestionFailed(true);
      }
    } catch {
      if (progressVersion.current === version) {
        setQuestion("");
        setQuestionFailed(true);
      }
    } finally {
      if (progressVersion.current === version) setIsLoadingQuestion(false);
    }
  }

  /* ---- Answering ---- */

  async function submitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmittingAnswer || !activeSkill || result || !assignmentToken)
      return;
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
        body: JSON.stringify({ topicId, answer, assignmentToken }),
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
      if (progressVersion.current !== version) return;
      setLevel(d.level);
      setCorrectStreak(d.correctStreak);
      setResult(d);
      setAssignmentToken(null);
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
      if (progressVersion.current === version) {
        setFeedback({ kind: "error", message: "Could not save answer." });
      }
    } finally {
      if (progressVersion.current === version) setIsSubmittingAnswer(false);
    }
  }

  /** Next: advance to the question the server already prepared. */
  async function nextQuestion() {
    if (!activeSkill) return;
    const version = ++progressVersion.current;
    const skill = activeSkill;
    const requestedMode = mode;
    const currentResult = result;
    setResult(null);
    setFeedback(null);
    setQuestionFailed(false);
    setIsLoadingQuestion(true);
    setQuestion("Loading…");
    setAssignmentToken(null);
    setDiagramSvg(null);
    if (requestedMode === "test" && currentResult) {
      const nextIndex = currentResult.testPosition; // server counts the just-served one
      setTestIndex(nextIndex);
      if (currentResult.testPosition >= currentResult.testTotal) {
        setTestDone(true);
        setIsLoadingQuestion(false);
        setQuestion("");
        return;
      }
    }
    try {
      const params = new URLSearchParams({
        subject: skill.subject,
        grade: skill.grade,
        domain: skill.domain,
        standard: skill.standardCode,
        topicId: `${skill.subject}::${skill.grade}::${skill.domain}::${skill.standardCode}`,
        mode: requestedMode,
      });
      const res = await fetch(`/api/progress?${params}`, { cache: "no-store" });
      if (progressVersion.current !== version) return;
      if (!res.ok) {
        setQuestion("");
        setQuestionFailed(true);
        return;
      }
      const d = await res.json();
      if (progressVersion.current !== version) return;
      if (d.nextQuestion?.question) {
        setQuestion(d.nextQuestion.question);
        setAnswerMaxLength(
          d.nextQuestion.interaction?.type === "text-response"
            ? d.nextQuestion.interaction.response.maxLength
            : 100,
        );
        setAssignmentToken(
          typeof d.nextQuestion.assignmentToken === "string"
            ? d.nextQuestion.assignmentToken
            : null,
        );
        setDiagramSvg(d.nextQuestion.diagramSvg ?? null);
      } else if (requestedMode === "test") {
        setTestDone(true);
        setQuestion("");
      } else {
        setQuestion("");
        setQuestionFailed(true);
      }
    } catch {
      if (progressVersion.current === version) {
        setQuestion("");
        setQuestionFailed(true);
      }
    } finally {
      if (progressVersion.current === version) setIsLoadingQuestion(false);
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
        role: "student" | "admin" | "parent";
      };
      if (account.role === "parent") {
        window.location.assign("/parent");
        return;
      }
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
    setTestError("");
    if (next === "practice" && activeSkill)
      void selectSkill(activeSkill, "practice");
    if (next === "test") void loadActiveTest();
  }

  function applyAssessment(data: AssessmentResponse) {
    setAssessment(data.assessment);
    setAssessmentQuestion(data.question ?? null);
    if (data.result) setAssessmentResult(data.result);
  }

  async function loadActiveTest(assessmentId?: string) {
    setTestLoading(true);
    try {
      const suffix = assessmentId
        ? `?id=${encodeURIComponent(assessmentId)}`
        : "";
      const res = await fetch(`/api/test${suffix}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.assessment) applyAssessment(data);
        else {
          setAssessment(null);
          setAssessmentQuestion(null);
          setAssessmentResult(null);
        }
      }
    } catch {
      /* no resumable assessment */
    } finally {
      setTestLoading(false);
    }
  }

  async function loadHistory() {
    try {
      const res = await fetch("/api/history", { cache: "no-store" });
      if (res.ok) setHistory((await res.json()).entries ?? []);
    } catch {
      setHistory([]);
    }
  }

  async function exitTest() {
    if (
      !assessment ||
      !window.confirm(
        "Exit this test? Your answered work will be saved as partial.",
      )
    )
      return;
    setTestLoading(true);
    setTestError("");
    try {
      const res = await fetch("/api/test/exit", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: window.location.origin,
        },
        body: JSON.stringify({ assessmentId: assessment.id }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      applyAssessment(data);
      if (data.result) setAssessmentResult(data.result);
    } catch {
      setTestError("We couldn’t exit this test. Try again.");
    } finally {
      setTestLoading(false);
    }
  }

  async function startTest() {
    if (!testSelectedIds.length || testLoading) return;
    setTestLoading(true);
    setTestError("");
    try {
      const res = await fetch("/api/test", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: window.location.origin,
        },
        body: JSON.stringify({ standardIds: testSelectedIds }),
      });
      if (!res.ok) throw new Error();
      applyAssessment(await res.json());
    } catch {
      setTestError(
        "We couldn’t start that test. Pick supported skills and try again.",
      );
    } finally {
      setTestLoading(false);
    }
  }

  async function submitTestAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assessment || !assessmentQuestion || !answer.trim() || testLoading)
      return;
    setTestLoading(true);
    setTestError("");
    try {
      const res = await fetch("/api/test/answer", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: window.location.origin,
        },
        body: JSON.stringify({
          assessmentId: assessment.id,
          answer,
          assignmentToken: assessmentQuestion.assignmentToken,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      applyAssessment(data);
      setAnswer("");
      if (data.assessment?.status === "active")
        await loadActiveTest(data.assessment.id);
    } catch {
      setTestError("We couldn’t save that answer. Try again.");
    } finally {
      setTestLoading(false);
    }
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
  const testLocked = mode === "test" && assessment?.status === "active";

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

  return (
    <main className="ixl-shell">
      <LearnerHeader
        grades={grades}
        subjects={subjects}
        selGrade={selGrade}
        selSubject={selSubject}
        searchQuery={searchQuery}
        searchResults={searchResults}
        semanticLoading={semanticLoading}
        mode={mode}
        browseOpen={browseOpen}
        historyOpen={historyOpen}
        role={role === "parent" ? null : role}
        testLocked={testLocked}
        onSubjectChange={(subject) => {
          setSelSubject(subject);
          setSearchQuery("");
          const firstGrade = allStandards.find(
            (standard) => standard.subject === subject,
          )?.grade;
          if (firstGrade) setSelGrade(firstGrade);
        }}
        onGradeChange={(grade) => {
          setSelGrade(grade);
          try {
            window.localStorage.setItem(GRADE_KEY, grade);
          } catch {
            /* ignore */
          }
          setSearchQuery("");
        }}
        onSearchQueryChange={setSearchQuery}
        onSemanticSearch={() => void semanticSearch()}
        onSearchResultSelect={(skill) => {
          void selectSkill(skill);
          setSearchQuery("");
        }}
        onModeChange={switchMode}
        onBrowseToggle={() => setBrowseOpen(!browseOpen)}
        onHistoryToggle={() => {
          setHistoryOpen((open) => !open);
          if (!historyOpen) void loadHistory();
        }}
        onSignOut={async () => {
          await fetch("/api/session", { method: "DELETE" });
          setSignedIn(false);
          setRole(null);
        }}
      />

      {browseOpen && (
        <SkillBrowser
          activeSkill={activeSkill}
          skillsByDomain={skillsByDomain}
          testLocked={testLocked}
          onSkillSelect={(skill) => {
            void selectSkill(skill);
            setBrowseOpen(false);
          }}
        />
      )}

      {historyOpen && <LearningHistory history={history} />}

      <section className="ixl-practice">
        {mode === "test" ? (
          <AssessmentPanel
            allStandards={allStandards}
            assessment={assessment}
            assessmentQuestion={assessmentQuestion}
            assessmentResult={assessmentResult}
            answer={answer}
            testError={testError}
            testLoading={testLoading}
            testSelectedIds={testSelectedIds}
            onAnswerChange={setAnswer}
            onExit={() => void exitTest()}
            onLoadActiveTest={(assessmentId) =>
              void loadActiveTest(assessmentId)
            }
            onNewTest={() => {
              setAssessment(null);
              setAssessmentQuestion(null);
              setAssessmentResult(null);
              setTestSelectedIds([]);
            }}
            onStart={() => void startTest()}
            onSubmitAnswer={submitTestAnswer}
            onSwitchToPractice={() => switchMode("practice")}
            onToggleSelectedSkill={(skill) => void selectSkill(skill, "test")}
          />
        ) : activeSkill ? (
          <PracticePanel
            activeSkill={activeSkill}
            answer={answer}
            answerMaxLength={answerMaxLength}
            correctStreak={correctStreak}
            diagramSvg={diagramSvg}
            feedback={feedback}
            isLoadingQuestion={isLoadingQuestion}
            isSubmittingAnswer={isSubmittingAnswer}
            poolDifficulty={poolDifficulty}
            poolPos={poolPos}
            poolTotal={poolTotal}
            question={question}
            questionFailed={questionFailed}
            result={result}
            testDone={testDone}
            testLog={testLog}
            testScore={testScore}
            onAnswerChange={setAnswer}
            onNextQuestion={() => void nextQuestion()}
            onRetry={() => void selectSkill(activeSkill)}
            onStartNewTest={() => void selectSkill(activeSkill)}
            onSubmitAnswer={submitAnswer}
            onSwitchToPractice={() => switchMode("practice")}
          />
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
