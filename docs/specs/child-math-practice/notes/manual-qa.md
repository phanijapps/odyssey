# Child math practice manual QA

Use the local development seed credentials shown by the application (`child` /
`development-password`). Do not record a real child name, password, answer, or
local filesystem path here.

## Test environment

- Date: 2026-08-08
- App revision: working tree (pre-commit smoke)
- Node version: 24.19.0
- Engram state: unavailable (no local native artifact configured)
- Engram build prerequisite: Cargo and Rust 1.85+ when compiling the native package
- Optional native integration: `ENGRAM_INTEGRATION=1 pnpm test`

## Child learning flow

### M1 — One-port startup and sign-in

- [ ] Start with `pnpm dev` and open `http://localhost:3000`. Confirm the child
      portal loads from the same process that serves the application.
- [ ] Submit an invalid username/password. Confirm the error is generic and no
      account details appear in the URL, page source, or browser console.
- [ ] Sign in with `child` / `development-password`. Confirm the practice view
      opens and the browser remains on the same origin and port.

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
- HTTP smoke: pass — `pnpm dev` served the child portal at `http://localhost:3000` with HTTP 200.
- Overall: pending user browser execution (M1–M6)
- Failed case and observed result: not run in this environment
- Follow-up issue: wire and verify a local Engram artifact before marking M5 ready.
