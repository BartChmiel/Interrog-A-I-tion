# ADR 0015: Live-Visible Grounded Suggestions

## Status

Accepted.

## Context

The project now has a deterministic grounding context pack. The next implementation step is to expose AI-style suggestions in the live interview UI while preserving human oversight and source traceability.

The project owner decided:

- use both fake-model testing and an Ollama-ready model abstraction,
- show grounded suggestions in the live interview workflow,
- support follow-up questions, gaps, potential inconsistencies, and summaries,
- show citation problems as warnings for now,
- display suggestion text, reason, source ids, and topic status context,
- provide `use`, `edit`, and `reject` actions,
- keep suggestions in the UI language with Polish fallback,
- allow firm clarification wording for inconsistencies, but avoid automatic confrontation,
- audit model id, prompt version, context hash, and output hash.

## Decision

Add live-visible grounded suggestions backed by the grounding context pack.

The first implementation:

- uses a deterministic grounded fake model by default,
- keeps the model behind the `ModelClient` abstraction,
- validates `linked_evidence` against `allowed_source_ids`,
- returns warnings for invalid citations instead of rejecting the whole response,
- appends an audit event for generated grounded suggestions,
- records human `accepted`, `edited`, and `rejected` decisions as append-only audit events,
- exposes the workflow through:

```text
POST /workspaces/{workspace_id}/grounded-suggestions?case_id=case-001&session_id=review-session&question_id=q-001
POST /workspaces/{workspace_id}/grounded-suggestions/{suggestion_id}/decision
GET /workspaces/{workspace_id}/audit
```

The React UI displays grounded suggestions under the case map in the right insight rail.

## Consequences

- The live UI can now show AI-style suggestions without depending on a real model runtime.
- Future Ollama integration can reuse the same service and validation path.
- Citation warnings are visible but not blocking in this prototype stage.
- Human decisions are traceable, but they are still prototype audit records rather than official procedural records.
- A stricter production mode should reject suggestions with missing or invalid citations.
- A STOP review remains required before trusting real model output in institutional use.
