# ADR 0008: Case Workspace and Access Policy Boundary

## Status

Accepted.

## Context

The prototype can now persist live sessions and hash-chained audit records. Before importing anonymized or real case material, the project needs a per-case security boundary that makes storage assumptions explicit.

The project is still using plain SQLite for the prototype. That storage mode is acceptable for synthetic data and workflow validation, but it must not silently accept anonymized or sensitive material.

## Decision

Add a local per-case workspace model with:

- a `workspace.json` manifest,
- deterministic subdirectories for imports, sessions, exports, audit, and model artifacts,
- safe identifier validation to prevent path traversal,
- explicit data sensitivity labels,
- explicit storage mode labels,
- a prototype role-based access policy.

Expose the first workspace operations through the local API:

- create workspace,
- load workspace manifest,
- evaluate a role/action access decision.

The initial policy blocks non-synthetic case material in plain SQLite prototype storage. Non-synthetic import is allowed only when the workspace declares encrypted storage as required.

The first policy roles are:

- admin,
- prosecutor,
- investigator,
- forensic expert,
- defense counsel,
- observer.

The first policy actions are:

- read case,
- write interview,
- run review,
- import material,
- export report,
- manage workspace.

## Consequences

- The codebase now has a concrete place to attach encryption, import, and export integrity work.
- Synthetic workflow testing can continue without pretending that real-data handling is safe.
- Role-based access is deterministic and testable, but it is still a prototype policy, not legal authorization logic.
- The next security step can be SQLCipher research, export hashing, or UI integration for workspace creation.
