# ADR 0011: Workspace Material Register

## Status

Accepted.

## Context

The prototype now has per-case workspaces, access decisions, SQLCipher readiness checks, and export integrity manifests. The next security boundary is controlled source material import: future AI suggestions and evidence-alignment indicators must point to registered material, not loose local files.

The first implementation must remain safe for synthetic data and must not imply that sensitive or anonymized materials are acceptable in plain prototype storage.

## Decision

Add a workspace-bound material register.

The first version supports text material records through the local API. Each record includes:

- material id,
- workspace id,
- case id,
- title and description,
- source type,
- data sensitivity,
- MIME type and original name,
- workspace-relative path,
- file size,
- SHA-256 hash,
- tags,
- creator id,
- creation timestamp.

The material file is written under `imports/materials/` and metadata is stored in `imports/materials.json`. Verification recalculates SHA-256 and size to detect missing or changed material.

The API exposes:

```text
GET /workspaces/{workspace_id}/materials
POST /workspaces/{workspace_id}/materials
GET /workspaces/{workspace_id}/materials/{material_id}/verification
```

Non-synthetic material remains blocked in `plain_sqlite_prototype` storage.

## Consequences

- Future AI prompts can cite stable material ids.
- Evidence-alignment indicators can link findings to registered source material.
- File tampering is detectable at the workspace material level.
- This is not full chain-of-custody, file upload UX, OCR, transcription, or signed evidence handling.
- Real or anonymized case data remains behind the encryption and legal/ethics STOP gates.
