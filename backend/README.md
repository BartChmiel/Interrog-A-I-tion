# Backend

Local backend for InterrogA(I)tion.

The backend is responsible for:

- case and interview domain logic,
- local API endpoints,
- deterministic analysis pipelines,
- local model runtime boundaries,
- topic coverage, consistency, and evidence-alignment analysis,
- storage, workspace isolation, audit, and export integrity,
- report generation.

The backend must remain local-first and testable without real case data or a real model runtime.

## CLI Review Pipeline

From `backend/`:

```powershell
python -m interrogaition.cli review ..\data\synthetic\case-001\case.json
```

Polish report:

```powershell
python -m interrogaition.cli review ..\data\synthetic\case-001\case.json --locale pl
```

Report export with an integrity manifest:

```powershell
python -m interrogaition.cli review ..\data\synthetic\case-001\case.json --output ..\test-output\report.md --manifest ..\test-output\manifest.json --created-by investigator-001
python -m interrogaition.cli verify-export ..\test-output\manifest.json --root ..\test-output
```

Report export with model artifact provenance, when a workspace is available:

```powershell
python -m interrogaition.cli review ..\data\synthetic\case-001\case.json --output ..\test-output\report.md --manifest ..\test-output\manifest.json --created-by investigator-001 --workspace-root ..\local-data\workspaces\case-workspace --include-model-artifacts
python -m interrogaition.cli verify-export ..\test-output\manifest.json --root ..\test-output --workspace-root ..\local-data\workspaces\case-workspace
```

Pipeline:

1. Load a synthetic case from JSON.
2. Compute topic coverage.
3. Flag potentially leading questions.
4. Detect simple conflicts in structured claims.
5. Generate a Markdown report.
6. Optionally write an export integrity manifest.
7. Optionally include references to the hash-chained model artifact manifest.

## Tests

From `backend/`:

```powershell
python -m unittest discover -s ..\tests
```

## Local API

Install FastAPI dependencies from the repository root:

```powershell
python -m pip install --user fastapi==0.115.12 uvicorn==0.30.6
```

Run from `backend/`:

```powershell
python -m interrogaition.api.app
```

Enable reload explicitly during API development:

```powershell
python -m interrogaition.api.app --reload
```

The API includes a minimal fallback router for tests in restricted environments, but normal development should use FastAPI and Uvicorn.

## Storage and Audit

Live sessions are persisted in a local SQLite database when the API app is run normally. The default prototype database path is ignored by git:

```text
backend/local-data/interrogaition.sqlite3
```

Session start, answer creation, review refresh, material-link decisions, and grounded-suggestion decisions are written to an append-only audit table with a SHA-256 hash chain. This is an integrity prototype, not encrypted storage.

Markdown exports can be accompanied by an integrity manifest. Schema v2 can include workspace model-artifact provenance: artifact manifest hash, record hashes, artifact file hashes, chain validity, and latest artifact record hash.

## Case Workspaces

The security package defines a per-case workspace boundary. A workspace has a `workspace.json` manifest and fixed subdirectories for imports, sessions, exports, audit, and model artifacts.

Plain SQLite prototype workspaces are allowed for synthetic material only. Non-synthetic material is blocked unless the workspace declares encrypted storage as required.

Encrypted workspace creation is blocked until the local SQLite runtime reports SQLCipher support through `PRAGMA cipher_version`.

Readiness endpoints:

```text
GET /security/encryption
GET /environment/health
```

Workspace endpoints:

```text
POST /workspaces
GET /workspaces/{workspace_id}
GET /workspaces/{workspace_id}/access
GET /workspaces/{workspace_id}/model-artifacts
POST /workspaces/{workspace_id}/model-artifacts/isolation
GET /workspaces/{workspace_id}/model-artifacts/manifest
POST /workspaces/{workspace_id}/model-artifacts/items
```

## Local Model Runtime

Local model runtime readiness is exposed separately from live suggestions:

```text
GET /ai/local-model/config
POST /ai/local-model/smoke
```

The default runtime is deterministic. Ollama can be configured through environment variables, but real model execution requires explicit enablement and live suggestions still use the injected `ModelClient`. This prevents real LLM output from entering live workflows by configuration drift alone.

## Materials, Grounding, and Suggestions

Workspace materials are controlled text records stored under `imports/`, with metadata in `imports/materials.json` and SHA-256 verification.

Relevant endpoints:

```text
GET /workspaces/{workspace_id}/materials
POST /workspaces/{workspace_id}/materials
GET /workspaces/{workspace_id}/materials/{material_id}/preview
GET /workspaces/{workspace_id}/materials/links?case_id=case-001
POST /workspaces/{workspace_id}/materials/{material_id}/questions/{question_id}/decision
GET /workspaces/{workspace_id}/materials/{material_id}/verification
GET /workspaces/{workspace_id}/evidence-map?case_id=case-001&session_id=demo-session
GET /workspaces/{workspace_id}/grounding-pack?case_id=case-001&session_id=demo-session&question_id=q-001
POST /workspaces/{workspace_id}/grounded-suggestions?case_id=case-001&session_id=demo-session&question_id=q-001
POST /workspaces/{workspace_id}/grounded-suggestions/{suggestion_id}/decision
POST /workspaces/{workspace_id}/operator-actions/decisions
GET /workspaces/{workspace_id}/operator-actions/decisions?case_id=case-001&session_id=demo-session
GET /workspaces/{workspace_id}/audit
```

Grounded suggestions use the current grounding context pack, validate citations against `allowed_source_ids`, return citation warnings, and audit model id, prompt version, prompt hash, context hash, and output hash.

If model artifact isolation is initialized, grounded suggestions also write workspace-local `prompt`, `context`, and `output` artifacts. Artifact records are deduplicated by `artifact_type + SHA-256`, hash-chained in `models/artifact-manifest.json`, and can be referenced by export integrity manifests.

The system never returns an automated guilt, truthfulness, or legal reliability verdict.

Operator work-queue decisions are also captured through the workspace audit chain. The
first UI integration records `opened`, `skipped`, and `dismissed` decisions from the queue,
preserving the action metadata, linked source ids, target question/tab, and before/after UI
state for later provenance review.
The decision-list endpoint returns the newest matching decision first for compact UI trails;
the full workspace audit endpoint remains the chain-ordered integrity view.
