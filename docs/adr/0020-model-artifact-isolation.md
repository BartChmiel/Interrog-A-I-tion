# ADR 0020: Model Artifact Isolation

## Status

Accepted.

## Context

The project is preparing for controlled local model experiments. Before real model
output is trusted, all model-related artifacts need a predictable local boundary:
prompts, grounding context snapshots, generated outputs, cache files, and evaluation
artifacts should not be scattered across developer directories or external runtime
caches.

## Decision

Add workspace-local model artifact isolation.

Backend:

- `security/model_artifacts.py` defines the model artifact policy.
- Each workspace uses its existing `models/` directory as the artifact root.
- The isolation initializer creates:
  - `models/prompts`,
  - `models/contexts`,
  - `models/outputs`,
  - `models/cache`,
  - `models/evaluations`.
- `models/artifact-policy.json` records the directory policy, workspace id, creator,
  timestamp, and whether external cache, network artifacts, or sensitive material are
  allowed.
- The default policy blocks external cache and network artifacts.
- `GET /workspaces/{workspace_id}/model-artifacts` reports current isolation state.
- `POST /workspaces/{workspace_id}/model-artifacts/isolation` initializes the policy
  and directories.

Frontend:

- The security rail shows model artifact isolation status.
- The operator/admin can initialize artifact isolation from the UI.

## Consequences

- Local model experiments have a concrete workspace boundary before real model output
  enters the system.
- The prototype can distinguish model runtime readiness from model artifact storage
  readiness.
- Existing workspaces may show a warning until isolation is initialized.
- Future work can write prompt/context/output snapshots to these directories without
  changing workspace layout.
- This does not yet implement encrypted model artifact storage; sensitive data remains
  blocked until encrypted workspace support is available.
