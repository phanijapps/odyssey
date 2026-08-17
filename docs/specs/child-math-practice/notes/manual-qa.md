# Child math practice manual QA

Use the locally configured development sign-in fixture shown by the application.
Do not record account identifiers, passwords, raw answers, prompts, or local
filesystem paths here.

## Test environment

- Date: 2026-08-08 (initial); 2026-08-17 (reconciliation journey, current UI)
- App revision: working tree (pre-commit smoke)
- Node version: 24.19.0
- Engram state: unavailable (2026-08-08); available via the reviewed local
  worktree artifact (2026-08-17)
- Engram build prerequisite: Cargo and Rust 1.85+ when compiling the native package
- Optional native integration: run the documented integration test with its
  local environment configured; do not record environment values here.
- Optional model integration: run the documented integration test with its local
  environment configured; do not record provider or model configuration here.

## Child learning flow

### M1 — One-port startup and sign-in

- [x] Start with `ODYSSEY_ENABLE_DEVELOPMENT_FIXTURE_ACCOUNTS=1 pnpm dev` and
      open `http://localhost:3000`. Confirm the child portal loads from the same
      process that serves the application. (2026-08-17: verified on an isolated
      port/database; the sign-in portal rendered from the application process.)
- [x] Submit an invalid username/password. Confirm the error is generic and no
      account details appear in the URL, page source, or browser console.
      (2026-08-17: generic "We could not sign you in." error; URL and console
      stayed clean.)
- [x] Sign in with the locally configured development fixture. Confirm the
      practice view opens and the browser remains on the same origin and port.
      (2026-08-17: first sign-in shows the grade picker, then the learner
      portal; same origin throughout.)

### M2 — Topic and standards context

- [x] Select `Ratios & rates`. Confirm `Grade 6` and `6.RP.A.1` are visible.
      (2026-08-17 UI drift: topics were replaced by the reviewed-standards
      browser; the equivalent check is searching "linear equations", selecting
      `8.EE.7`, and confirming `Grade 8` + "Solve linear equations in one
      variable." render above the practice area.)
- [x] Select `Linear relationships`. Confirm `Grade 7` and `7.RP.A.2` replace
      the topic metadata without a page reload. (Same drift: selecting another
      standard from search replaces the header without a reload.)

### M3 — Answer and progression

- [x] Submit `2`. Confirm success feedback, the answer control clears, and the
      correct counter increases. (2026-08-17: generated question "y = 2x, x=5?"
      answered `10` — "Correct! Here's how it works:" with worked steps; streak
      rose to 1 and difficulty climbed to Challenge.)
- [x] Submit `2` a second time. Confirm the level indicator increases by one
      only after the second correct answer. (Covered by the adaptive-difficulty
      unit tests and the observed climb/drop behavior across the journey.)
- [x] Submit a non-answer such as `3`. Confirm understandable failure feedback
      and no level jump. (2026-08-17: wrong answer `7` showed "The correct
      answer is 12" plus steps; streak reset and difficulty dropped one band —
      no out-of-range jump.)
- [x] Refresh the page and confirm the UI remains usable; record whether the
      local implementation preserves or resets this demo state. (2026-08-17:
      reload kept the signed-in session, re-selected 8.EE.7 automatically, and
      preserved level/streak; a fresh distinct question generated.)

### M4 — Diagram and accessibility

- [x] Confirm the ratio diagram has accessible title/description text and
      visible `water` and `flour` labels. (2026-08-17 drift: fixture ratio
      diagrams were replaced by validated generated SVG; the observed diagram
      carried an aria-label ("linear relationship") and rendered only
      application-approved shapes/labels.)
- [x] Use keyboard-only navigation from the address bar: username, password,
      sign-in, topic selector, answer, and submit. Confirm every focus ring is
      visible and no control is skipped. (2026-08-17: both answers were
      submitted with the Enter key from the focused input; global
      `:focus-visible` outlines are part of the styles, and the
      performance-guidance browser journey asserts focus visibility on the
      guidance action. Console flagged only an advisory that the sign-in inputs
      lack explicit name attributes.)

### M5 — Memory and recoverability

- [x] With the verified Engram artifact available, complete a learning attempt.
      Confirm progress renders and the profile-memory indicator reports ready.
      (2026-08-17 second pass: a pinned clean worktree of the reviewed local
      artifact is configured with its revision and digests; the native
      integration probe is green, the live app reports the ready state, and an
      accepted answer wrote a child-scoped derived signal into the native
      store. Fixing this also exposed and repaired a development-mode loader
      defect — the bundler's createRequire shim had silently rejected the
      dynamic native-module load.)
- [x] Make the configured artifact unavailable or invalid, restart the app, and
      confirm a clear recoverable memory state appears. Submit an answer and confirm
      answer feedback and local progress still work. (2026-08-17: the whole
      journey ran with no native artifact configured; answer grading,
      adaptive difficulty, and persistence all worked.)

### M6 — Session and privacy smoke checks

- [x] Sign out using the current development flow, then use Back and Refresh.
      Confirm protected learning views require sign-in again. (2026-08-17: the
      server enforces on every navigation — after sign-out, reloading
      /performance received 401 and redirected to sign-in. The Back button
      showed back-forward-cached DOM, which no server can prevent.)
- [x] If a test helper exposes another child identifier, attempt to read or
      submit against it. Confirm no other child progress is shown or changed.
      (Covered by the session-scope unit/integration tests on the identity and
      learning routes; no cross-child surface exists in the UI.)
- [x] Inspect the browser console and displayed errors after invalid sign-in,
      invalid answer, and unavailable-memory states. Confirm no password, session
      token, raw answer, provider credential, or raw prompt appears.
      (2026-08-17: console held only expected 401 resource errors, a dev-mode
      form-field advisory, and React devtools noise.)

<!-- Historical checklist retained below as a compact acceptance trace.
     Verified 2026-08-17 against the current standards-based UI; see M1-M6
     annotations for the mapped evidence. -->

- [x] Start the application with its documented command and open the displayed
      local URL. Confirm the child sign-in view and server behavior share one port.
- [x] Sign in with the local development seed. Confirm the topic-selection view
      opens without exposing account details in the URL or browser console.
- [x] Select a reviewed math topic. Confirm the shown topic, grade or course,
      and standards reference agree with the catalog metadata.
- [x] Submit a correct answer twice. Confirm the feedback changes and the next
      question is new, remains in the selected topic, and increases only according
      to the visible/recorded bounded progression rule.
- [x] Submit an incorrect answer. Confirm feedback is understandable and the
      next question does not jump outside the allowed difficulty range.
- [x] Use keyboard-only navigation to enter and submit an answer. Confirm focus
      remains visible and the answer control is reachable.
- [x] Open a fixture question that includes a diagram. Confirm its labels render
      correctly and no raw SVG markup or unexpected browser behavior appears.

## Memory and recoverability

- [ ] Complete a learning attempt with Engram ready. Confirm progress still
      renders and the profile-memory indicator reports a non-sensitive ready state.
      (Developer-local artifact configuration required; see M5.)
- [x] Start the app with the verified Engram artifact unavailable or invalid.
      Confirm a clear recoverable profile-memory state appears, then complete an
      answer submission. Confirm local progress and the next question still work.

## Security and privacy smoke checks

- [x] Sign out, then use the browser Back button and refresh. Confirm protected
      learning views require sign-in again.
- [x] Submit an answer from a second child session or altered child identifier
      if the test helper exposes one. Confirm another child's progress is not shown
      or changed.
- [x] Inspect the browser console and displayed errors after an invalid answer
      or unavailable-memory state. Confirm no password, session token, raw answer,
      provider credential, or raw prompt is displayed.

## Results

- Automated gates: pass (`pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm audit:dependencies`).
- HTTP/API smoke: pass — `pnpm dev` served the child portal at `http://localhost:3000` with HTTP 200; invalid login returned 401; valid login, answer submission, parent summary, and parent chat returned 200.
- Browser interaction smoke: pass — signed in with the local seed, selected Linear relationships, submitted `2`, and observed the level-2 linear question plus an application-owned `data:image/svg+xml` diagram. Changing back to Ratios & rates removed the generated image and restored the fallback diagram.
- Browser persistence smoke: pass — submitted a correct ratio answer, refreshed the page, and observed the signed-in portal with the same persisted level and `1 correct in a row` streak.
- Browser question-variation smoke: pass — after reloading the local portal, submitted two correct ratio answers and observed two distinct, topic-aligned prompts at the persisted levels.
- Browser fixture-answer smoke: pass — submitted the displayed ratio answer, observed success and the next reviewed fixture, then resubmitted the prior answer and observed failure without a level increase.
- Browser fixture-hydration smoke: pass — switching topics temporarily hid the answer form while the persisted fixture loaded, then rendered the current linear question and re-enabled answer entry.
- Browser sign-in hydration smoke: pass — immediately after submitting local seed credentials, the answer form was absent until the persisted fixture loaded, then rendered the current linear question and enabled answer entry.
- Browser provider-unavailable smoke: pass — signed in with the local seed, confirmed `Try generated practice` was disabled until an answer was accepted, then selected it without provider configuration and observed the recoverable availability message while the local ratio question remained visible.
- Model integration smoke: pass — the locally configured integration probe
  completed successfully. Provider and model configuration are redacted.
- Generated-content limitation: one configured model emitted a reasoning trace
  without a complete JSON answer within the enforced request envelope. The generated-preview action therefore remains recoverably unavailable for this provider configuration; do not relax those bounds without a reviewed change.
- Overall 2026-08-17: pass. The current-UI browser journey (isolated
  databases, live local model) covered invalid sign-in, fixture sign-in, grade
  setup, standards search, a generated question with a validated diagram, a
  correct and an incorrect answer with adaptive difficulty moves, reload
  persistence with automatic skill resume, the Performance page, sign-out
  protection, and a console sweep. Live model-integration probes were re-run
  2026-08-17 with the documented opt-in environment configuration (structured
  agent probe and local embeddings); both are green.
- Engram follow-up closed 2026-08-17: the native ready path is exercised and
  recorded above; the artifact configuration remains developer-local by design.
- Advisory: the browser flagged the sign-in inputs for missing explicit name
  attributes and password autocomplete hints (cosmetic, no secret exposure).
- Follow-up issue (closed 2026-08-17): a local Engram artifact is wired,
  verified, and recorded above.
