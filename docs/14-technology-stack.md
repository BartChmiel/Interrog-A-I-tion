# Technology Stack

## Stack Decision

The project is split into components instead of forcing one language or framework across the whole system.

Recommended stack:

- core and backend: Python 3.11+,
- local API: FastAPI,
- domain models: dataclasses in core, Pydantic where API validation needs it,
- UI: React + TypeScript + Vite,
- desktop packaging: Tauri after the local web app stabilizes,
- local model runtime: adapter-based, with Ollama as an optional developer runtime,
- retrieval: start with transparent topic/material linking, add vector search later if needed,
- storage: SQLite for synthetic prototype data, SQLCipher or equivalent before non-synthetic material,
- tests: `unittest` currently, optional `pytest` later,
- CI: GitHub Actions when the repository policy is ready.

## Rationale

Python is appropriate for domain logic, AI workflows, analysis, evaluation, and exports.

React + TypeScript is more appropriate for a professional, long-lived operational interface than a Python desktop UI. It also keeps a future Tauri desktop package realistic.

## Component Choices

### Backend

FastAPI provides typed local API routes, OpenAPI compatibility, and a clean bridge between prototype and application code.

### Frontend

React + TypeScript + Vite supports a component-based, testable, local UI with a straightforward path to desktop packaging.

### Desktop

Tauri is deferred until the core workflow, local API, security boundaries, and UI structure are stable.

### AI Runtime

Application code must depend on the internal model-client abstraction, not on a specific runtime. This keeps deterministic tests, Ollama experiments, and future local/on-prem runtimes separated.

### Retrieval

The first implementation uses transparent material-topic-question linking. Vector retrieval should be introduced only when it can remain auditable.

### Storage and Encryption

SQLite is acceptable for synthetic prototype data. Non-synthetic material requires encrypted storage and explicit policy gates.

## Avoid Early

- Cloud LLMs as a default path.
- LangChain as the central application layer.
- Untraceable scoring.
- Premature microservices.
- Premature desktop packaging.
- Server databases before a real deployment need exists.

## Initial Implementation Path

1. Python domain and analysis.
2. Synthetic cases.
3. Guardrails and prompts.
4. FastAPI local API.
5. React/Vite UI.
6. Model-client abstraction.
7. SQLite prototype storage.
8. Markdown/JSON exports.
9. Security and provenance hardening.
10. Desktop packaging later.

## References

- FastAPI: https://fastapi.tiangolo.com/features/
- React: https://react.dev/learn
- Vite: https://vite.dev/guide/
- Tauri: https://tauri.app/
- Ollama API: https://docs.ollama.com/api/introduction
- SQLite: https://www.sqlite.org/about.html
- SQLCipher: https://www.zetetic.net/sqlcipher/
- Qdrant: https://qdrant.tech/documentation/
- Chroma: https://docs.trychroma.com/
- uv: https://docs.astral.sh/uv/
- pytest: https://docs.pytest.org/en/stable/
