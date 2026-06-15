# ADR 0026: Operator Action Decision Audit

## Status

Accepted.

## Context

The frontend now builds an operator work queue from deterministic case state. Queue items
surface immediate actions such as asking the next question, checking linked materials, or
reviewing an open finding.

For a defensible investigative-support workflow, it is not enough to show recommended next
actions. The system must also preserve what the human operator did with those actions.

## Decision

Operator action decisions are recorded as append-only audit-chain events under the workspace
scope.

The backend exposes:

```text
POST /workspaces/{workspace_id}/operator-actions/decisions
GET /workspaces/{workspace_id}/operator-actions/decisions?case_id=...&session_id=...
```

The first UI integration records `opened`, `skipped`, and `dismissed` decisions from queue
controls. Each event preserves the action id, kind, title, detail, priority, target
question/tab, linked source ids, before/after UI state, optional model/provenance hashes, and
the operator identity used by the local UI.

The initial UI shows a compact recent-decision trail near the queue. It is deliberately small:
the queue remains an operational tool, not a compliance form.
The decision-list endpoint returns newest matching decisions first for this compact trail. The
workspace audit endpoint remains the chain-ordered integrity view.

## Boundaries

Operator action decisions are provenance records for prototype workflow review. They are not
official procedural records and must not be presented as court-ready documentation.

The system still does not decide truthfulness, guilt, psychological state, or legal credibility.
It only records how a human interacted with a surfaced workflow action.

## Consequences

- Future reviewers can inspect whether a visible action was opened, skipped, dismissed, or later
  accepted/edited/rejected.
- The audit chain remains the source of truth; no separate mutable operator log is introduced.
- The data shape leaves room for future richer decisions such as `converted_to_question`.
- Future exports can include operator decision metadata after a separate export/UX review.
