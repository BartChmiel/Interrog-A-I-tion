# ADR 0021: Model Artifact Write Manifests

## Status

Accepted.

## Context

ADR 0020 established workspace-local model artifact isolation. The next requirement
is traceability: when the system stores a prompt, context pack, model output, cache
item, or evaluation artifact, the write must leave a structured manifest record with
integrity metadata.

## Decision

Add model artifact write manifests.

Backend:

- `write_model_artifact()` writes artifact content only after model artifact isolation
  has been initialized.
- Supported artifact types are `prompt`, `context`, `output`, `cache`, and
  `evaluation`.
- Each artifact is written into the corresponding workspace-local directory under
  `models/`.
- Each write records:
  - artifact id,
  - artifact type,
  - relative path,
  - SHA-256,
  - byte size,
  - content type,
  - source,
  - creator,
  - timestamp,
  - metadata.
- `models/artifact-manifest.json` stores the append-only prototype manifest.
- `GET /workspaces/{workspace_id}/model-artifacts/manifest` returns manifest records.
- `POST /workspaces/{workspace_id}/model-artifacts/items` writes a new artifact and
  appends its manifest record.

Frontend:

- The security rail shows the current manifest record count and the latest artifact
  type/hash when records exist.
- The UI does not yet expose a manual artifact-content editor; writes are intended
  for controlled model workflows.

## Consequences

- Future model calls can be audited from prompt/context/output hashes.
- Artifact writes remain inside the case workspace boundary.
- The manifest is a prototype append-only JSON file; future hardening should add
  hash-chain or export-integrity coverage.
- Sensitive or non-synthetic artifact content is still blocked by the broader
  encrypted-workspace gate.
