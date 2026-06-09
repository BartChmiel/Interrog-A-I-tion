"""Deterministic credibility and reliability indicators."""

from __future__ import annotations

from statistics import mean

from interrogaition.analysis.interview_review import InterviewReview, review_case
from interrogaition.domain.indicators import Indicator, IndicatorCategory, IndicatorFactor
from interrogaition.domain.models import Case


def generate_indicators(case: Case, review: InterviewReview | None = None) -> tuple[Indicator, ...]:
    """Generate deterministic, auditable indicators for a case review."""

    effective_review = review or review_case(case)
    base_indicators = (
        _topic_coverage_indicator(case, effective_review),
        _question_neutrality_indicator(case, effective_review),
        _narrative_consistency_indicator(case, effective_review),
        _source_of_knowledge_indicator(case, effective_review),
    )

    return (*base_indicators, _credibility_review_indicator(base_indicators))


def _topic_coverage_indicator(case: Case, review: InterviewReview) -> Indicator:
    total = len(case.topics)
    covered = len(review.covered_topic_ids)
    missing = len(review.missing_topic_ids)
    score = _ratio(covered, total)

    return Indicator(
        id="indicator-topic-coverage",
        category=IndicatorCategory.PROCESS,
        label="Topic coverage",
        description="Share of planned topics covered by questions or answers.",
        score=score,
        confidence=1.0,
        factors=(
            IndicatorFactor(
                id="factor-covered-topics",
                label="Covered topics",
                description="Number of topics already touched by questions or answers.",
                value=str(covered),
                linked_ids=review.covered_topic_ids,
            ),
            IndicatorFactor(
                id="factor-missing-topics",
                label="Missing topics",
                description="Number of planned topics still not covered.",
                value=str(missing),
                linked_ids=review.missing_topic_ids,
            ),
        ),
        linked_ids=(*review.covered_topic_ids, *review.missing_topic_ids),
        interpretation="Higher values mean the planned interview topics are more fully covered.",
        limitations=("Coverage does not mean the answers are complete or accurate.",),
    )


def _question_neutrality_indicator(case: Case, review: InterviewReview) -> Indicator:
    total = len(case.questions)
    flagged_ids = tuple(
        linked_id
        for finding in review.findings
        if finding.category == "question_neutrality"
        for linked_id in finding.linked_ids
    )
    flagged = len(flagged_ids)
    score = 1.0 - _ratio(flagged, total)

    return Indicator(
        id="indicator-question-neutrality",
        category=IndicatorCategory.PROCESS,
        label="Question neutrality",
        description="Share of questions without deterministic neutrality flags.",
        score=score,
        confidence=0.85,
        factors=(
            IndicatorFactor(
                id="factor-total-questions",
                label="Total questions",
                description="Number of questions currently in the interview plan.",
                value=str(total),
            ),
            IndicatorFactor(
                id="factor-flagged-questions",
                label="Flagged questions",
                description="Questions that may require review for neutrality.",
                value=str(flagged),
                linked_ids=flagged_ids,
            ),
        ),
        linked_ids=flagged_ids,
        interpretation="Higher values mean fewer questions were flagged by the deterministic checker.",
        limitations=("This is a first-pass linguistic check, not a psychological assessment.",),
    )


def _narrative_consistency_indicator(case: Case, review: InterviewReview) -> Indicator:
    answer_count = len(case.answers)
    conflict_findings = tuple(
        finding for finding in review.findings if finding.category == "potential_inconsistency"
    )
    conflict_count = len(conflict_findings)
    score = 1.0 - _ratio(conflict_count, max(1, answer_count))
    linked_ids = tuple(linked_id for finding in conflict_findings for linked_id in finding.linked_ids)

    return Indicator(
        id="indicator-narrative-consistency",
        category=IndicatorCategory.CONSISTENCY,
        label="Narrative consistency",
        description="Deterministic estimate based on detected conflicts between structured claims.",
        score=score,
        confidence=0.75 if answer_count else 0.3,
        factors=(
            IndicatorFactor(
                id="factor-answer-count",
                label="Recorded answers",
                description="Number of answers available for consistency analysis.",
                value=str(answer_count),
            ),
            IndicatorFactor(
                id="factor-conflict-count",
                label="Potential conflicts",
                description="Number of potential claim conflicts requiring clarification.",
                value=str(conflict_count),
                linked_ids=linked_ids,
            ),
        ),
        linked_ids=linked_ids,
        interpretation="Lower values indicate more unresolved conflicts in the recorded material.",
        limitations=("A conflict can result from memory, wording, stress, or incomplete notes.",),
    )


def _source_of_knowledge_indicator(case: Case, review: InterviewReview) -> Indicator:
    source_topic_ids = tuple(topic.id for topic in case.topics if "source" in topic.id.lower())
    source_claim_ids = tuple(
        claim.id
        for answer in case.answers
        for claim in answer.claims
        if claim.attribute == "source_of_knowledge"
    )
    covered_source_topics = tuple(
        topic_id for topic_id in source_topic_ids if topic_id in review.covered_topic_ids
    )

    if not source_topic_ids:
        score = None
        confidence = 0.2
    else:
        topic_score = _ratio(len(covered_source_topics), len(source_topic_ids))
        claim_bonus = 1.0 if source_claim_ids else 0.0
        score = mean((topic_score, claim_bonus))
        confidence = 0.7

    return Indicator(
        id="indicator-source-of-knowledge",
        category=IndicatorCategory.EVIDENCE_ALIGNMENT,
        label="Source-of-knowledge coverage",
        description="Checks whether the interview material records how the person knows relevant facts.",
        score=score,
        confidence=confidence,
        factors=(
            IndicatorFactor(
                id="factor-source-topics",
                label="Source topics covered",
                description="Source-of-knowledge topics covered by questions or answers.",
                value=f"{len(covered_source_topics)}/{len(source_topic_ids)}",
                linked_ids=covered_source_topics,
            ),
            IndicatorFactor(
                id="factor-source-claims",
                label="Source claims",
                description="Structured claims that record source of knowledge.",
                value=str(len(source_claim_ids)),
                linked_ids=source_claim_ids,
            ),
        ),
        linked_ids=(*covered_source_topics, *source_claim_ids),
        interpretation="Higher values mean the material better records how the person knows the facts.",
        limitations=("This does not verify whether the stated source is accurate.",),
    )


def _credibility_review_indicator(indicators: tuple[Indicator, ...]) -> Indicator:
    scored_indicators = tuple(indicator for indicator in indicators if indicator.score is not None)
    score = mean(indicator.score for indicator in scored_indicators) if scored_indicators else None
    confidence = mean(indicator.confidence for indicator in indicators) if indicators else 0.0

    return Indicator(
        id="indicator-credibility-review",
        category=IndicatorCategory.CREDIBILITY_REVIEW,
        label="Credibility review summary",
        description=(
            "Aggregated decision-support indicator based on process, consistency, and "
            "source-of-knowledge factors."
        ),
        score=score,
        confidence=confidence,
        factors=tuple(
            IndicatorFactor(
                id=f"factor-{indicator.id}",
                label=indicator.label,
                description=indicator.description,
                value=_format_score(indicator.score),
                linked_ids=indicator.linked_ids,
            )
            for indicator in scored_indicators
        ),
        linked_ids=tuple(linked_id for indicator in scored_indicators for linked_id in indicator.linked_ids),
        interpretation=(
            "This summarizes observable indicators in the material. It is not an automated "
            "legal or procedural decision."
        ),
        limitations=(
            "The score is only as reliable as the available notes and structured claims.",
            "The authorized human remains responsible for interpretation.",
        ),
    )


def _ratio(part: int, total: int) -> float:
    if total <= 0:
        return 1.0

    return max(0.0, min(1.0, part / total))


def _format_score(score: float | None) -> str:
    if score is None:
        return "not available"

    return f"{score:.2f}"
