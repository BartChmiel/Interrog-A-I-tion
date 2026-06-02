# ADR 0014: Grounding Context Pack Before Local AI Output

## Status

Accepted.

## Context

The system is intended to become an active local AI assistant for investigative interviewing. Because the domain is high-risk, model prompts must not receive an unbounded dump of notes, answers, and materials.

The project now has deterministic material links and a topic-level evidence map. The next safe step is to convert those deterministic signals into a bounded context package before connecting model output to the live workflow.

## Decision

Add a deterministic grounding context pack.

The first version:

- is generated from the case evidence map and registered workspace materials,
- can focus on a selected interview question,
- includes only selected topic contexts, source ids, material references, and mandatory rules,
- includes material-only leads, such as a recording lead that has no question yet,
- requires model outputs to cite allowed source ids,
- includes explicit rules against truthfulness, guilt, procedural reliability, or psychological-diagnosis verdicts,
- exposes the pack through:

```text
GET /workspaces/{workspace_id}/grounding-pack?case_id=case-001&session_id=demo-session&question_id=q-001
```

## Consequences

- Future local AI prompts can be grounded without relying on broad UI state.
- Guardrails become part of the input contract, not only output validation.
- The current pack is still deterministic context; it is not model output and not an evidentiary conclusion.
- The next STOP remains before model-generated grounded suggestions are shown in live mode.
