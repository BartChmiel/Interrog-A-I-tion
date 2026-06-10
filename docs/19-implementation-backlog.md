# Implementation Backlog

## Immediate Next Step

Prepare the thesis evaluation path and the next security gate: encrypted workspace creation and a
controlled real-model experiment behind STOP review.

The live-session core, supervisor-demo UX, and deterministic AI path are already in place. Do not
rush Ollama into the default demo workflow.

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

Status: implemented for interface, fake client, prompt rendering, guarded response parsing, an Ollama adapter behind the interface, local model runtime configuration, deterministic model smoke checks, and a deterministic grounding context pack for future model calls. A real local model has not been connected to live suggestions yet.

Tasks:

- add `ModelClient` interface,
- add `FakeModelClient`,
- add prompt renderer,
- add response schema validation,
- add Ollama adapter behind the interface,
- add local model runtime config,
- add deterministic smoke endpoint and UI control,
- add guardrail checks before returning suggestions,
- add grounding pack prompt contract.

Success criteria:

- tests run without Ollama,
- Ollama can be enabled locally,
- model readiness is visible without sending case data to a real model,
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

Status: implemented. `frontend/app` is the main UI target. The React app preserves the live-session
review loop, local API reconnect path, PL/EN UI switching, a three-zone workspace layout
(case prep / live interview / operations), progressive disclosure, case dossier, guided demo path,
demo-pack controls, and an in-app tutorial walkthrough. `frontend/prototype` remains archival.

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

Status: started. SQLite session persistence, a hash-chained append-only audit log, audited operator work-queue decisions, a prototype per-case workspace boundary, SQLCipher runtime readiness checks, environment health reporting, workspace-local model artifact isolation with hash-chained deduplicating artifact write manifests, grounded suggestion prompt/context/output artifact capture, export integrity manifests with optional model artifact provenance references, a workspace material register, bounded material previews, deterministic material-question grounding links with matched-term audit details, audited material-question link decisions, a first topic-level case evidence map, an advisory Evidence Alignment Indicator, an AI grounding context pack, live-visible grounded suggestions, and audited grounded-suggestion decisions are implemented. Encryption is not implemented yet, and real model output is not yet trusted for institutional live use.

Tasks:

- per-case workspace design,
- append-only audit log,
- audited operator work-queue decisions,
- export hash,
- workspace material register,
- bounded material preview,
- material-question grounding links,
- matched-term audit view,
- audited accepted/rejected material-question link decisions,
- topic-level case evidence map,
- advisory evidence alignment indicator,
- grounding context pack,
- live-visible grounded suggestions,
- citation validation warnings,
- model/prompt/context/output audit metadata,
- audited accepted/edited/rejected grounded-suggestion decisions,
- SQLite storage,
- SQLCipher research spike,
- environment health check,
- workspace-local model artifact isolation,
- hash-chained model artifact write manifests,
- prompt/context/output artifact capture with hash deduplication,
- model artifact provenance references in export integrity manifests,
- air-gapped mode policy.

Success criteria:

- no sensitive data is required for testing,
- export integrity is demonstrable,
- grounded suggestions remain source-traceable and human-controlled,
- architecture leaves a clear path toward institutional deployment.

## Milestone 7: First Supervisor Demo UX

Status: implemented for the first shareable course-supervisor demo.

Tasks:

- first supervisor demo document,
- guided demo path and case dossier orientation,
- demo-pack controls: fresh demo, copy summary, demo checklist,
- investigative review board in the Review tab,
- three-zone workspace with collapsed-by-default panels,
- in-app tutorial mode with spotlight walkthrough (PL/EN),
- clearer question and answer presentation in the live interview zone.

Success criteria:

- a supervisor can run the demo from synthetic data only,
- the default path uses deterministic local AI, not a required real model,
- the UI stays readable during a live walkthrough,
- no guilt, truthfulness, or lie-detection claims are introduced.

See `docs/24-first-supervisor-demo.md` for run instructions and boundaries.

## Milestone 8: Session Report Export

Status: implemented as a first research/demo Markdown export from the Review tab.

Tasks:

- expose backend `report_markdown` in the UI,
- add session context and provenance summary wrapper,
- add download and copy controls with a non-official disclaimer,
- keep export behind the local API workflow.

Next:

- extend report content with answers, AI decisions, and integrity manifest references,
- add JSON export and optional export manifest linkage after STOP review.

## Milestone 9: Case Workflow Deepening

Status: in progress.

Implemented:

- case progress navigator with stage navigation (dossier → interview → materials → AI → review → report),
- scenario badges and supervisor-demo marker in the case catalog,
- operational session context in the header and interview strip,
- operations offline guidance when the local API is unavailable.

Next:

- richer per-case README summaries and starter materials,
- stronger empty/loading states per operations tab,
- extract large panels from `App.tsx` into maintainable components.
