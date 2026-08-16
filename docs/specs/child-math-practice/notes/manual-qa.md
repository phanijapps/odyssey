# Child math practice manual QA

Use the locally configured development sign-in fixture shown by the application.
Do not record account identifiers, passwords, raw answers, prompts, or local
filesystem paths here.

## Test environment

- Date: 2026-08-08
- App revision: working tree (pre-commit smoke)
- Node version: 24.19.0
- Engram state: unavailable (no local native artifact configured)
- Engram build prerequisite: Cargo and Rust 1.85+ when compiling the native package
- Optional native integration: run the documented integration test with its
  local environment configured; do not record environment values here.
- Optional model integration: run the documented integration test with its local
  environment configured; do not record provider or model configuration here.

## Child learning flow

### M1 — One-port startup and sign-in

- [ ] Start with `ODYSSEY_ENABLE_DEVELOPMENT_FIXTURE_ACCOUNTS=1 pnpm dev` and
      open `http://localhost:3000`. Confirm the child portal loads from the same
      process that serves the application.
- [ ] Submit an invalid username/password. Confirm the error is generic and no
      account details appear in the URL, page source, or browser console.
- [ ] Sign in with the locally configured development fixture. Confirm the
      practice view opens and the browser remains on the same origin and port.

### M2 — Topic and standards context

- [ ] Select `Ratios & rates`. Confirm `Grade 6` and `6.RP.A.1` are visible.
- [ ] Select `Linear relationships`. Confirm `Grade 7` and `7.RP.A.2` replace
      the topic metadata without a page reload.

### M3 — Answer and progression

- [ ] Submit `2`. Confirm success feedback, the answer control clears, and the
      correct counter increases.
- [ ] Submit `2` a second time. Confirm the level indicator increases by one
      only after the second correct answer.
- [ ] Submit a non-answer such as `3`. Confirm understandable failure feedback
      and no level jump.
- [ ] Refresh the page and confirm the UI remains usable; record whether the
      local implementation preserves or resets this demo state.

### M4 — Diagram and accessibility

- [ ] Confirm the ratio diagram has accessible title/description text and
      visible `water` and `flour` labels.
- [ ] Use keyboard-only navigation from the address bar: username, password,
      sign-in, topic selector, answer, and submit. Confirm every focus ring is
      visible and no control is skipped.

### M5 — Memory and recoverability

- [ ] With the verified Engram artifact available, complete a learning attempt.
      Confirm progress renders and the profile-memory indicator reports ready.
- [ ] Make the configured artifact unavailable or invalid, restart the app, and
      confirm a clear recoverable memory state appears. Submit an answer and confirm
      answer feedback and local progress still work.

### M6 — Session and privacy smoke checks

- [ ] Sign out using the current development flow, then use Back and Refresh.
      Confirm protected learning views require sign-in again.
- [ ] If a test helper exposes another child identifier, attempt to read or
      submit against it. Confirm no other child progress is shown or changed.
- [ ] Inspect the browser console and displayed errors after invalid sign-in,
      invalid answer, and unavailable-memory states. Confirm no password, session
      token, raw answer, provider credential, or raw prompt appears.

<!-- Historical checklist retained below as a compact acceptance trace. -->

- [ ] Start the application with its documented command and open the displayed
      local URL. Confirm the child sign-in view and server behavior share one port.
- [ ] Sign in with the local development seed. Confirm the topic-selection view
      opens without exposing account details in the URL or browser console.
- [ ] Select a reviewed math topic. Confirm the shown topic, grade or course,
      and standards reference agree with the catalog metadata.
- [ ] Submit a correct answer twice. Confirm the feedback changes and the next
      question is new, remains in the selected topic, and increases only according
      to the visible/recorded bounded progression rule.
- [ ] Submit an incorrect answer. Confirm feedback is understandable and the
      next question does not jump outside the allowed difficulty range.
- [ ] Use keyboard-only navigation to enter and submit an answer. Confirm focus
      remains visible and the answer control is reachable.
- [ ] Open a fixture question that includes a diagram. Confirm its labels render
      correctly and no raw SVG markup or unexpected browser behavior appears.

## Memory and recoverability

- [ ] Complete a learning attempt with Engram ready. Confirm progress still
      renders and the profile-memory indicator reports a non-sensitive ready state.
- [ ] Start the app with the verified Engram artifact unavailable or invalid.
      Confirm a clear recoverable profile-memory state appears, then complete an
      answer submission. Confirm local progress and the next question still work.

## Security and privacy smoke checks

- [ ] Sign out, then use the browser Back button and refresh. Confirm protected
      learning views require sign-in again.
- [ ] Submit an answer from a second child session or altered child identifier
      if the test helper exposes one. Confirm another child's progress is not shown
      or changed.
- [ ] Inspect the browser console and displayed errors after an invalid answer
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
- Overall: pending user browser execution (M1–M6)
- Failed case and observed result: not run in this environment
- Follow-up issue: wire and verify a local Engram artifact before marking M5 ready.
