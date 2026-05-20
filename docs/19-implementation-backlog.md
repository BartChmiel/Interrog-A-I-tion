# Implementation Backlog

## Immediate Next Step

Build the live-session domain model and deterministic live review loop.

This should happen before the real LLM adapter, because the live workflow must be testable without a model.

## Milestone 1: Live Session Core

Status: implemented in the deterministic backend prototype.

Tasks:

- add `InterviewSession`,
- add `ParticipantRole`,
- add role history support,
- add live note events,
- add current question state,
- add deterministic review refresh after each answer,
- add tests for role changes and live review.

Success criteria:

- a synthetic live interview can be represented as events,
- role changes are preserved,
- analysis can be re-run after each new answer,
- no AI model is required.

STOP gate:

- confirm whether the live session model fits the intended operational workflow,
- decide whether Milestone 2 should focus on credibility indicators or AI model integration,
- review if role changes should require additional audit metadata.

## Milestone 2: Credibility Indicator Model

Status: implemented as deterministic backend indicators and Markdown report output.

Tasks:

- add `Indicator`,
- add indicator categories,
- add score type: process, consistency, evidence alignment, credibility review,
- add factor-level breakdown,
- add uncertainty/confidence,
- add tests.

Success criteria:

- report can show indicators as structured data,
- indicators do not produce guilt or truthfulness decisions,
- every indicator can link to topics, answers, claims, or source material.

## Milestone 3: Local Model Abstraction

Status: implemented for interface, fake client, prompt rendering, guarded response parsing, and an Ollama adapter behind the interface. A real local model has not been connected to the user workflow yet.

Tasks:

- add `ModelClient` interface,
- add `FakeModelClient`,
- add prompt renderer,
- add response schema validation,
- add Ollama adapter behind the interface,
- add guardrail checks before returning suggestions.

Success criteria:

- tests run without Ollama,
- Ollama can be enabled locally,
- model output is validated and auditable.

## Milestone 4: FastAPI Prototype

Status: implemented as a local API app shape with endpoint tests, including deterministic live-session review. A normal local environment should use real FastAPI and Uvicorn.

Tasks:

- endpoint: load synthetic case,
- endpoint: start session,
- endpoint: add answer,
- endpoint: review session,
- endpoint: render report,
- endpoint: list locales.

Success criteria:

- frontend can call the pipeline,
- API schemas are visible,
- language selection is API-visible.

## Milestone 5: First UI

Status: first static prototype implemented in `frontend/prototype`, with React + TypeScript + Vite foundation added in `frontend/app`. The React app preserves the live-session review loop, local API reconnect path, PL/EN UI switching, and decision-support indicator layout.

Tasks:

- language setting,
- case loader,
- live interview layout,
- question list,
- answer notes,
- right-side indicator panel,
- report preview.

Success criteria:

- user can run a synthetic live interview in browser,
- analysis updates visibly,
- PL/EN UI labels work.

## Milestone 6: Security Path

Status: started. SQLite session persistence and a hash-chained append-only audit log are implemented for the local prototype. Encryption, per-case workspaces, and export integrity are not implemented yet.

Tasks:

- per-case workspace design,
- append-only audit log,
- export hash,
- SQLite storage,
- SQLCipher research spike,
- air-gapped mode policy.

Success criteria:

- no sensitive data is required for testing,
- export integrity is demonstrable,
- architecture leaves a clear path toward institutional deployment.
