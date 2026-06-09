# ADR 0012: Material-Question Grounding Links

## Status

Accepted.

## Context

The project now has a workspace material register. The next step toward reliable AI support is to connect registered source material with interview questions before any model-generated reasoning is shown to the operator.

The prototype needs this connection to be deterministic, auditable, and safe to run without a local LLM.

## Decision

Add deterministic material-question grounding links.

The first version:

- reads registered text materials through the workspace boundary,
- infers topic signals from material title, type, tags, and text,
- links materials to questions when material topic signals overlap with question `topic_ids`,
- returns link confidence, matched terms, topic ids, and a short rationale,
- exposes links through:

```text
GET /workspaces/{workspace_id}/materials/links?case_id=case-001
```

The React prototype displays linked materials on the active question and linked question ids on each material card.

## Consequences

- Future AI prompts can be grounded in specific registered material ids.
- The operator can see why a material is relevant to a question before accepting AI help.
- The current links are heuristic topic links, not legal relevance determinations.
- Human acceptance/rejection of proposed links is now recorded separately as append-only audit events.
