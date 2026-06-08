# ADR 0022: Grounded Suggestion Artifact Capture

## Status

Accepted.

## Context

The grounded suggestions workflow already builds a deterministic grounding context pack,
generates suggestions through the model-client abstraction, validates citations, and records
an append-only audit event with model id, prompt version, context hash, and output hash.

ADR 0020 introduced workspace-local model artifact isolation. ADR 0021 introduced write
manifests for prompts, contexts, outputs, cache, and evaluations. The next step is to connect
those manifests to the live-visible grounded suggestion workflow without enabling real model
output in institutional live mode.

The product boundary remains unchanged: AI suggestions are advisory working material. They
are not official procedural records, truthfulness judgments, guilt assessments, psychological
diagnoses, or automated interview decisions.

## Decision

When `POST /workspaces/{workspace_id}/grounded-suggestions` runs, the backend attempts to
capture two workspace-local model artifacts if model artifact isolation is already ready:

- `context`: the grounding context pack used for the model call,
- `output`: the raw JSON model response text that produced the parsed suggestions.

The endpoint does not silently initialize model artifact isolation. If isolation is missing or
not ready, suggestion generation still succeeds in prototype mode, but no artifacts are written
and both the API response and `grounded_suggestions_generated` audit event include an
`artifact_warning`.

When capture succeeds, the audit event includes:

- `context_artifact_id`,
- `context_artifact_sha256`,
- `output_artifact_id`,
- `output_artifact_sha256`.

The API response also returns compact `context_artifact` and `output_artifact` metadata so the
frontend can show id/hash provenance without a modal or artifact browser.

## Consequences

Grounded suggestions now have a stronger provenance chain:

1. deterministic context pack,
2. model response text,
3. parsed suggestions with citation checks,
4. model artifact manifest records,
5. append-only audit event linking context/output hashes and artifact ids.

Deterministic tests remain independent of Ollama. Real model output remains blocked by runtime
configuration and product review gates.

The current prototype does not yet hash-chain the artifact manifest, include model artifacts in
export integrity manifests, or require model artifact isolation before every suggestion request.
Those are future security/product decisions.

## Follow-up

- Decide whether artifact capture should become mandatory before any real model experiment.
- Decide whether prompt artifacts should also be written for each grounded suggestion call.
- Decide whether artifact manifests should be included in export integrity manifests.
- Decide how artifact records should be displayed in a future audit/provenance view.
