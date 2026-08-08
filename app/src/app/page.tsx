"use client";

import { FormEvent, useState } from "react";

const topics = [
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

export default function HomePage() {
  const [signedIn, setSignedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [topicId, setTopicId] = useState("ratio");
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [level, setLevel] = useState(1);
  const [correctCount, setCorrectCount] = useState(0);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (response.ok) {
      setSignedIn(true);
      setError("");
    } else {
      setError("We could not sign you in. Check your details and try again.");
    }
  }

  async function submitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const correct = answer.trim() === "2";
    const nextCorrect = correct ? correctCount + 1 : correctCount;
    setCorrectCount(nextCorrect);
    setLevel(
      correct && nextCorrect % 2 === 0 ? Math.min(level + 1, 13) : level,
    );
    setFeedback(
      correct
        ? "Nice work — your next question is ready."
        : "Not quite yet. Try the ratio again.",
    );
    await fetch("/api/answer", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: window.location.origin,
      },
      body: JSON.stringify({
        topicId,
        answer,
        nextLevel:
          correct && nextCorrect % 2 === 0 ? Math.min(level + 1, 13) : level,
      }),
    });
    setAnswer("");
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
      </header>
      <section className="portal-grid">
        <aside className="sidebar" aria-label="Learning navigation">
          <p className="eyebrow">YOUR PRACTICE</p>
          <h2>Keep your curiosity moving.</h2>
          <div className="progress-card">
            <span className="progress-ring">{level}</span>
            <div>
              <strong>Level {level}</strong>
              <small>{correctCount} correct today</small>
            </div>
          </div>
          <p className="memory-state">
            <span className="status-dot" /> Profile memory ready
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
              onChange={(event) => setTopicId(event.target.value)}
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
              <h2>
                A recipe uses 1 cup of water for every 2 cups of flour. What is
                the ratio of water to flour?
              </h2>
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
                  required
                />
                <button className="primary-button" type="submit">
                  Check answer
                </button>
              </form>
              {feedback && (
                <p
                  className={feedback.startsWith("Nice") ? "success" : "error"}
                  role="status"
                >
                  {feedback}
                </p>
              )}
            </div>
            <div className="diagram-card" aria-label="Labeled ratio diagram">
              <svg
                viewBox="0 0 240 150"
                role="img"
                aria-labelledby="diagram-title diagram-desc"
              >
                <title id="diagram-title">Water to flour ratio</title>
                <desc id="diagram-desc">
                  One blue block labeled water beside two gold blocks labeled
                  flour.
                </desc>
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
              </svg>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
