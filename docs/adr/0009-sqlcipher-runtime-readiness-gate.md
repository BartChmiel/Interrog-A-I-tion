# ADR 0009: SQLCipher Runtime Readiness Gate

## Status

Accepted.

## Context

The project now has per-case workspaces and explicit storage modes. A workspace can declare that encrypted storage is required, but the prototype must not treat that declaration as proof that encryption is actually active.

The current Python runtime uses the standard `sqlite3` module unless an SQLCipher-capable runtime is installed. Standard SQLite does not encrypt the database file.

## Decision

Add a runtime readiness check for SQLCipher.

The application checks `PRAGMA cipher_version` and treats encrypted storage as unavailable unless that pragma returns a version. Workspace creation with `encrypted_required` is blocked when SQLCipher is not detected.

Expose the readiness result through:

```text
GET /security/encryption
```

## Consequences

- The prototype cannot accidentally create an "encrypted" workspace on standard SQLite.
- Synthetic workspaces can still be created with plain SQLite.
- Non-synthetic material remains blocked until encrypted storage is actually available.
- The next implementation step can safely compare SQLCipher installation options without changing the workspace contract.
