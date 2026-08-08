# Child math learning

## Outcome

Provide a focused, child-facing math practice experience for grades 6–12 that
adapts questions to a selected topic, explains ideas through labeled diagrams,
and gives a parent a future entry point to discuss the child's learning.

## MVP

- A child signs in and selects a math topic.
- The experience presents one question at a time and records the response.
- A constrained Pi Mono agent selects an appropriate next question and may
  request a labeled SVG diagram for concepts such as geometry or time and
  distance.
- The UI renders only a small, validated A2UI component catalog and provides
  only registered learning tools to the agent.
- Local laptop development is the initial operating environment.
- SQLite is the initial local persistence store.
- A versioned JSON catalog maps all supported topics to Ohio Learning Standards
  for Mathematics metadata.
- The application runs from `app/`; reusable contracts and deterministic
  learning logic live in focused `packages/` only when shared by two consumers.

## Deferred

- Parent portal and parent-to-child conversation workflow.
- English and other subject areas.
- The engram-integration memory adapter.
- Production deployment and multi-household operations.

## Guardrails

- The agent does not receive arbitrary tools, execute generated code, or decide
  access control.
- Generated questions, answers, and SVG diagrams are validated before display.
- The application service, rather than the agent, persists progress and applies
  progression policy.
- The agent reads approved curriculum metadata but cannot create or alter the
  standards catalog at runtime.

## Visual direction

Use the control center only as a reference for its restrained token-based light
and dark themes, compact navigation, clear cards, and sparse hierarchy. The
child portal remains a distinct learning interface: one primary task per screen,
generous room for the problem and diagram, and no copied control-center code or
branding.

## Decisions still needed

- Child-account provisioning and parent-account timing.
- Authentication implementation and child-account provisioning.
- Initial math topic and the bounded progression policy the agent may influence.
- Model provider and credential-management approach for Pi Mono.
