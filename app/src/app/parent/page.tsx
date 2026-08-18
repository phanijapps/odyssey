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
type Notice = { text: string; kind: "success" | "error" };
async function responseError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as {
    error?: unknown;
  } | null;
  return typeof body?.error === "string" ? body.error : "Request failed";
}

/** Parent-only local account management and aggregate linked-child Performance. */
export default function ParentPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [resetChild, setResetChild] = useState<Child | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [createPending, setCreatePending] = useState(false);
  const [resetPending, setResetPending] = useState(false);
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
      setNotice({ text: await responseError(response), kind: "error" });
      setLoading(false);
      return;
    }
    const body = (await response.json()) as { children?: Child[] };
    setChildren(body.children ?? []);
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
        setNotice({ text: await responseError(response), kind: "error" });
        return;
      }
      const body = (await response.json()) as { document?: unknown };
      if (request === performanceRequest.current)
        setPerformanceDocument(
          parseOdysseyParentPerformanceA2uiDocument(body.document),
        );
    } catch {
      if (request === performanceRequest.current) {
        setPerformanceDocument(null);
        setNotice({ text: "Performance is unavailable", kind: "error" });
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
    try {
      const response = await fetch("/api/parent/preview", {
        cache: "no-store",
      });
      if (!response.ok) {
        setNotice({ text: await responseError(response), kind: "error" });
        return;
      }
      const body = (await response.json()) as { preview?: PracticePreview };
      setPreview(body.preview ?? null);
      setPreviewLoaded(true);
    } catch {
      setNotice({ text: "Practice preview is unavailable", kind: "error" });
    } finally {
      setPreviewLoading(false);
    }
  }

  async function createChild(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setCreatePending(true);
    try {
      const response = await fetch("/api/parent/children", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        setNotice({ text: await responseError(response), kind: "error" });
        return;
      }
      setUsername("");
      setPassword("");
      setNotice({ text: "Child account created.", kind: "success" });
      setPreview(null);
      await Promise.all([loadChildren(), loadPerformance()]);
    } finally {
      setCreatePending(false);
    }
  }

  async function resetChildPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resetChild) return;
    setNotice(null);
    setResetPending(true);
    try {
      const response = await fetch(
        `/api/parent/children/${resetChild.accountId}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password: resetPassword }),
        },
      );
      if (!response.ok) {
        setNotice({ text: await responseError(response), kind: "error" });
        return;
      }
      setResetPassword("");
      setResetChild(null);
      setNotice({
        text: `Password reset for ${resetChild.username}.`,
        kind: "success",
      });
    } finally {
      setResetPending(false);
    }
  }

  async function revokeChild(child: Child) {
    if (!window.confirm(`Revoke access to ${child.username}?`)) return;
    setNotice(null);
    const response = await fetch(`/api/parent/children/${child.accountId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setNotice({ text: await responseError(response), kind: "error" });
      return;
    }
    setNotice({ text: "Child access revoked.", kind: "success" });
    performanceRequest.current += 1;
    setPerformanceDocument(null);
    setPreview(null);
    await Promise.all([loadChildren(), loadPerformance()]);
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
          <h1>Manage child accounts</h1>
          <p className="lede">
            Create and manage child accounts. Aggregate Practice, Test, and
            next-Practice evidence is available only for active linked children.
          </p>
        </section>
        <section className="dash-card" aria-labelledby="create-child-heading">
          <h2 className="section-title" id="create-child-heading">
            Create child account
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
            <button
              className="primary-btn"
              type="submit"
              disabled={createPending}
            >
              {createPending ? "Creating…" : "Create child"}
            </button>
          </form>
        </section>
        <section className="dash-card" aria-labelledby="children-heading">
          <h2 className="section-title" id="children-heading">
            Linked children
          </h2>
          {loading ? (
            <p className="result-meta">Loading accounts…</p>
          ) : children.length === 0 ? (
            <p className="empty-state">No child accounts are linked yet.</p>
          ) : (
            <ul className="activity-list">
              {children.map((child) => (
                <li key={child.accountId} className="activity-item">
                  <span className="activity-info">
                    <span className="activity-topic">{child.username}</span>
                  </span>
                  <div className="action-row">
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => setResetChild(child)}
                    >
                      Reset password
                    </button>
                    <button
                      type="button"
                      className="clear-btn"
                      onClick={() => void revokeChild(child)}
                    >
                      Revoke
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="dash-card" aria-label="Child Performance">
          <h2 className="section-title">Child Performance</h2>
          {performanceLoading ? (
            <p className="result-meta">Loading child Performance…</p>
          ) : performanceDocument ? (
            <OdysseyA2uiSurface
              document={performanceDocument}
              surfaceId="odyssey-parent-performance"
            />
          ) : (
            <p className="empty-state">
              No active linked-child Performance is available yet.
            </p>
          )}
        </section>
        <section className="dash-card" aria-labelledby="preview-heading">
          <h2 className="section-title" id="preview-heading">
            Preview recommended practice
          </h2>
          <p className="hint">
            See one reviewed sample of a linked child&apos;s next recommended
            skill. A preview never affects your child&apos;s practice.
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
          {previewLoaded && !preview && !previewLoading && (
            <p role="status" className="result-meta">
              No recommended practice preview is available yet.
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
                      src={`data:image/svg+xml,${encodeURIComponent(preview.diagramSvg)}`}
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
        {resetChild && (
          <section
            className="dash-card"
            aria-labelledby="reset-password-heading"
          >
            <h2 className="section-title" id="reset-password-heading">
              Reset {resetChild.username}&apos;s password
            </h2>
            <form onSubmit={resetChildPassword} className="stack">
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
                  onChange={(event) => setResetPassword(event.target.value)}
                />
              </label>
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
            </form>
          </section>
        )}
        {notice && (
          <p
            role="status"
            className={notice.kind === "success" ? "success-box" : "error-text"}
          >
            {notice.text}
          </p>
        )}
      </div>
    </main>
  );
}
