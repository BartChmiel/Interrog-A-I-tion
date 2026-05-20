# ADR 0007: SQLite Session Storage and Audit Chain

## Status

Accepted.

## Context

The live interview prototype previously kept sessions in process memory. That was enough for UI and API workflow validation, but it did not demonstrate local persistence, restart recovery, or audit integrity.

The project needs a storage path that remains local-first and testable before introducing encryption or real case material.

## Decision

Add a SQLite-backed session store for the local prototype.

The first storage implementation persists:

- live interview sessions,
- participant role history,
- recorded answers,
- answer topics and structured claims,
- session events,
- live notes,
- audit events.

Audit records are append-only and hash-chained. Each audit record stores its `previous_hash` and `event_hash`; updates and deletes are blocked with SQLite triggers.

The normal API app writes to:

```text
backend/local-data/interigaition.sqlite3
```

Tests use isolated SQLite files under ignored test output directories.

## Consequences

- The backend can now survive process restarts for prototype sessions.
- The audit chain can demonstrate integrity assumptions in the thesis prototype.
- The implementation is not encrypted and must not be used for sensitive real case data.
- The storage interface leaves room for SQLCipher or an encrypted per-case workspace later.
