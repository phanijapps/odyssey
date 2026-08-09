"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

const fallbackTopics = [
  {
    id: "ratio",
    label: "Ratios & rates",
    grade: "Grade 6",
    standard: "6.RP.A.1",
  },
  {
    id: "linear",
    label: "Linear relationships",
    grade: "Grade 7",
    standard: "7.RP.A.2",
  },
];

const topicQuestions: Record<string, string> = {
  ratio:
    "A recipe uses 1 cup of water for every 2 cups of flour. How many cups of flour are needed?",
  linear: "For y = 2x, what is the coefficient of x?",
};

type PracticeFeedback = { kind: "success" | "error"; message: string };

export default function HomePage() {
  const [signedIn, setSignedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [topicId, setTopicId] = useState("ratio");
  const activeTopicRef = useRef(topicId);
  const progressRequestVersion = useRef(0);
  const questionRequestVersion = useRef(0);
  const [topics, setTopics] = useState(fallbackTopics);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<PracticeFeedback | null>(null);
  const [canRequestGeneratedPractice, setCanRequestGeneratedPractice] =
    useState(false);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [isTopicLoading, setIsTopicLoading] = useState(false);
  const [progressError, setProgressError] = useState("");
  const [level, setLevel] = useState(1);
  const [correctStreak, setCorrectStreak] = useState(0);
  const [question, setQuestion] = useState(topicQuestions.ratio);
  const [diagramSvg, setDiagramSvg] = useState<string | null>(null);
  const [generatedPreview, setGeneratedPreview] = useState<{
    question: string;
    diagramSvg: string;
  } | null>(null);
  const [memoryState, setMemoryState] = useState<"ready" | "unavailable">(
    "unavailable",
  );
  const [parentOpen, setParentOpen] = useState(false);
  const [parentMessage, setParentMessage] = useState("");
  const [parentReply, setParentReply] = useState("");
  const [parentSummary, setParentSummary] = useState<{
    topics: Array<{ topicId: string; level: number; attempts: number }>;
    totalAttempts: number;
  } | null>(null);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/session", { cache: "no-store" });
      if (response.ok) {
        setIsTopicLoading(true);
        setSignedIn(true);
        await loadProgress(topicId);
      }
    })();
  }, []);

  async function loadProgress(activeTopicId: string) {
    const requestVersion = ++progressRequestVersion.current;
    setIsTopicLoading(true);
    setProgressError("");
    let loaded = false;
    try {
      const response = await fetch(
        `/api/progress?topicId=${encodeURIComponent(activeTopicId)}`,
        { cache: "no-store" },
      );
      if (!response.ok) return;
      const progress = (await response.json()) as {
        level: number;
        correctStreak: number;
        nextQuestion?: { question?: string; diagramSvg?: string };
      };
      if (
        activeTopicRef.current !== activeTopicId ||
        progressRequestVersion.current !== requestVersion
      )
        return;
      setLevel(progress.level);
      setCorrectStreak(progress.correctStreak);
      if (progress.nextQuestion?.question)
        setQuestion(progress.nextQuestion.question);
      setDiagramSvg(progress.nextQuestion?.diagramSvg ?? null);
      loaded = Boolean(progress.nextQuestion?.question);
    } catch {
      setProgressError(
        "Your current practice question could not load. Please refresh and try again.",
      );
    } finally {
      if (
        activeTopicRef.current === activeTopicId &&
        progressRequestVersion.current === requestVersion
      ) {
        if (loaded) setIsTopicLoading(false);
        else
          setProgressError(
            "Your current practice question could not load. Please refresh and try again.",
          );
      }
    }
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (response.ok) {
      setIsTopicLoading(true);
      setSignedIn(true);
      setError("");
      const topicResponse = await fetch("/api/topics", { cache: "no-store" });
      if (topicResponse.ok) {
        const catalogTopics = (await topicResponse.json()) as Array<{
          id: string;
          title: string;
          gradeOrCourse: string;
          standardId: string;
        }>;
        setTopics(
          catalogTopics.map((topic) => ({
            id: topic.id,
            label: topic.title,
            grade: topic.gradeOrCourse,
            standard: topic.standardId,
          })),
        );
      }
      const memory = await fetch("/api/memory", { cache: "no-store" });
      if (memory.ok) setMemoryState((await memory.json()).kind);
      await loadProgress(topicId);
    } else {
      setError("We could not sign you in. Check your details and try again.");
    }
  }

  async function submitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmittingAnswer || isTopicLoading) return;
    const submittedTopicId = topicId;
    progressRequestVersion.current += 1;
    const requestVersion = ++questionRequestVersion.current;
    setIsSubmittingAnswer(true);
    try {
      const response = await fetch("/api/answer", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: window.location.origin,
        },
        body: JSON.stringify({
          topicId: submittedTopicId,
          answer,
        }),
      });
      if (!response.ok) {
        setFeedback({
          kind: "error",
          message: "We could not save that answer. Please try again.",
        });
        return;
      }
      const payload = (await response.json()) as {
        level: number;
        correct: boolean;
        correctStreak: number;
        nextQuestion?: { question?: string; diagramSvg?: string };
      };
      if (
        activeTopicRef.current !== submittedTopicId ||
        questionRequestVersion.current !== requestVersion
      )
        return;
      progressRequestVersion.current += 1;
      setLevel(payload.level);
      setCorrectStreak(payload.correctStreak);
      setFeedback({
        kind: payload.correct ? "success" : "error",
        message: payload.correct
          ? "Nice work — your next question is ready."
          : "Not quite yet. Try the ratio again.",
      });
      setCanRequestGeneratedPractice(true);
      setGeneratedPreview(null);
      if (payload.nextQuestion?.question)
        setQuestion(payload.nextQuestion.question);
      setDiagramSvg(payload.nextQuestion?.diagramSvg ?? null);
      setAnswer("");
    } catch {
      setFeedback({
        kind: "error",
        message: "We could not save that answer. Please try again.",
      });
    } finally {
      setIsSubmittingAnswer(false);
    }
  }

  async function requestGeneratedPractice() {
    const submittedTopicId = topicId;
    const requestVersion = ++questionRequestVersion.current;
    setCanRequestGeneratedPractice(false);
    setGeneratedPreview(null);
    const response = await fetch("/api/generated-question", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: window.location.origin,
      },
      body: JSON.stringify({ topicId: submittedTopicId }),
    });
    const payload = (await response.json()) as {
      error?: string;
      question?: string;
      diagramSvg?: string;
    };
    if (
      activeTopicRef.current !== submittedTopicId ||
      questionRequestVersion.current !== requestVersion
    )
      return;
    if (response.ok && payload.question && payload.diagramSvg) {
      setGeneratedPreview({
        question: payload.question,
        diagramSvg: payload.diagramSvg,
      });
      setDiagramSvg(payload.diagramSvg);
      setFeedback({
        kind: "success",
        message: "A generated practice question is ready.",
      });
      return;
    }
    setFeedback({
      kind: "error",
      message:
        payload.error ??
        "Generated practice is unavailable. Your local practice question is still ready.",
    });
  }

  if (!signedIn) {
    return (
      <main className="shell auth-shell">
        <section className="auth-card" aria-labelledby="welcome-title">
          <div className="brand-mark">O</div>
          <p className="eyebrow">ODYSSEY LEARNING</p>
          <h1 id="welcome-title">A calmer way to get better at math.</h1>
          <p className="lede">
            Focused practice, one thoughtful question at a time.
          </p>
          <form className="stack" onSubmit={signIn}>
            <label>
              Username
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
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
            Local test account: child / development-password
          </p>
        </section>
      </main>
    );
  }

  const topic = topics.find((item) => item.id === topicId) ?? topics[0];
  return (
    <main className="shell portal-shell">
      <header className="topbar">
        <div className="wordmark">
          <span className="small-mark">O</span> odyssey
        </div>
        <div className="profile-chip">
          <span className="avatar">C</span> Child learner
        </div>
        <button
          className="secondary-button"
          type="button"
          onClick={async () => {
            const nextOpen = !parentOpen;
            setParentOpen(nextOpen);
            if (nextOpen) {
              const response = await fetch("/api/parent/summary", {
                cache: "no-store",
              });
              if (response.ok) setParentSummary(await response.json());
            }
          }}
        >
          Parent view
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={async () => {
            await fetch("/api/session", { method: "DELETE" });
            setSignedIn(false);
            setParentOpen(false);
          }}
        >
          Sign out
        </button>
      </header>
      {parentOpen && (
        <section className="parent-panel" aria-label="Parent progress chat">
          <p className="eyebrow">PARENT VIEW</p>
          <h2>Ask about progress</h2>
          {parentSummary && (
            <>
              <p className="lede">
                {parentSummary.totalAttempts} attempts across{" "}
                {parentSummary.topics.length} topic
                {parentSummary.topics.length === 1 ? "" : "s"}.
              </p>
              {parentSummary.topics.length > 0 && (
                <ul className="parent-topic-list">
                  {parentSummary.topics.map((topic) => (
                    <li key={topic.topicId}>
                      <span>{topic.topicId}</span>
                      <small>
                        Level {topic.level} · {topic.attempts} attempts
                      </small>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <form
            className="answer-row"
            onSubmit={async (event) => {
              event.preventDefault();
              const response = await fetch("/api/parent/chat", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ message: parentMessage }),
              });
              const payload = (await response.json()) as {
                reply?: string;
                error?: string;
              };
              setParentReply(
                payload.reply ??
                  payload.error ??
                  "Unable to answer that message",
              );
            }}
          >
            <label className="sr-only" htmlFor="parent-message">
              Message
            </label>
            <input
              id="parent-message"
              value={parentMessage}
              onChange={(event) => setParentMessage(event.target.value)}
              placeholder="How is practice going?"
              maxLength={500}
              required
            />
            <button className="primary-button" type="submit">
              Ask
            </button>
          </form>
          {parentReply && (
            <p className="success" role="status">
              {parentReply}
            </p>
          )}
        </section>
      )}
      <section className="portal-grid">
        <aside className="sidebar" aria-label="Learning navigation">
          <p className="eyebrow">YOUR PRACTICE</p>
          <h2>Keep your curiosity moving.</h2>
          <div className="progress-card">
            <span className="progress-ring">{level}</span>
            <div>
              <strong>Level {level}</strong>
              <small>{correctStreak} correct in a row</small>
            </div>
          </div>
          <p className="memory-state">
            <span className="status-dot" /> Profile memory {memoryState}
          </p>
        </aside>
        <section className="practice-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">MATH · PRACTICE</p>
              <h1>Let&apos;s warm up.</h1>
            </div>
            <span className="step-label">Question 1 · Level {level}</span>
          </div>
          <label className="topic-select">
            Topic
            <select
              value={topicId}
              onChange={(event) => {
                const nextTopic = event.target.value;
                activeTopicRef.current = nextTopic;
                questionRequestVersion.current += 1;
                setCanRequestGeneratedPractice(false);
                setTopicId(nextTopic);
                setQuestion(topicQuestions[nextTopic] ?? topicQuestions.ratio);
                setDiagramSvg(null);
                setGeneratedPreview(null);
                void loadProgress(nextTopic);
              }}
            >
              {topics.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.label} · {item.grade}
                </option>
              ))}
            </select>
          </label>
          <div className="question-card">
            <div className="question-copy">
              <span className="question-tag">
                {topic.standard} · {topic.grade}
              </span>
              <h2>{question}</h2>
              {isTopicLoading ? (
                <p role="status">
                  {progressError || "Loading your current practice question…"}
                </p>
              ) : (
                <form onSubmit={submitAnswer} className="answer-row">
                  <label className="sr-only" htmlFor="answer">
                    Your answer
                  </label>
                  <input
                    id="answer"
                    inputMode="numeric"
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    placeholder="Type your answer"
                    disabled={isSubmittingAnswer}
                    required
                  />
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={isSubmittingAnswer}
                  >
                    Check answer
                  </button>
                </form>
              )}
              <button
                className="secondary-button generated-practice-button"
                type="button"
                onClick={() => void requestGeneratedPractice()}
                disabled={
                  !canRequestGeneratedPractice ||
                  isSubmittingAnswer ||
                  isTopicLoading
                }
              >
                Try generated practice
              </button>
              {feedback !== null && (
                <p className={feedback.kind} role="status">
                  {feedback.message}
                </p>
              )}
              {generatedPreview !== null && (
                <section
                  className="generated-preview"
                  aria-label="Generated practice preview"
                >
                  <p className="eyebrow">GENERATED PREVIEW</p>
                  <p>{generatedPreview.question}</p>
                  <img
                    className="generated-diagram"
                    src={`data:image/svg+xml,${encodeURIComponent(generatedPreview.diagramSvg)}`}
                    alt={`${topic.label} generated preview diagram`}
                  />
                </section>
              )}
            </div>
            <div className="diagram-card" aria-label="Labeled math diagram">
              {diagramSvg ? (
                <img
                  className="generated-diagram"
                  src={`data:image/svg+xml,${encodeURIComponent(diagramSvg)}`}
                  alt={`${topic.label} diagram`}
                />
              ) : (
                <svg
                  viewBox="0 0 240 150"
                  role="img"
                  aria-labelledby="diagram-title diagram-desc"
                >
                  <title id="diagram-title">
                    {topicId === "linear"
                      ? "Linear relationship"
                      : "Water to flour ratio"}
                  </title>
                  <desc id="diagram-desc">
                    {topicId === "linear"
                      ? "A line rising two units for every one unit across."
                      : "One blue block labeled water beside two gold blocks labeled flour."}
                  </desc>
                  {topicId === "linear" ? (
                    <>
                      <line
                        x1="30"
                        y1="120"
                        x2="210"
                        y2="120"
                        className="axis"
                        stroke="#567063"
                        strokeWidth="2"
                      />
                      <line
                        x1="50"
                        y1="135"
                        x2="50"
                        y2="20"
                        className="axis"
                        stroke="#567063"
                        strokeWidth="2"
                      />
                      <line
                        x1="50"
                        y1="110"
                        x2="140"
                        y2="30"
                        className="water"
                        stroke="#8fc9dc"
                        strokeWidth="3"
                      />
                      <text x="145" y="35">
                        y = 2x
                      </text>
                    </>
                  ) : (
                    <>
                      <rect
                        x="20"
                        y="45"
                        width="60"
                        height="60"
                        rx="12"
                        className="water"
                      />
                      <rect
                        x="95"
                        y="45"
                        width="60"
                        height="60"
                        rx="12"
                        className="flour"
                      />
                      <rect
                        x="170"
                        y="45"
                        width="50"
                        height="60"
                        rx="12"
                        className="flour"
                      />
                      <text x="50" y="130">
                        water
                      </text>
                      <text x="150" y="130">
                        flour
                      </text>
                    </>
                  )}
                </svg>
              )}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
