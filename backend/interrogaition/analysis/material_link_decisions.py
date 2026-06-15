"""Read model deriving human decisions on material-question links from audit events.

The audited decision workflow appends one event per accept/reject action with the
``material_question_link`` object type. This module folds those append-only events
into the latest decision per ``(material_id, question_id)`` pair, so downstream
analysis can reason about human-reviewed links without mutating the audit trail.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from interrogaition.domain.models import AuditEvent

MATERIAL_QUESTION_LINK_OBJECT_TYPE = "material_question_link"
DECISION_ACCEPTED = "accepted"
DECISION_REJECTED = "rejected"
_VALID_DECISIONS = frozenset({DECISION_ACCEPTED, DECISION_REJECTED})


@dataclass(frozen=True)
class MaterialLinkDecision:
    """The latest human decision recorded for a single material-question link."""

    material_id: str
    question_id: str
    decision: str
    topic_ids: tuple[str, ...]
    matched_terms: tuple[str, ...]
    confidence: float | None
    actor_id: str | None
    event_id: str | None

    @property
    def accepted(self) -> bool:
        return self.decision == DECISION_ACCEPTED

    @property
    def rejected(self) -> bool:
        return self.decision == DECISION_REJECTED


@dataclass(frozen=True)
class MaterialLinkDecisionLog:
    """Latest decision per material-question link, ordered deterministically."""

    decisions: tuple[MaterialLinkDecision, ...] = ()

    def decision_for(self, material_id: str, question_id: str) -> MaterialLinkDecision | None:
        for decision in self.decisions:
            if decision.material_id == material_id and decision.question_id == question_id:
                return decision
        return None

    @property
    def accepted(self) -> tuple[MaterialLinkDecision, ...]:
        return tuple(decision for decision in self.decisions if decision.accepted)

    @property
    def rejected(self) -> tuple[MaterialLinkDecision, ...]:
        return tuple(decision for decision in self.decisions if decision.rejected)


def derive_material_link_decisions(
    events: Iterable[AuditEvent],
) -> MaterialLinkDecisionLog:
    """Fold append-only audit events into the latest decision per link.

    Events must be supplied in chain (chronological) order so the last recorded
    decision for a link wins. Events that are not material-question link decisions,
    or that omit a recognizable accepted/rejected value, are ignored.
    """

    latest: dict[tuple[str, str], MaterialLinkDecision] = {}

    for event in events:
        if event.object_type != MATERIAL_QUESTION_LINK_OBJECT_TYPE:
            continue

        details = event.details or {}
        decision = _resolve_decision(event.action, details.get("decision"))
        if decision is None:
            continue

        material_id, question_id = _resolve_pair(event.object_id, details)
        if not material_id or not question_id:
            continue

        latest[(material_id, question_id)] = MaterialLinkDecision(
            material_id=material_id,
            question_id=question_id,
            decision=decision,
            topic_ids=_string_tuple(details.get("topic_ids")),
            matched_terms=_string_tuple(details.get("matched_terms")),
            confidence=_optional_float(details.get("confidence")),
            actor_id=_optional_str(details.get("actor_id")),
            event_id=event.id,
        )

    ordered = tuple(
        sorted(latest.values(), key=lambda decision: (decision.question_id, decision.material_id))
    )
    return MaterialLinkDecisionLog(decisions=ordered)


def _resolve_decision(action: str, raw_decision: object) -> str | None:
    candidate = str(raw_decision).strip().lower() if raw_decision is not None else ""
    if candidate in _VALID_DECISIONS:
        return candidate

    # Fall back to the action verb, e.g. "material_question_link_accepted".
    for decision in _VALID_DECISIONS:
        if action.endswith(decision):
            return decision
    return None


def _resolve_pair(object_id: str, details: dict[str, object]) -> tuple[str, str]:
    material_id = _optional_str(details.get("material_id")) or ""
    question_id = _optional_str(details.get("question_id")) or ""
    if material_id and question_id:
        return material_id, question_id

    # object_id is encoded as "{material_id}:{question_id}".
    if ":" in object_id:
        parsed_material, _, parsed_question = object_id.partition(":")
        material_id = material_id or parsed_material.strip()
        question_id = question_id or parsed_question.strip()
    return material_id, question_id


def _string_tuple(value: object) -> tuple[str, ...]:
    if isinstance(value, (list, tuple)):
        return tuple(str(item) for item in value)
    return ()


def _optional_float(value: object) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    return None


def _optional_str(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None
