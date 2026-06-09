"""Advisory Evidence Alignment Indicator.

Measures how well interview questions align with registered case materials, based
strictly on human-reviewed material-question links. The indicator is advisory and
transparent: it never asserts truth, guilt, or credibility, and always explains why
it is high, medium, low, or not yet assessable.

Design (see ADR 0017):
- Denominator is the set of system-proposed material-question links.
- ``score`` is the priority-weighted share of in-scope topics that are supported by
  at least one human-accepted link.
- ``confidence`` is review completeness (reviewed / proposed), reduced when a large
  share of reviewed links were rejected (hybrid handling of rejections).
- Rejected links are neutral for the score (they never count as support) but lower
  confidence, signalling weaker machine grounding.
- With zero reviewed links the band is ``insufficient_review`` and the score is None.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from interrogaition.analysis.material_grounding import MaterialQuestionLink
from interrogaition.analysis.material_link_decisions import MaterialLinkDecisionLog
from interrogaition.domain.indicators import Indicator, IndicatorCategory, IndicatorFactor
from interrogaition.domain.models import Case, Priority

EVIDENCE_ALIGNMENT_INDICATOR_ID = "indicator-evidence-alignment"

_PRIORITY_WEIGHTS: dict[Priority, float] = {
    Priority.LOW: 1.0,
    Priority.MEDIUM: 2.0,
    Priority.HIGH: 3.0,
}
_HIGH_THRESHOLD = 0.67
_MEDIUM_THRESHOLD = 0.34
_REJECTION_CONFIDENCE_PENALTY = 0.5


class AlignmentBand(StrEnum):
    INSUFFICIENT_REVIEW = "insufficient_review"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


@dataclass(frozen=True)
class AlignmentTopicNode:
    topic_id: str
    label: str
    priority: str
    weight: float
    in_scope: bool
    supported: bool
    accepted_link_count: int
    rejected_link_count: int
    pending_link_count: int


@dataclass(frozen=True)
class EvidenceAlignment:
    case_id: str
    band: AlignmentBand
    score: float | None
    confidence: float
    total_proposed_links: int
    reviewed_links: int
    accepted_links: int
    rejected_links: int
    pending_links: int
    in_scope_topics: int
    supported_topics: int
    rejection_rate: float
    topic_nodes: tuple[AlignmentTopicNode, ...]
    explanation: tuple[str, ...]
    indicator: Indicator


def build_evidence_alignment(
    *,
    case: Case,
    proposed_links: tuple[MaterialQuestionLink, ...],
    decisions: MaterialLinkDecisionLog,
) -> EvidenceAlignment:
    """Build the advisory evidence alignment result for a workspace case view."""

    topics_by_id = {topic.id: topic for topic in case.topics}

    # Deduplicate proposed links to one entry per (material, question) pair.
    proposed_by_pair: dict[tuple[str, str], MaterialQuestionLink] = {}
    for link in proposed_links:
        proposed_by_pair.setdefault((link.material_id, link.question_id), link)
    total_proposed = len(proposed_by_pair)

    accepted_pairs: set[tuple[str, str]] = set()
    rejected_pairs: set[tuple[str, str]] = set()
    accepted_by_topic: dict[str, int] = {}
    rejected_by_topic: dict[str, int] = {}
    pending_by_topic: dict[str, int] = {}
    in_scope_topic_ids: set[str] = set()
    supported_topic_ids: set[str] = set()

    for pair, link in proposed_by_pair.items():
        decision = decisions.decision_for(*pair)
        if decision is not None and decision.accepted:
            accepted_pairs.add(pair)
        elif decision is not None and decision.rejected:
            rejected_pairs.add(pair)

        for topic_id in link.topic_ids:
            if topic_id not in topics_by_id:
                continue
            in_scope_topic_ids.add(topic_id)
            if decision is None:
                pending_by_topic[topic_id] = pending_by_topic.get(topic_id, 0) + 1
            elif decision.accepted:
                accepted_by_topic[topic_id] = accepted_by_topic.get(topic_id, 0) + 1
                supported_topic_ids.add(topic_id)
            else:
                rejected_by_topic[topic_id] = rejected_by_topic.get(topic_id, 0) + 1

    reviewed_links = len(accepted_pairs) + len(rejected_pairs)
    accepted_links = len(accepted_pairs)
    rejected_links = len(rejected_pairs)
    pending_links = total_proposed - reviewed_links

    rejection_rate = round(rejected_links / reviewed_links, 2) if reviewed_links else 0.0

    in_scope_weight = sum(_weight(topics_by_id[tid].priority) for tid in in_scope_topic_ids)
    supported_weight = sum(_weight(topics_by_id[tid].priority) for tid in supported_topic_ids)

    if total_proposed == 0 or reviewed_links == 0:
        score: float | None = None
        band = AlignmentBand.INSUFFICIENT_REVIEW
        confidence = 0.0
    else:
        score = round(supported_weight / in_scope_weight, 2) if in_scope_weight else 0.0
        band = _band_for_score(score)
        review_completeness = reviewed_links / total_proposed
        confidence = round(
            review_completeness * (1.0 - _REJECTION_CONFIDENCE_PENALTY * rejection_rate),
            2,
        )

    topic_nodes = tuple(
        AlignmentTopicNode(
            topic_id=topic.id,
            label=topic.label,
            priority=topic.priority.value,
            weight=_weight(topic.priority),
            in_scope=topic.id in in_scope_topic_ids,
            supported=topic.id in supported_topic_ids,
            accepted_link_count=accepted_by_topic.get(topic.id, 0),
            rejected_link_count=rejected_by_topic.get(topic.id, 0),
            pending_link_count=pending_by_topic.get(topic.id, 0),
        )
        for topic in case.topics
        if topic.id in in_scope_topic_ids
    )

    explanation = _build_explanation(
        band=band,
        score=score,
        total_proposed=total_proposed,
        reviewed_links=reviewed_links,
        accepted_links=accepted_links,
        rejected_links=rejected_links,
        pending_links=pending_links,
        in_scope_topics=len(in_scope_topic_ids),
        supported_topics=len(supported_topic_ids),
    )

    indicator = _build_indicator(
        case_id=case.id,
        band=band,
        score=score,
        confidence=confidence,
        total_proposed=total_proposed,
        reviewed_links=reviewed_links,
        accepted_links=accepted_links,
        rejected_links=rejected_links,
        in_scope_topics=len(in_scope_topic_ids),
        supported_topic_ids=tuple(sorted(supported_topic_ids)),
        explanation=explanation,
    )

    return EvidenceAlignment(
        case_id=case.id,
        band=band,
        score=score,
        confidence=confidence,
        total_proposed_links=total_proposed,
        reviewed_links=reviewed_links,
        accepted_links=accepted_links,
        rejected_links=rejected_links,
        pending_links=pending_links,
        in_scope_topics=len(in_scope_topic_ids),
        supported_topics=len(supported_topic_ids),
        rejection_rate=rejection_rate,
        topic_nodes=topic_nodes,
        explanation=explanation,
        indicator=indicator,
    )


def _weight(priority: Priority) -> float:
    return _PRIORITY_WEIGHTS.get(priority, 2.0)


def _band_for_score(score: float) -> AlignmentBand:
    if score >= _HIGH_THRESHOLD:
        return AlignmentBand.HIGH
    if score >= _MEDIUM_THRESHOLD:
        return AlignmentBand.MEDIUM
    return AlignmentBand.LOW


def _build_explanation(
    *,
    band: AlignmentBand,
    score: float | None,
    total_proposed: int,
    reviewed_links: int,
    accepted_links: int,
    rejected_links: int,
    pending_links: int,
    in_scope_topics: int,
    supported_topics: int,
) -> tuple[str, ...]:
    if band == AlignmentBand.INSUFFICIENT_REVIEW:
        if total_proposed == 0:
            return (
                "No material-question links have been proposed for this case yet.",
                "Register materials and link them to questions to enable alignment review.",
            )
        return (
            f"{total_proposed} material-question link(s) proposed, but none reviewed yet.",
            "Accept or reject proposed links to enable an alignment assessment.",
        )

    bullets = [
        f"{reviewed_links}/{total_proposed} proposed links reviewed "
        f"({accepted_links} accepted, {rejected_links} rejected, {pending_links} pending).",
        f"Human-accepted links support {supported_topics}/{in_scope_topics} in-scope topics "
        f"(priority-weighted alignment {score:.2f}).",
    ]
    if rejected_links:
        bullets.append(
            "Rejected links do not count as support and reduce review confidence."
        )
    if pending_links:
        bullets.append(
            "Pending links are not yet counted; reviewing them will refine this indicator."
        )
    return tuple(bullets)


def _build_indicator(
    *,
    case_id: str,
    band: AlignmentBand,
    score: float | None,
    confidence: float,
    total_proposed: int,
    reviewed_links: int,
    accepted_links: int,
    rejected_links: int,
    in_scope_topics: int,
    supported_topic_ids: tuple[str, ...],
    explanation: tuple[str, ...],
) -> Indicator:
    return Indicator(
        id=EVIDENCE_ALIGNMENT_INDICATOR_ID,
        category=IndicatorCategory.EVIDENCE_ALIGNMENT,
        label="Evidence alignment",
        description=(
            "Advisory alignment between interview questions and registered case "
            "materials, based on human-reviewed material-question links."
        ),
        score=score,
        confidence=confidence,
        factors=(
            IndicatorFactor(
                id="factor-reviewed-links",
                label="Reviewed links",
                description="Proposed material-question links a human has reviewed.",
                value=f"{reviewed_links}/{total_proposed}",
            ),
            IndicatorFactor(
                id="factor-accepted-links",
                label="Accepted links",
                description="Links a human accepted as supporting the question.",
                value=str(accepted_links),
                linked_ids=supported_topic_ids,
            ),
            IndicatorFactor(
                id="factor-rejected-links",
                label="Rejected links",
                description="Links a human rejected; not counted as support.",
                value=str(rejected_links),
            ),
            IndicatorFactor(
                id="factor-supported-topics",
                label="Supported topics",
                description="In-scope topics supported by at least one accepted link.",
                value=f"{len(supported_topic_ids)}/{in_scope_topics}",
                linked_ids=supported_topic_ids,
            ),
        ),
        linked_ids=supported_topic_ids,
        interpretation=" ".join(explanation),
        limitations=(
            "Reflects only human-reviewed material-question links, not a judgment of "
            "truth, guilt, or credibility.",
            "Final interpretation belongs to the authorized investigator.",
        ),
    )
