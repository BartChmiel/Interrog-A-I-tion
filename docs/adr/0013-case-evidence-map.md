# ADR 0013: Case Evidence Map

## Status

Accepted.

## Context

The prototype now has registered source materials, material-question grounding links, structured answers, claims, review findings, and deterministic indicators. These signals are useful separately, but future AI support needs one auditable case map before model prompts can safely use them as context.

The map must remain decision-support only. It cannot determine truthfulness, guilt, procedural status, or evidentiary value.

## Decision

Add a deterministic case evidence map.

The first version:

- groups questions, answers, claims, materials, findings, and indicators by topic,
- assigns a topic status: `covered`, `grounded`, `material_only`, `contested`, or `missing`,
- treats potential claim conflicts as clarification needs, not deception findings,
- includes material topic signals even when no interview question currently covers that topic,
- exposes the map through:

```text
GET /workspaces/{workspace_id}/evidence-map?case_id=case-001&session_id=demo-session
```

The React prototype displays a compact "Case map" panel in the right insight rail.

## Consequences

- Future AI prompts can use a structured map instead of scanning unrelated UI state.
- Investigators can see which topics have answers, materials, claims, and open findings.
- The first map is topic-level only; it is not a full evidence graph or chain-of-custody view.
- Human review remains required before treating any status as operationally meaningful.
