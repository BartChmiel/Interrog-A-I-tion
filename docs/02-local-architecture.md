# Local Architecture

## Architectural Goal

The system should run locally, preserve case boundaries, and make every AI-assisted step auditable.

## Components

- `backend/`: domain logic, local API, analysis, AI adapter boundary, storage, export.
- `frontend/`: React/Vite UI and older static prototype.
- `data/synthetic/`: repository-safe synthetic cases.
- `prompts/`: versioned system prompts.
- `schemas/`: JSON Schema contracts.
- `locales/`: user-facing language packs.
- `tests/`: backend and integration tests.

## Data Flow

1. A case is loaded from synthetic fixtures or a controlled workspace.
2. Interview questions, topics, answers, and claims are normalized into domain models.
3. Analysis modules compute coverage, findings, indicators, and grounding context.
4. The model-client boundary receives a bounded prompt/context package.
5. Model output is parsed, citation-checked, and returned as advisory suggestions.
6. Human decisions are written to the audit chain.
7. Prompt, context, and output artifacts are written to workspace-local model artifact manifests.
8. Reports can be exported with integrity manifests.

## Local API

The API is FastAPI-based in normal development and includes a fallback router for tests.

The API must not rely on a cloud service for core workflow execution.

## Workspace Boundary

Each case workspace contains:

- `imports/`,
- `sessions/`,
- `exports/`,
- `audit/`,
- `models/`.

Model artifacts stay under `models/`. Registered materials stay under `imports/`.

## Integrity Layers

- SQLite audit events are append-only and hash-chained.
- Model artifact manifests are hash-chained.
- Export integrity manifests hash report files and can reference model artifact provenance.

## Deployment Direction

The initial application is a local web application: FastAPI backend plus React frontend.

Desktop packaging is deferred until the local workflow, security model, and data storage boundaries are stable.
