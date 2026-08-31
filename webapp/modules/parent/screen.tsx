"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { formatPracticePhrases } from "./performance-phrases";

type Child = { accountId: string; username: string };
type PerformanceFacts = {
  practice: {
    correctPracticeAttempts: number;
    activePracticeDayStreak: number;
    lastPracticedDaysAgo: number | null;
  };
  tests: { completed: number; partial: number };
  nextPractice: {
    recommended: number;
    practicing: number;
    checkpointMet: number;
  };
};
type ChildProgress = { username: string; performance: PerformanceFacts };
type PracticePreview = {
  childUsername: string;
  standardCode: string;
  standardText: string;
  question: string;
  diagramSvg: string | null;
} | null;
async function responseError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as {
    error?: unknown;
  } | null;
  return typeof body?.error === "string" ? body.error : "Request failed";
}

/** Parent-only local account management and per-child aggregate progress. */
export function ParentScreen() {
  const [children, setChildren] = useState<Child[]>([]);
  const [progress, setProgress] = useState<ChildProgress[] | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [resetChild, setResetChild] = useState<Child | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [confirmRevoke, setConfirmRevoke] = useState<Child | null>(null);
  const [suggestPanel, setSuggestPanel] = useState<string | null>(null);
  const [suggestData, setSuggestData] = useState<
    Record<
      string,
      {
        recommended: { standardCode: string; standardText: string }[];
        active: { standardCode: string; standardText: string } | null;
      }
    >
  >({});
  const [suggestLoading, setSuggestLoading] = useState<string | null>(null);
  const [suggestError, setSuggestError] = useState("");
  const [suggestPick, setSuggestPick] = useState<string | null>(null);
  const [suggestPending, setSuggestPending] = useState(false);
  const [successNotice, setSuccessNotice] = useState("");
  const [createError, setCreateError] = useState("");
  const [resetError, setResetError] = useState("");
  const [childrenError, setChildrenError] = useState("");
  const [progressError, setProgressError] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [createPending, setCreatePending] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const [revokePending, setRevokePending] = useState(false);
  const [loading, setLoading] = useState(true);
  const progressRequest = useRef(0);
  const [preview, setPreview] = useState<PracticePreview | null>(null);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadChildren = useCallback(async () => {
    const response = await fetch("/api/parent/children", { cache: "no-store" });
    if (!response.ok) {
      setChildren([]);
      setResetChild(null);
      setConfirmRevoke(null);
      setChildrenError(await responseError(response));
      setLoading(false);
      return;
    }
    const body = (await response.json()) as { children?: Child[] };
    setChildren(body.children ?? []);
    setChildrenError("");
    setLoading(false);
  }, []);

  const loadProgress = useCallback(async () => {
    const request = ++progressRequest.current;
    try {
      const response = await fetch("/api/parent/performance", {
        cache: "no-store",
      });
      if (request !== progressRequest.current) return;
      if (!response.ok) {
        setProgress(null);
        setProgressError(await responseError(response));
        return;
      }
      const body = (await response.json()) as { children?: ChildProgress[] };
      if (request === progressRequest.current) {
        setProgress(body.children ?? []);
        setProgressError("");
      }
    } catch {
      if (request === progressRequest.current) {
        setProgress(null);
        setProgressError("Progress is unavailable right now.");
      }
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const session = await fetch("/api/session", { cache: "no-store" });
      if (!session.ok) {
        window.location.assign("/");
        return;
      }
      const account = (await session.json()) as { role?: string };
      if (account.role !== "parent") {
        window.location.assign("/");
        return;
      }
      await Promise.all([loadChildren(), loadProgress()]);
    })();
  }, [loadChildren, loadProgress]);

  async function loadPreview() {
    setPreviewLoading(true);
    setPreviewError("");
    try {
      const response = await fetch("/api/parent/preview", {
        cache: "no-store",
      });
      if (!response.ok) {
        setPreview(null);
        setPreviewLoaded(false);
        setPreviewError(await responseError(response));
        return;
      }
      const body = (await response.json()) as { preview?: PracticePreview };
      setPreview(body.preview ?? null);
      setPreviewLoaded(true);
    } catch {
      setPreview(null);
      setPreviewLoaded(false);
      setPreviewError("Practice preview is unavailable right now.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function createChild(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccessNotice("");
    setCreateError("");
    setCreatePending(true);
    try {
      const response = await fetch("/api/parent/children", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: window.location.origin,
        },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        setCreateError(await responseError(response));
        return;
      }
      const createdUsername = username;
      setUsername("");
      setPassword("");
      setSuccessNotice(`Account created for ${createdUsername}.`);
      setPreview(null);
      await Promise.all([loadChildren(), loadProgress()]);
    } finally {
      setCreatePending(false);
    }
  }

  async function resetChildPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resetChild) return;
    setSuccessNotice("");
    setResetError("");
    setResetPending(true);
    try {
      const response = await fetch(
        `/api/parent/children/${resetChild.accountId}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            origin: window.location.origin,
          },
          body: JSON.stringify({ password: resetPassword }),
        },
      );
      if (!response.ok) {
        setResetError(await responseError(response));
        return;
      }
      setSuccessNotice(
        `Password reset for ${resetChild.username}. They will need to sign in again.`,
      );
      setResetPassword("");
      setResetChild(null);
    } finally {
      setResetPending(false);
    }
  }

  async function revokeChild(child: Child) {
    setSuccessNotice("");
    setChildrenError("");
    setRevokePending(true);
    try {
      const response = await fetch(`/api/parent/children/${child.accountId}`, {
        method: "DELETE",
        headers: { origin: window.location.origin },
      });
      if (!response.ok) {
        setChildrenError(await responseError(response));
        return;
      }
      setSuccessNotice(`Access revoked for ${child.username}.`);
      setConfirmRevoke(null);
      setProgress(null);
      setPreview(null);
      await Promise.all([loadChildren(), loadProgress()]);
    } finally {
      setRevokePending(false);
    }
  }

  function openReset(child: Child) {
    setConfirmRevoke(null);
    setResetError("");
    setResetChild((current) =>
      current?.accountId === child.accountId ? null : child,
    );
  }

  function openRevokeConfirm(child: Child) {
    setResetChild(null);
    setResetError("");
    setSuggestPanel(null);
    setConfirmRevoke((current) =>
      current?.accountId === child.accountId ? null : child,
    );
  }

  async function loadSuggestionState(child: Child): Promise<void> {
    setSuggestLoading(child.accountId);
    setSuggestError("");
    try {
      const response = await fetch(
        `/api/parent/children/${child.accountId}/suggestions`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        setSuggestError(
          "Recommendations are unavailable right now. Try again in a moment.",
        );
        return;
      }
      const body = (await response.json()) as {
        recommended?: { standardCode: string; standardText: string }[];
        active?: { standardCode: string; standardText: string } | null;
      };
      setSuggestData((current) => ({
        ...current,
        [child.accountId]: {
          recommended: body.recommended ?? [],
          active: body.active ?? null,
        },
      }));
    } catch {
      setSuggestError(
        "Recommendations are unavailable right now. Try again in a moment.",
      );
    } finally {
      setSuggestLoading(null);
    }
  }

  function openSuggest(child: Child) {
    setResetChild(null);
    setConfirmRevoke(null);
    setSuggestError("");
    setSuggestPick(null);
    setSuggestPanel((current) => {
      if (current === child.accountId) return null;
      void loadSuggestionState(child);
      return child.accountId;
    });
  }

  async function suggestForChild(
    child: Child,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!suggestPick) return;
    setSuggestPending(true);
    setSuggestError("");
    try {
      const response = await fetch(
        `/api/parent/children/${child.accountId}/suggestions`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: window.location.origin,
          },
          body: JSON.stringify({ standardCode: suggestPick }),
        },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setSuggestError(
          body.error === "Standard is not in the child's current plan"
            ? "That skill just left the recommended list. Reopen to refresh."
            : "Unable to suggest practice right now.",
        );
        await loadSuggestionState(child);
        return;
      }
      setSuccessNotice(`Practice suggested for ${child.username}.`);
      setSuggestPick(null);
      await loadSuggestionState(child);
    } finally {
      setSuggestPending(false);
    }
  }

  async function cancelSuggestionForChild(child: Child) {
    setSuggestPending(true);
    setSuggestError("");
    try {
      const response = await fetch(
        `/api/parent/children/${child.accountId}/suggestions`,
        {
          method: "DELETE",
          headers: { origin: window.location.origin },
        },
      );
      if (!response.ok) {
        setSuggestError("Unable to cancel the suggestion right now.");
        return;
      }
      setSuccessNotice(`Suggestion cancelled for ${child.username}.`);
      await loadSuggestionState(child);
    } finally {
      setSuggestPending(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="wordmark" href="/parent">
          <span className="small-mark">O</span>
          Odyssey
        </a>
        <span className="eyebrow">PARENT PORTAL</span>
        <button
          type="button"
          className="secondary-btn"
          onClick={async () => {
            await fetch("/api/session", { method: "DELETE" });
            window.location.assign("/");
          }}
        >
          Sign out
        </button>
      </header>
      <div className="narrow-page">
        <section>
          <p className="eyebrow">FAMILY LEARNING</p>
          <h1>Your children</h1>
          <p className="lede">
            Follow each child&apos;s practice and progress, and manage their
            accounts.
          </p>
          {successNotice && (
            <p role="status" className="success-box">
              {successNotice}
            </p>
          )}
        </section>
        <section className="dash-card" aria-labelledby="children-heading">
          <h2 className="section-title" id="children-heading">
            Your children
          </h2>
          {progressError && (
            <p role="alert" className="error-text">
              {progressError}
            </p>
          )}
          {loading ? (
            <p className="result-meta">Loading accounts…</p>
          ) : childrenError ? (
            <p role="alert" className="error-text">
              {childrenError}
            </p>
          ) : children.length === 0 ? (
            <p className="empty-state">
              No children yet — add the first one below.
            </p>
          ) : (
            <div className="record-list">
              {children.map((child) => {
                // Both this list and the progress projection derive from the
                // same listParentChildren query (active links, username
                // ascending), so the username join cannot miss a child.
                const facts = progress?.find(
                  (entry) => entry.username === child.username,
                )?.performance;
                const phrases = facts ? formatPracticePhrases(facts) : null;
                return (
                  <div key={child.accountId} className="dash-card record-card">
                    <div className="record-header">
                      <div className="record-main">
                        <span className="record-code">{child.username}</span>
                      </div>
                      <div className="action-row">
                        <a
                          className="secondary-btn"
                          href={`/api/parent/children/${child.accountId}/export`}
                          download
                        >
                          Export progress
                        </a>
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() => openReset(child)}
                        >
                          Reset password
                        </button>
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() => openSuggest(child)}
                        >
                          Suggest practice…
                        </button>
                        <button
                          type="button"
                          className="clear-btn"
                          onClick={() => openRevokeConfirm(child)}
                        >
                          Revoke…
                        </button>
                      </div>
                    </div>
                    {phrases && facts && (
                      <div className="record-detail">
                        <p className="record-text">
                          {phrases.answers} · {phrases.streak} ·{" "}
                          {phrases.recency}.
                        </p>
                        <p className="record-text">
                          Tests: {facts.tests.completed} completed,{" "}
                          {facts.tests.partial} partial · Next Practice:{" "}
                          {facts.nextPractice.recommended} recommended,{" "}
                          {facts.nextPractice.practicing} practicing,{" "}
                          {phrases.checkpoints}.
                        </p>
                      </div>
                    )}
                    {resetChild?.accountId === child.accountId && (
                      <form
                        onSubmit={resetChildPassword}
                        className="stack"
                        aria-label={`Reset ${child.username}'s password`}
                      >
                        <label>
                          New temporary password
                          <input
                            required
                            autoFocus
                            type="password"
                            minLength={8}
                            maxLength={256}
                            autoComplete="new-password"
                            value={resetPassword}
                            onChange={(event) =>
                              setResetPassword(event.target.value)
                            }
                          />
                        </label>
                        <p className="hint">
                          This signs {child.username} out of Odyssey everywhere.
                        </p>
                        <div className="action-row">
                          <button
                            className="primary-btn"
                            type="submit"
                            disabled={resetPending}
                          >
                            {resetPending ? "Resetting…" : "Reset password"}
                          </button>
                          <button
                            type="button"
                            className="secondary-btn"
                            onClick={() => {
                              setResetChild(null);
                              setResetPassword("");
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                        {resetError && (
                          <p role="alert" className="error-text">
                            {resetError}
                          </p>
                        )}
                      </form>
                    )}
                    {confirmRevoke?.accountId === child.accountId && (
                      <div>
                        <p className="result-meta">
                          Revoke {child.username}&apos;s access? They are signed
                          out everywhere; their progress is kept.
                        </p>
                        <div className="action-row">
                          <button
                            type="button"
                            className="clear-btn"
                            disabled={revokePending}
                            onClick={() => void revokeChild(child)}
                          >
                            {revokePending ? "Revoking…" : "Revoke access"}
                          </button>
                          <button
                            type="button"
                            className="secondary-btn"
                            onClick={() => setConfirmRevoke(null)}
                          >
                            Keep access
                          </button>
                        </div>
                      </div>
                    )}
                    {suggestPanel === child.accountId && (
                      <div className="record-detail">
                        <h3 className="section-title">
                          Tonight&apos;s practice for {child.username}
                        </h3>
                        {suggestLoading === child.accountId ? (
                          <p className="result-meta">
                            Loading recommendations…
                          </p>
                        ) : (
                          <>
                            {suggestError && (
                              <p role="alert" className="error-text">
                                {suggestError}
                              </p>
                            )}
                            {suggestData[child.accountId]?.active ? (
                              <div>
                                <p className="record-text">
                                  Suggested:{" "}
                                  {
                                    suggestData[child.accountId].active
                                      ?.standardCode
                                  }{" "}
                                  —{" "}
                                  {
                                    suggestData[child.accountId].active
                                      ?.standardText
                                  }
                                </p>
                                <div className="action-row">
                                  <button
                                    type="button"
                                    className="clear-btn"
                                    disabled={suggestPending}
                                    onClick={() =>
                                      void cancelSuggestionForChild(child)
                                    }
                                  >
                                    {suggestPending
                                      ? "Cancelling…"
                                      : "Cancel suggestion"}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              suggestData[child.accountId] &&
                              suggestData[child.accountId].recommended.length >
                                0 && (
                                <form
                                  onSubmit={(event) =>
                                    void suggestForChild(child, event)
                                  }
                                >
                                  <p className="result-meta">
                                    Pick one recommended skill:
                                  </p>
                                  <div className="suggested-queries">
                                    {suggestData[
                                      child.accountId
                                    ].recommended.map((item) => (
                                      <button
                                        key={item.standardCode}
                                        type="button"
                                        className={
                                          suggestPick === item.standardCode
                                            ? "std-chip selected"
                                            : "std-chip"
                                        }
                                        onClick={() =>
                                          setSuggestPick(item.standardCode)
                                        }
                                      >
                                        {item.standardCode}
                                      </button>
                                    ))}
                                  </div>
                                  <div className="action-row">
                                    <button
                                      className="primary-btn"
                                      type="submit"
                                      disabled={!suggestPick || suggestPending}
                                    >
                                      {suggestPending
                                        ? "Suggesting…"
                                        : "Suggest for tonight"}
                                    </button>
                                  </div>
                                </form>
                              )
                            )}
                            {suggestData[child.accountId] &&
                              suggestData[child.accountId].recommended
                                .length === 0 &&
                              !suggestData[child.accountId].active && (
                                <p className="result-meta">
                                  No recommended skills yet — they appear after{" "}
                                  {child.username} takes a test.
                                </p>
                              )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
        <section className="dash-card" aria-labelledby="create-child-heading">
          <h2 className="section-title" id="create-child-heading">
            Add a child account
          </h2>
          <form onSubmit={createChild} className="stack">
            <label>
              Child username
              <input
                required
                minLength={3}
                maxLength={64}
                autoComplete="off"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </label>
            <label>
              Temporary password
              <input
                required
                type="password"
                minLength={8}
                maxLength={256}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <div className="action-row">
              <button
                className="primary-btn"
                type="submit"
                disabled={createPending}
              >
                {createPending ? "Adding…" : "Add child"}
              </button>
            </div>
          </form>
          {createError && (
            <p role="alert" className="error-text">
              {createError}
            </p>
          )}
        </section>
        <section className="dash-card" aria-labelledby="preview-heading">
          <h2 className="section-title" id="preview-heading">
            Preview next practice
          </h2>
          <p className="hint">
            See one child&apos;s next recommended skill. A preview never changes
            your child&apos;s practice.
          </p>
          <div className="action-row">
            <button
              type="button"
              className="secondary-btn"
              onClick={() => void loadPreview()}
              disabled={previewLoading}
            >
              {previewLoading ? "Loading preview…" : "Show preview"}
            </button>
          </div>
          {previewError && (
            <p role="alert" className="error-text">
              {previewError}
            </p>
          )}
          {previewLoaded && !preview && !previewLoading && (
            <p role="status" className="result-meta">
              No preview yet — one appears here after a child takes a test.
            </p>
          )}
          {preview && (
            <div className="question-card">
              <div className="question-copy">
                <p className="eyebrow">
                  {preview.childUsername} · NEXT PRACTICE
                </p>
                <h3 className="practice-skill">{preview.standardCode}</h3>
                <p className="practice-desc">{preview.standardText}</p>
                <h4 className="question-text">{preview.question}</h4>
                {preview.diagramSvg && (
                  <div className="diagram-card">
                    <img
                      className="generated-diagram"
                      alt="preview diagram"
                      src={`data:image/svg+xml,${encodeURIComponent(
                        preview.diagramSvg,
                      )}`}
                    />
                  </div>
                )}
                <p className="hint">
                  Preview only — nothing is recorded for your child.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
