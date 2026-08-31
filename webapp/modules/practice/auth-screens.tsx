"use client";

import { FormEvent } from "react";

type SignInCardProps = {
  username: string;
  password: string;
  error: string;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

/** The sign-in screen shown to every persona before routing. */
export function SignInCard({
  username,
  password,
  error,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
}: SignInCardProps) {
  return (
    <main className="shell auth-shell">
      <section className="auth-card">
        <div className="brand-mark">O</div>
        <p className="eyebrow">ODYSSEY LEARNING</p>
        <h1>A calmer way to get better at math.</h1>
        <p className="lede">Search a skill, start practicing.</p>
        <form className="stack" onSubmit={onSubmit}>
          <label>
            Username
            <input
              value={username}
              onChange={(e) => onUsernameChange(e.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
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

type GradePickerProps = {
  choices: readonly string[];
  onPick: (grade: string) => void;
};

/** First-time setup: pick a grade before browsing skills. */
export function GradePicker({ choices, onPick }: GradePickerProps) {
  return (
    <main className="shell auth-shell">
      <section className="auth-card">
        <div className="brand-mark">O</div>
        <p className="eyebrow">WELCOME TO ODYSSEY</p>
        <h1>What grade are you in?</h1>
        <p className="lede">We&apos;ll start you there.</p>
        <div className="grade-picker">
          {choices.map((grade) => (
            <button
              key={grade}
              className="grade-chip"
              onClick={() => onPick(grade)}
            >
              {grade}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
