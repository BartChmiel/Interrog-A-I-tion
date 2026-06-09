# ADR 0001: MVP Technology Stack

## Status

Accepted for MVP.

## Context

The project combines AI assistance, investigative interviewing methodology, forensic computing, local security, and a future institutional review path. The MVP needs technology that supports fast research iteration without blocking a secure local deployment direction.

## Decision

Use:

- Python for domain logic, analysis, AI workflows, and exports,
- FastAPI for the local API,
- React + TypeScript + Vite for the UI,
- a model-client abstraction with Ollama as an optional local developer runtime,
- SQLite for synthetic prototype storage,
- SQLCipher or equivalent encrypted storage as the future non-synthetic data path,
- Tauri as a later desktop wrapper.

## Positive Consequences

- Fast prototyping.
- Strong testability.
- Clear data contracts.
- Separation of backend, UI, AI, storage, and security components.
- Good path toward academic evaluation.
- Future migration path for critical components.

## Negative Consequences

- More than one technology stack.
- Desktop packaging requires later integration work.
- Security controls mature in stages.
- Tauri requires Rust/toolchain readiness later.

## Rejected Initial Alternatives

- All-Python UI: faster initially, weaker for long-term professional UI and packaging.
- Electron from day one: higher runtime overhead.
- Rust from day one: slower research iteration.
- LangChain as the core application layer: too opaque for an auditable prototype.
- Cloud LLMs by default: inconsistent with the local-first security boundary.
