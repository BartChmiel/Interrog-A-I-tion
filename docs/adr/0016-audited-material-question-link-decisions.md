# ADR 0016: Audited Material-Question Link Decisions

## Status

Accepted.

## Context

The prototype creates deterministic links between registered source materials and interview questions. These links are useful for grounding AI prompts and evidence-map summaries, but they should not silently become trusted context without operator review.

## Decision

Add human `accepted` and `rejected` decisions for material-question links.

The first implementation:

- keeps the deterministic link algorithm unchanged,
- records decisions as append-only audit events,
- validates workspace access, material id, question id, topic ids, and confidence,
- exposes the decision workflow through:

```text
POST /workspaces/{workspace_id}/materials/{material_id}/questions/{question_id}/decision
GET /workspaces/{workspace_id}/audit
```

The React material cards show compact accept/reject controls beside each linked question.

## Consequences

- Operators can now explicitly review deterministic grounding links.
- Accepted and rejected links become traceable without mutating the deterministic analysis output.
- Future evidence alignment indicators can distinguish raw inferred links from operator-reviewed links.
- A future persistence layer may store current link decision state directly instead of deriving it from audit events.
