# ADR 0017: Evidence Alignment Indicator

## Status

Accepted.

## Context

The prototype records human `accepted` / `rejected` decisions for deterministic
material-question links as append-only audit events (ADR 0016). Those reviewed links
are a stronger signal than raw inferred links, but nothing yet summarizes how well the
interview aligns with registered case materials. The thesis and product direction need
a first serious, advisory indicator that is transparent and auditable, and that never
asserts truth, guilt, or credibility.

## Decision

Add an advisory **Evidence Alignment Indicator** derived only from human-reviewed
material-question links.

Read model (`analysis/material_link_decisions.py`):

- Folds workspace audit events into the latest decision per `(material_id, question_id)`.
- Pure, derived state; it does not mutate the audit trail.

Indicator (`analysis/evidence_alignment.py`):

- **Denominator** is the set of system-proposed material-question links.
- **Score** is the priority-weighted share of in-scope topics (topics referenced by a
  proposed link) that are supported by at least one human-accepted link.
- **Confidence** is review completeness (`reviewed / proposed`), reduced by half of the
  rejection rate (hybrid handling): rejected links are neutral for the score but lower
  confidence, signalling weaker machine grounding.
- **Bands**: `insufficient_review` when zero links are reviewed; otherwise
  `low` (< 0.34), `medium` (0.34-0.66), `high` (>= 0.67).
- The result is also emitted as an `Indicator` in the `evidence_alignment` category so it
  flows through existing indicator governance and the markdown report renderer.

Surface:

- `GET /workspaces/{workspace_id}/evidence-map` returns an additional `evidence_alignment`
  block alongside the existing `evidence_map`.
- The React case-map panel renders a professional gradient bar with the numeric value,
  band label, reviewed/confidence meta, explanation bullets, and a standing advisory note.

## Consequences

- Operators get a first transparent alignment indicator grounded in their own decisions.
- Accepting more links that cover new in-scope topics raises alignment; rejecting links
  never adds support and lowers confidence; with no reviewed links the indicator honestly
  reports `insufficient_review`.
- The indicator stays advisory: explanation bullets and limitations make the "why" explicit.
- Explanation bullets are currently generated server-side in English; full PL/EN
  localization of the dynamic explanation text is a follow-up.
- A future persistence layer may store current link-decision state directly instead of
  deriving it from audit events on each request.
