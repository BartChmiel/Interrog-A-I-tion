# Repository Structure

## Top-Level Directories

- `backend/` - local API, domain logic, analysis, AI, storage, export.
- `frontend/` - React/Vite app and older static prototype.
- `data/synthetic/` - repository-safe synthetic cases.
- `docs/` - project documentation and ADRs.
- `locales/` - language packs.
- `prompts/` - versioned AI prompts.
- `schemas/` - JSON Schema contracts.
- `research/` - research protocols and evaluation notes.
- `tests/` - unit and integration tests.
- `assets/` - visual identity and product assets.
- `config/` - local configuration examples.

## Frontend Structure

- `frontend/app/src` - main React/Vite application.
- `frontend/app/src/ui-shell.tsx` - workspace zones, collapsible sections, modal shell.
- `frontend/app/src/tutorial-tour.tsx` and `tutorial-steps.ts` - in-app supervisor demo tutorial.
- `frontend/app/src/case-workflow.tsx` - case progress navigator and catalog badges.
- `frontend/prototype` - older static prototype kept for reference.

## Backend Structure

- `interrogaition/domain` - domain models.
- `interrogaition/analysis` - review and indicator logic.
- `interrogaition/ai` - model client boundary and prompt services.
- `interrogaition/api` - local API.
- `interrogaition/security` - workspace, audit, integrity, encryption readiness.
- `interrogaition/storage` - persistence and registries.
- `interrogaition/export` - Markdown and integrity exports.

## Documentation Structure

Documents use English filenames and English technical content. User-facing UI copy is localized separately.

Architecture decisions live in `docs/adr/`.

## Data Rule

Only synthetic data may be committed. Local generated outputs, databases, exports, and secrets must remain ignored.
