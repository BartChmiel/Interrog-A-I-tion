# ADR 0024: Hash-Chained Model Artifact Manifests

## Status

Accepted.

## Context

Model artifact manifests now track prompts, context packs, outputs, cache items, and
evaluation artifacts inside each case workspace. ADR 0023 added prompt artifacts and
deduplication by artifact type plus SHA-256. The remaining integrity gap was that
`models/artifact-manifest.json` could be edited without an internal chain signal.

The audit log already uses a hash chain. Model artifact manifests need a similar
prototype-level mechanism before artifact records are included in exports or used with
anonymized or sensitive material.

## Decision

Each new model artifact manifest record now includes:

- `previous_hash`: the previous manifest record hash, or `null` for the first record,
- `record_hash`: a canonical SHA-256 over the record payload and `previous_hash`.

`GET /workspaces/{workspace_id}/model-artifacts/manifest` returns:

- `chain_valid`,
- `latest_record_hash`.

Artifact writes are blocked when an existing manifest chain is invalid. This includes
old prototype manifests that do not contain `record_hash` values. The system does not
silently migrate or repair those files, because changing provenance records without an
explicit operator action would weaken the audit story.

Deduplicated writes still reuse the existing record and do not append to the manifest.
The reused record remains part of the same verified chain.

## Consequences

The project now has two independent local integrity chains:

- the SQLite append-only audit chain,
- the workspace-local model artifact manifest chain.

This improves forensic defensibility of model provenance without enabling real model
output for institutional live use.

The prototype still does not include model artifact records in export integrity manifests.
That is now the next natural security step.

## Follow-up

- Decide whether model artifact records should be included in export integrity manifests.
- Decide whether old prototype manifests should get an explicit migration command.
- Decide whether invalid artifact chains should block grounded suggestion generation entirely, not only artifact writes.
- Decide whether the frontend needs a dedicated provenance view for artifact chains.
