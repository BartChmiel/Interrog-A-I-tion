# First Supervisor Demo

This document summarizes the first shareable demo of InterrogA(I)tion for the forensic
computing course/project review.

## Purpose

InterrogA(I)tion is a local-first research prototype for AI-assisted investigative
interviewing. The current demo is intended to show the direction of the project, not a
production-ready tool.

The system supports an authorized human operator in:

- preparing and navigating synthetic cases,
- recording live interview answers,
- reviewing topic coverage and gaps,
- inspecting source materials,
- receiving grounded follow-up suggestions,
- reviewing advisory indicators,
- preserving audit and provenance traces.

The system does not decide whether a person is lying, guilty, credible, or legally reliable.

## Current Demo Scope

The first demo includes:

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
- Review tab with STOP readiness, indicators, findings, and provenance timeline,
- SQLite session storage and append-only audit-chain events,
- workspace-local model artifact manifests and export integrity manifest support.

## How To Run The Demo

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
http://127.0.0.1:5173/?api=http://127.0.0.1:8000&case=case-003&session=demo-session&participant=person-001&workspace=demo-workspace
```

The demo uses synthetic material only.

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
