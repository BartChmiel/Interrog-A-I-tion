# Guided Workflow

This document summarizes the first guided workflow of InterrogA(I)tion for synthetic
case review and local research validation.

## Purpose

InterrogA(I)tion is a local-first research prototype for AI-assisted investigative
interviewing. The current workflow validates the direction of the project with synthetic
data; it is not a production-ready tool.

The system supports an authorized human operator in:

- preparing and navigating synthetic cases,
- recording live interview answers,
- reviewing topic coverage and gaps,
- inspecting source materials,
- receiving grounded follow-up suggestions,
- reviewing advisory indicators,
- preserving audit and provenance traces.

The system does not decide whether a person is lying, guilty, credible, or legally reliable.

## Current Workflow Scope

The first guided workflow includes:

- React/Vite frontend with Polish and English UI copy,
- local FastAPI backend,
- synthetic case catalog with multiple scenarios,
- case dossier with priority gaps and starter materials,
- question plan and live answer recording,
- workspace material register with preview, hashing, and verification,
- deterministic material-question grounding links,
- case evidence map and advisory evidence-alignment indicator,
- grounded AI suggestion panel with human use/edit/reject controls,
- operator work queue with audited open/skip/dismiss decisions,
- Review tab with STOP readiness, an investigative board, indicators, findings, and provenance timeline,
- SQLite session storage and append-only audit-chain events,
- workspace-local model artifact manifests and export integrity manifest support,
- three-zone workspace layout with progressive disclosure (collapsed-by-default panels),
- in-app tutorial mode with spotlight walkthrough (15 steps, PL/EN),
- session report export (Markdown download/copy from Review, research disclaimer).

## Workspace Layout

The interview workspace is split into three zones:

- **Case prep** (left) - workflow path, dossier, and case context.
- **Live interview** (center) - active question, answer composer, and answer history.
- **Operations** (right) - materials, grounded AI, operator queue, and review.

Side rails can collapse to keep focus on the live interview. Secondary panels stay
collapsed until opened, so the default view stays readable during review.

## How To Run The Workflow

From the repository root, start the backend:

```powershell
cd backend
python -m interrogaition.api.app
```

In a second terminal, start the frontend:

```powershell
cd frontend/app
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5173/?api=http://127.0.0.1:8000&case=case-003&session=review-session&participant=person-001&workspace=review-workspace
```

For a self-guided workflow, add `&tutorial=1` to auto-start the
in-app tutorial, or press `?` / use **Guide** (EN) or **Przewodnik** (PL) in the
top bar anytime.

The workflow uses synthetic material only.

## Pre-Send Quality Gate

Before sharing the repository link, verify:

- GitHub Actions CI is visible and passing on `main`.
- The local backend test suite passes:

```powershell
$env:PYTHONPATH='backend'
python -m unittest discover -s tests
```

- The frontend typecheck and production build pass:

```powershell
cd frontend/app
npm run build
```

- The workflow opens on `case-003` with a fresh session/workspace.
- The first screen clearly shows that this is a synthetic research prototype.
- The Review tab shows STOP readiness, provenance, and the non-official report boundary.
- No real case material, personal data, secrets, local databases, or generated exports are committed.

## Five-Minute Review Flow

For a short guided review:

1. Show the README and this workflow document to establish scope and boundaries.
2. Open `case-003` with `&tutorial=1`.
3. Show the case dossier and priority gaps.
4. Record one short synthetic answer in the live interview area.
5. Seed/open Materials and show hashes, previews, and material-question links.
6. Open Grounded AI and show source-backed suggestions plus human use/edit/reject controls.
7. Open Review and show STOP readiness, investigative board, provenance timeline, and report export.

The walkthrough should emphasize that the prototype is local-first and auditable, and that
all AI-assisted outputs remain advisory.

## Suggested Review Questions

Useful questions for the first academic review:

- Is the scope appropriate for a forensic computing project with a later master's thesis path?
- Which part should become the strongest research contribution: local security, grounded AI,
  audit/provenance, interviewing methodology, or evaluation?
- Are the ethical boundaries and non-goals clear enough?
- Should the next semester focus more on encrypted storage, evaluation scenarios, UI workflow,
  or controlled local-model experiments?
- Which artifacts would be most useful for assessment: live workflow, exported report, architecture
  diagram, evaluation protocol, or threat model?

## Workflow Pack Controls

The left sidebar **Workflow path** panel includes workflow helpers:

- **New session** - reloads the page with a new session and workspace for the
  current case, so each walkthrough starts from a clean local state.
- **Copy brief** - copies a compact text snapshot (case, coverage, materials,
  audit counts, advisory boundary) for notes or email follow-up.
- **Workflow checklist** - tracks which workflow steps have been touched in the
  current session.

## Suggested Walkthrough

For the first review, the recommended path is:

1. Open `case-003` with `&tutorial=1` for a guided walkthrough, or start the tutorial from the
   top bar after load. The scenario covers medication discrepancy with timing, documentation,
   access, and monitoring questions.
2. Use **New session** if you need a clean workspace, then use the left-side workflow
   path to move through the main flow.
3. Review the case dossier: planned scope, priority gaps, answer count, and starter materials.
4. Open the local AI/runtime area from the workflow path. The default runtime is deterministic and
   safe for local review; it shows the local model gate without relying on a real model.
5. Open Materials and inspect starter materials, hashes, verification, and material-question links.
6. Open Grounded AI and inspect suggested follow-up questions with reasons, source ids, and
   human use/edit/reject controls.
7. Open Review and inspect STOP readiness, the investigative board, advisory indicators,
   findings, and the provenance timeline.

The investigative board is the most compact way to show the current analytical value of the
prototype. It groups structured narrative time signals, clarification targets, and material
leads without making any truthfulness or guilt decision.

## Local AI Notes

The default workflow should use the deterministic local runtime by default. This is intentional: it
demonstrates the local-first AI workflow, grounding, audit, prompt/context/output artifact
capture, and STOP gates without making the workflow dependent on a specific installed model.

Ollama support exists as a gated runtime path for future local-model experiments. A real model
should only be enabled deliberately with environment variables and should not be presented as
trusted live institutional output at this stage.

Example future experiment variables:

```powershell
$env:INTERROGAITION_MODEL_PROVIDER='ollama'
$env:INTERROGAITION_ENABLE_REAL_MODEL='1'
$env:INTERROGAITION_OLLAMA_MODEL='llama3.1:8b'
```

This remains a research/developer path, not the default guided workflow.

Developer setup example:

```powershell
. .\config\local-ai-developer.ps1.example
cd backend
python -m interrogaition.api.app
```

With live output enabled, Grounded AI suggestions are generated by the local Ollama model instead of the deterministic assistant. Human use/edit/reject controls and audit metadata remain unchanged.

## Important Boundaries

- No automated guilt or truthfulness decision.
- No production chain-of-custody claim.
- No sensitive or real case data in the repository.
- No trusted real-model live output yet.
- No production encryption yet; SQLCipher readiness is tracked as a gate.
- STOP reviews remain required before real/anonymized data, official-looking exports, or
  institutional live use.

## Planned First Full Version Direction

The next two semesters should turn this demonstrator into a thesis-ready first version:

- stronger secure local workspace model,
- richer interview workflows and scenarios,
- expanded psychology-informed questioning methodology,
- local AI plus future anonymized/bridged AI strategy,
- evaluation protocol for synthetic and formally approved data,
- export/reporting with defensible provenance,
- thesis documentation, methodology, experiments, and limitations.
