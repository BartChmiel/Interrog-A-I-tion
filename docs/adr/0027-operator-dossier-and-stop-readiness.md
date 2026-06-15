# ADR 0027: Operator Dossier and STOP Readiness

## Status

Accepted.

## Context

The prototype now has enough operational surfaces that a user can navigate a case:
case catalog, question plan, workspace materials, evidence map, grounded AI suggestions,
operator work queue, audited operator decisions, and a provenance timeline.

This creates a new risk: the application can look busy without clearly telling the operator
where they are in the investigative workflow, what remains unresolved, and whether a strategic
STOP gate is approaching.

The project also has a thesis/research requirement. Strategic decisions about real model output,
real or anonymized data, official-looking exports, and legal or psychological interpretation
must remain visible in the development process.

## Decision

The frontend will expose a compact operator-facing case dossier and a review-facing STOP
readiness surface.

The case dossier summarizes:

- active case identity and description,
- planned topic coverage,
- priority gaps,
- starter material count and starter material labels,
- recorded answer count,
- a direct jump into the materials workflow.

The STOP readiness surface summarizes development and operational gates such as:

- synthetic-only data posture,
- encrypted storage readiness,
- real model output gate,
- provenance/audit readiness,
- official export restraint,
- human decision authority.

These surfaces are advisory workflow aids. They do not replace the append-only audit chain,
formal export manifests, legal review, institutional policy, or a human supervisor's decision.

## Boundaries

The dossier and STOP readiness surfaces must not introduce legal conclusions, guilt
assessment, psychological diagnosis, or automated credibility verdicts.

They are allowed to say that coverage, provenance, encryption, or model-readiness work remains
incomplete. They are not allowed to say that a person is truthful, deceptive, guilty, or
procedurally safe to charge.

## Consequences

- Operators get a stronger orientation layer before interacting with questions, materials, and AI.
- Thesis and product work stay aligned because strategic gates are visible in the repository and UI.
- Future institutional features can hang off explicit gates instead of being silently added to the
  live workflow.
- The next STOP review can evaluate whether dossier/gate wording is clear enough for a police,
  prosecutor, or expert-witness audience.

## Follow-up

- Decide whether STOP readiness belongs in the main Review tab, a dedicated Governance tab, or an
  admin-only settings view.
- Decide whether STOP readiness should be exported into reports or remain a development/operator UI.
- Decide whether encrypted storage should become a hard block before any non-synthetic import UI.
- Decide how to represent real model readiness when Ollama or a bridged commercial model is enabled.
