"""Quality checks for grounded AI suggestions.

The generator already rejects hard guardrail violations while parsing. This
module adds a review-oriented quality report: citation completeness, grounding
scope, human-review signals, and confidence hygiene.
"""

from __future__ import annotations

from dataclasses import dataclass

from interrogaition.ai.guardrails import find_forbidden_claims
from interrogaition.ai.response_parser import ParsedSuggestionBatch
from interrogaition.analysis.grounding_context import GroundingContextPack


@dataclass(frozen=True)
class SuggestionQualityIssue:
    suggestion_id: str
    code: str
    severity: str
    detail: str


@dataclass(frozen=True)
class SuggestionQualityRecord:
    suggestion_id: str
    suggestion_type: str
    state: str
    issue_count: int
    linked_evidence_count: int
    linked_topic_count: int
    risk_flags: tuple[str, ...]
    confidence: float | None


@dataclass(frozen=True)
class SuggestionQualityReport:
    state: str
    score: int
    suggestion_count: int
    issue_count: int
    warning_count: int
    error_count: int
    records: tuple[SuggestionQualityRecord, ...]
    issues: tuple[SuggestionQualityIssue, ...]
    summary: dict[str, int]


def evaluate_grounded_suggestion_quality(
    *,
    batch: ParsedSuggestionBatch,
    grounding_pack: GroundingContextPack,
) -> SuggestionQualityReport:
    """Evaluate generated grounded suggestions against the project's AI rules."""

    allowed_source_ids = set(grounding_pack.allowed_source_ids)
    allowed_topic_ids = {topic.topic_id for topic in grounding_pack.topic_contexts}
    issues: list[SuggestionQualityIssue] = []
    records: list[SuggestionQualityRecord] = []

    if not batch.suggestions:
        issues.append(
            SuggestionQualityIssue(
                suggestion_id="",
                code="no_suggestions",
                severity="warning",
                detail="The model returned no grounded suggestions for the current context.",
            )
        )

    for suggestion in batch.suggestions:
        suggestion_issues = _suggestion_quality_issues(
            suggestion_id=suggestion.id,
            text=suggestion.text,
            reason=suggestion.reason,
            linked_topics=suggestion.linked_topics,
            linked_evidence=suggestion.linked_evidence,
            risk_flags=suggestion.risk_flags,
            confidence=suggestion.confidence,
            allowed_source_ids=allowed_source_ids,
            allowed_topic_ids=allowed_topic_ids,
        )
        issues.extend(suggestion_issues)
        records.append(
            SuggestionQualityRecord(
                suggestion_id=suggestion.id,
                suggestion_type=suggestion.suggestion_type.value,
                state=_record_state(suggestion_issues),
                issue_count=len(suggestion_issues),
                linked_evidence_count=len(suggestion.linked_evidence),
                linked_topic_count=len(suggestion.linked_topics),
                risk_flags=suggestion.risk_flags,
                confidence=suggestion.confidence,
            )
        )

    warning_count = sum(1 for issue in issues if issue.severity == "warning")
    error_count = sum(1 for issue in issues if issue.severity == "error")
    state = _report_state(error_count=error_count, warning_count=warning_count)
    return SuggestionQualityReport(
        state=state,
        score=_quality_score(
            suggestion_count=len(batch.suggestions),
            warning_count=warning_count,
            error_count=error_count,
        ),
        suggestion_count=len(batch.suggestions),
        issue_count=len(issues),
        warning_count=warning_count,
        error_count=error_count,
        records=tuple(records),
        issues=tuple(issues),
        summary={
            "ready": sum(1 for record in records if record.state == "ready"),
            "warning": sum(1 for record in records if record.state == "warning"),
            "blocked": sum(1 for record in records if record.state == "blocked"),
            "unknown": 0,
        },
    )


def _suggestion_quality_issues(
    *,
    suggestion_id: str,
    text: str,
    reason: str,
    linked_topics: tuple[str, ...],
    linked_evidence: tuple[str, ...],
    risk_flags: tuple[str, ...],
    confidence: float | None,
    allowed_source_ids: set[str],
    allowed_topic_ids: set[str],
) -> tuple[SuggestionQualityIssue, ...]:
    issues: list[SuggestionQualityIssue] = []
    forbidden = find_forbidden_claims(f"{text}\n{reason}")
    if forbidden:
        issues.append(
            _issue(
                suggestion_id,
                "forbidden_claim",
                "error",
                f"Suggestion contains forbidden interpretive claim(s): {', '.join(forbidden)}.",
            )
        )

    if not linked_evidence:
        issues.append(
            _issue(
                suggestion_id,
                "missing_linked_evidence",
                "warning",
                "Suggestion does not cite source ids from the grounding pack.",
            )
        )
    for source_id in linked_evidence:
        if source_id not in allowed_source_ids:
            issues.append(
                _issue(
                    suggestion_id,
                    "unknown_source_id",
                    "warning",
                    f"Suggestion cites a source id outside the grounding pack: {source_id}.",
                )
            )

    if not linked_topics:
        issues.append(
            _issue(
                suggestion_id,
                "missing_linked_topic",
                "warning",
                "Suggestion does not cite a grounded topic id.",
            )
        )
    for topic_id in linked_topics:
        if topic_id not in allowed_topic_ids:
            issues.append(
                _issue(
                    suggestion_id,
                    "unknown_topic_id",
                    "warning",
                    f"Suggestion cites a topic id outside the grounding pack: {topic_id}.",
                )
            )

    if "operator_review_required" not in risk_flags:
        issues.append(
            _issue(
                suggestion_id,
                "missing_operator_review_flag",
                "warning",
                "Suggestion should carry the operator_review_required risk flag.",
            )
        )

    if confidence is None:
        issues.append(
            _issue(
                suggestion_id,
                "missing_confidence",
                "warning",
                "Suggestion does not expose model confidence.",
            )
        )
    elif confidence < 0.4:
        issues.append(
            _issue(
                suggestion_id,
                "low_confidence",
                "warning",
                "Suggestion confidence is below the review threshold.",
            )
        )

    return tuple(issues)


def _issue(
    suggestion_id: str,
    code: str,
    severity: str,
    detail: str,
) -> SuggestionQualityIssue:
    return SuggestionQualityIssue(
        suggestion_id=suggestion_id,
        code=code,
        severity=severity,
        detail=detail,
    )


def _record_state(issues: tuple[SuggestionQualityIssue, ...]) -> str:
    severities = {issue.severity for issue in issues}
    if "error" in severities:
        return "blocked"
    if "warning" in severities:
        return "warning"
    return "ready"


def _report_state(*, error_count: int, warning_count: int) -> str:
    if error_count:
        return "blocked"
    if warning_count:
        return "warning"
    return "ready"


def _quality_score(
    *,
    suggestion_count: int,
    warning_count: int,
    error_count: int,
) -> int:
    if suggestion_count == 0:
        return 0
    max_score = suggestion_count * 100
    penalty = warning_count * 10 + error_count * 35
    return max(0, round(((max_score - penalty) / max_score) * 100))
