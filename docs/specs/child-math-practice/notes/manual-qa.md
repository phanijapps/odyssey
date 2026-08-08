# Child math practice manual QA

Use the local development seed credentials documented by the application. Do
not record a real child name, password, answer, or local filesystem path here.

## Test environment

- Date:
- App revision:
- Node version:
- Engram state: ready / unavailable

## Child learning flow

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

- Overall: pass / fail
- Failed case and observed result:
- Follow-up issue:
