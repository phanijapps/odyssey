"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { OdysseyA2uiSurface } from "../a2ui-surface";
import {
  parseOdysseyParentPerformanceA2uiDocument,
  type OdysseyParentPerformanceA2uiDocument,
} from "../../a2ui/document";

type Child = { accountId: string; username: string };
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

/** Parent-only local account management and aggregate linked-child progress. */
export default function ParentPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [resetChild, setResetChild] = useState<Child | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [confirmRevoke, setConfirmRevoke] = useState<Child | null>(null);
  const [successNotice, setSuccessNotice] = useState("");
  const [createError, setCreateError] = useState("");
  const [resetError, setResetError] = useState("");
  const [childrenError, setChildrenError] = useState("");
  const [performanceError, setPerformanceError] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [createPending, setCreatePending] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const [revokePending, setRevokePending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [performanceDocument, setPerformanceDocument] =
    useState<OdysseyParentPerformanceA2uiDocument | null>(null);
  const [performanceLoading, setPerformanceLoading] = useState(true);
  const performanceRequest = useRef(0);
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

  const loadPerformance = useCallback(async () => {
    const request = ++performanceRequest.current;
    setPerformanceDocument(null);
    setPerformanceLoading(true);
    try {
      const response = await fetch("/api/parent/performance", {
        cache: "no-store",
      });
      if (request !== performanceRequest.current) return;
      if (!response.ok) {
        setPerformanceDocument(null);
        setPerformanceError(await responseError(response));
        return;
      }
      const body = (await response.json()) as { document?: unknown };
      if (request === performanceRequest.current)
        setPerformanceDocument(
          parseOdysseyParentPerformanceA2uiDocument(body.document),
        );
      setPerformanceError("");
    } catch {
      if (request === performanceRequest.current) {
        setPerformanceDocument(null);
        setPerformanceError("Progress is unavailable right now.");
      }
    } finally {
      if (request === performanceRequest.current) setPerformanceLoading(false);
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
      await Promise.all([loadChildren(), loadPerformance()]);
    })();
  }, [loadChildren, loadPerformance]);

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
      await Promise.all([loadChildren(), loadPerformance()]);
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
      performanceRequest.current += 1;
      setPerformanceDocument(null);
      setPreview(null);
      await Promise.all([loadChildren(), loadPerformance()]);
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
    setConfirmRevoke((current) =>
      current?.accountId === child.accountId ? null : child,
    );
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
      <div className="parent-page">
        <section>
          <p className="eyebrow">FAMILY LEARNING</p>
          <h1>Your children</h1>
          <p className="lede">
            Add an account for each child, then follow their practice and
            progress here.
          </p>
          {successNotice && (
            <p role="status" className="success-box">
              {successNotice}
            </p>
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
        <section className="dash-card" aria-labelledby="children-heading">
          <h2 className="section-title" id="children-heading">
            Your children
          </h2>
          {loading ? (
            <p className="result-meta">Loading accounts…</p>
          ) : childrenError ? (
            <p role="alert" className="error-text">
              {childrenError}
            </p>
          ) : children.length === 0 ? (
            <p className="empty-state">
              No children yet — add the first one above.
            </p>
          ) : (
            <ul className="activity-list">
              {children.map((child) => (
                <li key={child.accountId}>
                  <div className="activity-item">
                    <span className="activity-info">
                      <span className="activity-topic">{child.username}</span>
                    </span>
                    <div className="action-row">
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => openReset(child)}
                      >
                        Reset password
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
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="dash-card" aria-label="Child progress">
          {performanceLoading ? (
            <p className="result-meta">Loading child progress…</p>
          ) : performanceError ? (
            <p role="alert" className="error-text">
              {performanceError}
            </p>
          ) : performanceDocument ? (
            <OdysseyA2uiSurface
              document={performanceDocument}
              surfaceId="odyssey-parent-performance"
            />
          ) : (
            <p className="empty-state">
              Progress appears here once your children practice.
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
