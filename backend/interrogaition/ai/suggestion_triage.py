"""Operational triage for grounded AI suggestions."""

from __future__ import annotations

from dataclasses import dataclass

from interrogaition.ai.response_parser import ParsedSuggestionBatch
from interrogaition.ai.suggestion_quality import SuggestionQualityReport
from interrogaition.analysis.grounding_context import GroundingContextPack, GroundedTopicContext
from interrogaition.domain.models import SuggestionType


@dataclass(frozen=True)
class SuggestionTriageRecord:
    suggestion_id: str
    priority: str
    priority_score: int
    risk_level: str
    recommended_action: str
    rationale: str
    topic_statuses: tuple[str, ...]
    topic_labels: tuple[str, ...]
    evidence_state: str
    quality_state: str


@dataclass(frozen=True)
class SuggestionTriageReport:
    state: str
    top_suggestion_id: str | None
    records: tuple[SuggestionTriageRecord, ...]
    summary: dict[str, int]


def build_suggestion_triage_report(
    *,
    batch: ParsedSuggestionBatch,
    grounding_pack: GroundingContextPack,
    quality_report: SuggestionQualityReport,
    locale: str,
) -> SuggestionTriageReport:
    """Rank grounded suggestions by operational urgency and review risk."""

    topics_by_id = {topic.topic_id: topic for topic in grounding_pack.topic_contexts}
    quality_by_id = {record.suggestion_id: record for record in quality_report.records}
    records = tuple(
        sorted(
            (
                _triage_suggestion(
                    suggestion_id=suggestion.id,
                    suggestion_type=suggestion.suggestion_type.value,
                    confidence=suggestion.confidence,
                    linked_topics=suggestion.linked_topics,
                    linked_evidence=suggestion.linked_evidence,
                    risk_flags=suggestion.risk_flags,
                    topics_by_id=topics_by_id,
                    quality_state=quality_by_id.get(suggestion.id).state
                    if suggestion.id in quality_by_id
                    else "unknown",
                    locale=locale,
                )
                for suggestion in batch.suggestions
            ),
            key=lambda record: (-record.priority_score, record.suggestion_id),
        )
    )
    summary = {
        "high": sum(1 for record in records if record.priority == "high"),
        "medium": sum(1 for record in records if record.priority == "medium"),
        "low": sum(1 for record in records if record.priority == "low"),
        "blocked": sum(1 for record in records if record.risk_level == "blocked"),
        "needs_review": sum(1 for record in records if record.recommended_action != "ask_now"),
    }
    return SuggestionTriageReport(
        state=_triage_state(records),
        top_suggestion_id=records[0].suggestion_id if records else None,
        records=records,
        summary=summary,
    )


def _triage_suggestion(
    *,
    suggestion_id: str,
    suggestion_type: str,
    confidence: float | None,
    linked_topics: tuple[str, ...],
    linked_evidence: tuple[str, ...],
    risk_flags: tuple[str, ...],
    topics_by_id: dict[str, GroundedTopicContext],
    quality_state: str,
    locale: str,
) -> SuggestionTriageRecord:
    topics = tuple(topics_by_id[topic_id] for topic_id in linked_topics if topic_id in topics_by_id)
    evidence_state = _evidence_state(linked_evidence=linked_evidence, quality_state=quality_state)
    priority_score = _priority_score(
        suggestion_type=suggestion_type,
        confidence=confidence,
        linked_evidence=linked_evidence,
        risk_flags=risk_flags,
        topics=topics,
        quality_state=quality_state,
    )
    priority = _priority_band(priority_score)
    risk_level = _risk_level(
        confidence=confidence,
        evidence_state=evidence_state,
        quality_state=quality_state,
        topics=topics,
    )
    recommended_action = _recommended_action(
        priority=priority,
        risk_level=risk_level,
        evidence_state=evidence_state,
        suggestion_type=suggestion_type,
        quality_state=quality_state,
    )
    return SuggestionTriageRecord(
        suggestion_id=suggestion_id,
        priority=priority,
        priority_score=priority_score,
        risk_level=risk_level,
        recommended_action=recommended_action,
        rationale=_rationale(
            locale=locale,
            priority=priority,
            evidence_state=evidence_state,
            quality_state=quality_state,
            topics=topics,
            confidence=confidence,
        ),
        topic_statuses=tuple(sorted({topic.status for topic in topics})),
        topic_labels=tuple(topic.label for topic in topics[:3]),
        evidence_state=evidence_state,
        quality_state=quality_state,
    )


def _priority_score(
    *,
    suggestion_type: str,
    confidence: float | None,
    linked_evidence: tuple[str, ...],
    risk_flags: tuple[str, ...],
    topics: tuple[GroundedTopicContext, ...],
    quality_state: str,
) -> int:
    score = 38
    if suggestion_type == SuggestionType.FOLLOW_UP_QUESTION.value:
        score += 8
    if any(topic.in_focus for topic in topics):
        score += 12
    if any(topic.priority == "high" for topic in topics):
        score += 14
    if any(topic.status in {"missing", "contested"} for topic in topics):
        score += 16
    elif any(topic.status == "material_only" for topic in topics):
        score += 10
    if len(linked_evidence) >= 2:
        score += 10
    elif len(linked_evidence) == 1:
        score += 6
    else:
        score -= 14
    if confidence is not None:
        score += round(confidence * 14)
        if confidence < 0.45:
            score -= 10
    if "operator_review_required" in risk_flags:
        score += 3
    if quality_state == "warning":
        score -= 7
    elif quality_state == "blocked":
        score -= 25
    return max(0, min(100, score))


def _priority_band(score: int) -> str:
    if score >= 72:
        return "high"
    if score >= 48:
        return "medium"
    return "low"


def _risk_level(
    *,
    confidence: float | None,
    evidence_state: str,
    quality_state: str,
    topics: tuple[GroundedTopicContext, ...],
) -> str:
    if quality_state == "blocked":
        return "blocked"
    if evidence_state != "supported" or confidence is None or confidence < 0.45:
        return "high"
    if quality_state == "warning" or any(topic.status == "contested" for topic in topics):
        return "medium"
    return "low"


def _evidence_state(*, linked_evidence: tuple[str, ...], quality_state: str) -> str:
    if quality_state == "blocked":
        return "blocked"
    if not linked_evidence:
        return "missing"
    return "supported"


def _recommended_action(
    *,
    priority: str,
    risk_level: str,
    evidence_state: str,
    suggestion_type: str,
    quality_state: str,
) -> str:
    if risk_level == "blocked" or quality_state == "blocked":
        return "reject_or_regenerate"
    if evidence_state != "supported":
        return "review_sources"
    if risk_level in {"high", "medium"}:
        return "edit_before_use"
    if priority == "high" and suggestion_type == SuggestionType.FOLLOW_UP_QUESTION.value:
        return "ask_now"
    return "queue_for_later"


def _triage_state(records: tuple[SuggestionTriageRecord, ...]) -> str:
    if not records:
        return "unknown"
    if any(record.risk_level == "blocked" for record in records):
        return "blocked"
    if any(record.priority == "high" for record in records):
        return "ready"
    return "warning"


def _rationale(
    *,
    locale: str,
    priority: str,
    evidence_state: str,
    quality_state: str,
    topics: tuple[GroundedTopicContext, ...],
    confidence: float | None,
) -> str:
    topic_hint = _topic_hint(topics, locale)
    if locale == "pl":
        confidence_hint = "pewność nieznana" if confidence is None else f"pewność {confidence:.2f}"
        evidence_hint = {
            "blocked": "jakość blokuje użycie",
            "missing": "brakuje źródeł",
            "supported": "źródła są wskazane",
        }[evidence_state]
        quality_hint = "jakość OK" if quality_state == "ready" else f"jakość: {quality_state}"
        return f"{_priority_label(priority, locale)}: {topic_hint}; {evidence_hint}; {quality_hint}; {confidence_hint}."

    confidence_hint = "unknown confidence" if confidence is None else f"confidence {confidence:.2f}"
    evidence_hint = {
        "blocked": "quality blocks use",
        "missing": "missing sources",
        "supported": "sources cited",
    }[evidence_state]
    quality_hint = "quality OK" if quality_state == "ready" else f"quality: {quality_state}"
    return f"{_priority_label(priority, locale)}: {topic_hint}; {evidence_hint}; {quality_hint}; {confidence_hint}."


def _topic_hint(topics: tuple[GroundedTopicContext, ...], locale: str) -> str:
    if not topics:
        return "brak powiązanych tematów" if locale == "pl" else "no linked topics"
    top = topics[0]
    if locale == "pl":
        return f"{top.label} ({top.status}, {top.priority})"
    return f"{top.label} ({top.status}, {top.priority})"


def _priority_label(priority: str, locale: str) -> str:
    if locale == "pl":
        return {
            "high": "wysoki priorytet",
            "medium": "średni priorytet",
            "low": "niski priorytet",
        }.get(priority, priority)
    return {
        "high": "high priority",
        "medium": "medium priority",
        "low": "low priority",
    }.get(priority, priority)
