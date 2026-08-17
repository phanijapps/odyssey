"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { OdysseyA2uiSurface } from "../a2ui-surface";
import {
  parseOdysseyParentPerformanceA2uiDocument,
  type OdysseyParentPerformanceA2uiDocument,
} from "../../a2ui/document";

type Child = { accountId: string; username: string };
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
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [performanceDocument, setPerformanceDocument] =
    useState<OdysseyParentPerformanceA2uiDocument | null>(null);
  const [performanceLoading, setPerformanceLoading] = useState(true);
  const performanceRequest = useRef(0);

  const loadChildren = useCallback(async () => {
    const response = await fetch("/api/parent/children", { cache: "no-store" });
    if (!response.ok) {
      setMessage(await responseError(response));
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
        setMessage(await responseError(response));
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
        setMessage("Performance is unavailable");
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

  async function createChild(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/parent/children", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
      setMessage(await responseError(response));
      return;
    }
    setUsername("");
    setPassword("");
    setMessage("Child account created.");
    await Promise.all([loadChildren(), loadPerformance()]);
  }

  async function resetChildPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resetChild) return;
    setMessage("");
    const response = await fetch(
      `/api/parent/children/${resetChild.accountId}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: resetPassword }),
      },
    );
    if (!response.ok) {
      setMessage(await responseError(response));
      return;
    }
    setResetPassword("");
    setResetChild(null);
    setMessage(`Password reset for ${resetChild.username}.`);
  }

  async function revokeChild(child: Child) {
    if (!window.confirm(`Revoke access to ${child.username}?`)) return;
    setMessage("");
    const response = await fetch(`/api/parent/children/${child.accountId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setMessage(await responseError(response));
      return;
    }
    setMessage("Child access revoked.");
    performanceRequest.current += 1;
    setPerformanceDocument(null);
    await Promise.all([loadChildren(), loadPerformance()]);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/parent">
          odyssey
        </a>
        <span className="eyebrow">PARENT PORTAL</span>
        <button
          type="button"
          onClick={async () => {
            await fetch("/api/session", { method: "DELETE" });
            window.location.assign("/");
          }}
        >
          Sign out
        </button>
      </header>
      <section className="hero">
        <p className="eyebrow">FAMILY LEARNING</p>
        <h1>Manage child accounts</h1>
        <p>
          Create and manage child accounts. Aggregate Practice, Test, and
          next-Practice evidence is available only for active linked children.
        </p>
      </section>
      <section className="panel" aria-labelledby="create-child-heading">
        <h2 id="create-child-heading">Create child account</h2>
        <form onSubmit={createChild} className="answer-form">
          <label>
            Child username
            <input
              required
              minLength={3}
              maxLength={64}
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
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button className="primary" type="submit">
            Create child
          </button>
        </form>
      </section>
      <section className="panel" aria-labelledby="children-heading">
        <h2 id="children-heading">Linked children</h2>
        {loading ? (
          <p>Loading accounts…</p>
        ) : children.length === 0 ? (
          <p>No child accounts are linked yet.</p>
        ) : (
          <ul className="history-list">
            {children.map((child) => (
              <li key={child.accountId}>
                <span>{child.username}</span>
                <button type="button" onClick={() => setResetChild(child)}>
                  Reset password
                </button>
                <button type="button" onClick={() => void revokeChild(child)}>
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="panel" aria-labelledby="child-performance-heading">
        <h2 id="child-performance-heading">Child Performance</h2>
        {performanceLoading ? (
          <p>Loading child Performance…</p>
        ) : performanceDocument ? (
          <OdysseyA2uiSurface
            document={performanceDocument}
            surfaceId="odyssey-parent-performance"
          />
        ) : (
          <p>No active linked-child Performance is available yet.</p>
        )}
      </section>
      {resetChild && (
        <section className="panel" aria-labelledby="reset-password-heading">
          <h2 id="reset-password-heading">
            Reset {resetChild.username}&apos;s password
          </h2>
          <form onSubmit={resetChildPassword} className="answer-form">
            <label>
              New temporary password
              <input
                required
                autoFocus
                type="password"
                minLength={8}
                maxLength={256}
                value={resetPassword}
                onChange={(event) => setResetPassword(event.target.value)}
              />
            </label>
            <button className="primary" type="submit">
              Reset password
            </button>
            <button
              type="button"
              onClick={() => {
                setResetChild(null);
                setResetPassword("");
              }}
            >
              Cancel
            </button>
          </form>
        </section>
      )}
      {message && (
        <p role="status" className="error">
          {message}
        </p>
      )}
    </main>
  );
}
