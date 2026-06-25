"""Deterministic source-support cards for grounded AI suggestions."""

from __future__ import annotations

from dataclasses import dataclass

from interrogaition.ai.response_parser import ParsedSuggestionBatch
from interrogaition.analysis.grounding_context import GroundingContextPack, GroundingSourceReference


@dataclass(frozen=True)
class SuggestionSourceCard:
    source_id: str
    source_type: str
    label: str
    detail: str
    topic_ids: tuple[str, ...]


@dataclass(frozen=True)
class SuggestionSupportRecord:
    suggestion_id: str
    support_state: str
    cited_source_count: int
    known_source_count: int
    unknown_source_ids: tuple[str, ...]
    source_cards: tuple[SuggestionSourceCard, ...]


@dataclass(frozen=True)
class SuggestionSupportReport:
    state: str
    records: tuple[SuggestionSupportRecord, ...]
    summary: dict[str, int]


def build_suggestion_support_report(
    *,
    batch: ParsedSuggestionBatch,
    grounding_pack: GroundingContextPack,
) -> SuggestionSupportReport:
    """Build operator-readable support cards for each grounded suggestion."""

    references = {reference.source_id: reference for reference in grounding_pack.source_references}
    records = tuple(
        _support_record(
            suggestion_id=suggestion.id,
            linked_evidence=suggestion.linked_evidence,
            references=references,
        )
        for suggestion in batch.suggestions
    )
    summary = {
        "supported": sum(1 for record in records if record.support_state == "supported"),
        "partial": sum(1 for record in records if record.support_state == "partial"),
        "missing": sum(1 for record in records if record.support_state == "missing"),
        "unknown_sources": sum(len(record.unknown_source_ids) for record in records),
    }
    return SuggestionSupportReport(
        state=_report_state(records),
        records=records,
        summary=summary,
    )


def _support_record(
    *,
    suggestion_id: str,
    linked_evidence: tuple[str, ...],
    references: dict[str, GroundingSourceReference],
) -> SuggestionSupportRecord:
    source_cards = tuple(
        _source_card(references[source_id])
        for source_id in linked_evidence
        if source_id in references
    )
    unknown_source_ids = tuple(source_id for source_id in linked_evidence if source_id not in references)
    return SuggestionSupportRecord(
        suggestion_id=suggestion_id,
        support_state=_support_state(linked_evidence, source_cards, unknown_source_ids),
        cited_source_count=len(linked_evidence),
        known_source_count=len(source_cards),
        unknown_source_ids=unknown_source_ids,
        source_cards=source_cards,
    )


def _source_card(reference: GroundingSourceReference) -> SuggestionSourceCard:
    return SuggestionSourceCard(
        source_id=reference.source_id,
        source_type=reference.source_type,
        label=reference.label,
        detail=reference.detail,
        topic_ids=reference.topic_ids,
    )


def _support_state(
    linked_evidence: tuple[str, ...],
    source_cards: tuple[SuggestionSourceCard, ...],
    unknown_source_ids: tuple[str, ...],
) -> str:
    if not linked_evidence:
        return "missing"
    if unknown_source_ids or len(source_cards) < len(linked_evidence):
        return "partial"
    return "supported"


def _report_state(records: tuple[SuggestionSupportRecord, ...]) -> str:
    if not records:
        return "unknown"
    states = {record.support_state for record in records}
    if "missing" in states or "partial" in states:
        return "warning"
    return "ready"
