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
python -m interrogaition.cli verify-export ..\test-output\interrogaition-case-001-export.zip --bundle --expected-sha256 <zip-sha256>
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

Session start, answer creation, review refresh, material-link decisions, grounded-suggestion decisions, real-model smoke attempts, and export bundle creation are written to an append-only audit table with a SHA-256 hash chain. This is an integrity prototype, not encrypted storage.

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
GET /workspaces/{workspace_id}/security
GET /workspaces/{workspace_id}/demo-readiness?case_id=case-001&session_id=review-session
GET /workspaces/{workspace_id}/case-quality?case_id=case-001&session_id=review-session&locale=en
GET /workspaces/{workspace_id}/stop-reviews
POST /workspaces/{workspace_id}/stop-reviews
GET /workspaces/{workspace_id}/model-artifacts
POST /workspaces/{workspace_id}/model-artifacts/isolation
GET /workspaces/{workspace_id}/model-artifacts/manifest
POST /workspaces/{workspace_id}/model-artifacts/items
```

The readiness endpoint aggregates workspace security, session capture, audit-chain
validity, model artifact traceability, export bundle evidence, and the separate real-model
STOP gate into one workflow report with recommended follow-up actions.

The case-quality endpoint is broader than workflow readiness. It aggregates session capture,
operator claim review, claim provenance, evidence-map coverage, material grounding review,
grounded-AI artifact/decision trace, operator work-queue decisions, workspace security,
audit-chain validity, and export bundle evidence into one case-level quality gate with
a quality score and recommended corrective actions.

## Local Model Runtime

Local model runtime readiness is exposed separately from live suggestions:

```text
GET /ai/local-model/config
GET /ai/local-model/experiment-readiness
POST /ai/local-model/smoke
```

The default runtime is deterministic. Ollama and OpenAI-compatible bridge endpoints can be configured through environment variables, but real model execution requires explicit enablement. Live grounded suggestions use a real provider only when the provider is selected and all real-output gates are set.

Ollama developer shell:

```powershell
$env:INTERROGAITION_MODEL_PROVIDER='ollama'
$env:INTERROGAITION_OLLAMA_MODEL='llama3.1:8b'
$env:INTERROGAITION_ENABLE_REAL_MODEL='1'
$env:INTERROGAITION_ENABLE_LIVE_MODEL_OUTPUT='1'
```

Bridge developer shell:

```powershell
$env:INTERROGAITION_MODEL_PROVIDER='bridge'
$env:INTERROGAITION_BRIDGE_BASE_URL='http://127.0.0.1:8080/v1'
$env:INTERROGAITION_BRIDGE_MODEL='bridge-model'
$env:INTERROGAITION_ENABLE_REAL_MODEL='1'
$env:INTERROGAITION_ENABLE_LIVE_MODEL_OUTPUT='1'
# Optional:
# $env:INTERROGAITION_BRIDGE_API_KEY='replace-with-local-dev-token'
```

See `config/local-ai-developer.ps1.example` and `config/bridged-ai-developer.ps1.example` for developer shell setups. This prevents real LLM output from entering live workflows by configuration drift alone.

Controlled real-model smoke readiness is also gated by workspace state: the readiness endpoint derives STOP approval from the append-only workspace audit log, plus workspace security and model artifact isolation status. Record approval or rejection through `POST /workspaces/{workspace_id}/stop-reviews`; the newest STOP decision wins.

`POST /ai/local-model/smoke?execute_real=true` enforces the same readiness gate server-side and requires `workspace_id`. If the workspace security report, model artifact isolation, runtime configuration, or audited STOP decision is not ready, the endpoint returns a blocked smoke result without invoking the real model. Real-smoke attempts with a workspace are written to the workspace audit chain as blocked, completed, or failed events, including readiness issue codes, runtime metadata, and hashes of the smoke prompt contract and response preview.

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
GET /workspaces/{workspace_id}/evidence-map?case_id=case-001&session_id=review-session
GET /workspaces/{workspace_id}/grounding-pack?case_id=case-001&session_id=review-session&question_id=q-001
POST /workspaces/{workspace_id}/grounded-suggestions?case_id=case-001&session_id=review-session&question_id=q-001
POST /workspaces/{workspace_id}/grounded-suggestions/{suggestion_id}/decision
POST /workspaces/{workspace_id}/operator-actions/decisions
GET /workspaces/{workspace_id}/operator-actions/decisions?case_id=case-001&session_id=review-session
GET /workspaces/{workspace_id}/audit
POST /workspaces/{workspace_id}/exports/integrity-preview
POST /workspaces/{workspace_id}/exports/bundle
```

Grounded suggestions use the current grounding context pack, validate citations against `allowed_source_ids`, return citation warnings, and audit model id, prompt version, prompt hash, context hash, and output hash. Each generation also returns an AI quality report that scores citation scope, grounded topic links, operator-review flags, confidence hygiene, and forbidden interpretive claims. The generation audit record stores the quality state, score, issue count, and error count.

If model artifact isolation is initialized, grounded suggestions also write workspace-local `prompt`, `context`, and `output` artifacts. Artifact records are deduplicated by `artifact_type + SHA-256`, hash-chained in `models/artifact-manifest.json`, and can be referenced by export integrity manifests.

The system never returns an automated guilt, truthfulness, or legal reliability verdict.

Operator work-queue decisions are also captured through the workspace audit chain. The
first UI integration records `opened`, `skipped`, and `dismissed` decisions from the queue,
preserving the action metadata, linked source ids, target question/tab, and before/after UI
state for later provenance review.
The decision-list endpoint returns the newest matching decision first for compact UI trails;
the full workspace audit endpoint remains the chain-ordered integrity view.

ZIP export bundle creation is also recorded in the workspace audit chain with the export id,
manifest hash, ZIP SHA-256, bundle size, JSON/model-artifact inclusion flags, and verification
state returned by the integrity checker.
Downloaded ZIP bundles can be verified offline with `verify-export --bundle --expected-sha256 <zip-sha256>`,
which checks the ZIP file hash, reads `manifest.json` from the archive, and verifies the
manifest-declared files against the ZIP contents.
