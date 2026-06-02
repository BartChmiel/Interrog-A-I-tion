"""Deterministic case evidence map for interview workspace review."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from interigaition.analysis.interview_review import InterviewReview
from interigaition.analysis.material_grounding import MaterialQuestionLink, MaterialTopicSignal
from interigaition.domain.indicators import Indicator
from interigaition.domain.models import Answer, Case
from interigaition.storage.material_registry import MaterialRecord


_CLAIM_ATTRIBUTE_TOPIC_HINTS: dict[str, tuple[str, ...]] = {
    "location": ("topic-location",),
    "person": ("topic-person",),
    "source_of_knowledge": ("topic-source",),
    "time": ("topic-chronology",),
}


class TopicEvidenceStatus(StrEnum):
    COVERED = "covered"
    GROUNDED = "grounded"
    MATERIAL_ONLY = "material_only"
    CONTESTED = "contested"
    MISSING = "missing"


@dataclass(frozen=True)
class EvidenceMapSummary:
    total_topics: int
    covered_topics: int
    grounded_topics: int
    material_only_topics: int
    contested_topics: int
    missing_topics: int
    total_questions: int
    answered_questions: int
    total_answers: int
    total_claims: int
    total_materials: int
    total_material_question_links: int
    total_findings: int


@dataclass(frozen=True)
class EvidenceTopicNode:
    topic_id: str
    label: str
    priority: str
    status: TopicEvidenceStatus
    question_ids: tuple[str, ...]
    answer_ids: tuple[str, ...]
    claim_ids: tuple[str, ...]
    material_ids: tuple[str, ...]
    finding_ids: tuple[str, ...]
    indicator_ids: tuple[str, ...]


@dataclass(frozen=True)
class EvidenceMap:
    case_id: str
    summary: EvidenceMapSummary
    topic_nodes: tuple[EvidenceTopicNode, ...]


def build_evidence_map(
    *,
    case: Case,
    review: InterviewReview,
    indicators: tuple[Indicator, ...],
    materials: tuple[MaterialRecord, ...] = (),
    material_links: tuple[MaterialQuestionLink, ...] = (),
    material_topic_signals: tuple[MaterialTopicSignal, ...] = (),
) -> EvidenceMap:
    """Build an auditable topic-level evidence map from deterministic analysis output."""

    answer_topics = _answer_topics(case.answers)
    claim_topics = _claim_topics(case.answers)
    finding_ids_by_topic, contested_topic_ids = _finding_topics(review, answer_topics)
    indicator_ids_by_topic = _indicator_topics(indicators, answer_topics, claim_topics)
    material_ids_by_topic = _material_topics(material_links, material_topic_signals)
    answered_question_ids = {answer.question_id for answer in case.answers}
    missing_topic_ids = set(review.missing_topic_ids)

    topic_nodes: list[EvidenceTopicNode] = []
    for topic in case.topics:
        question_ids = tuple(
            question.id for question in case.questions if topic.id in question.topic_ids
        )
        answer_ids = tuple(answer.id for answer in case.answers if topic.id in answer.topic_ids)
        claim_ids = tuple(
            claim.id
            for answer in case.answers
            if topic.id in answer.topic_ids
            for claim in answer.claims
        )
        material_ids = tuple(sorted(material_ids_by_topic.get(topic.id, set())))
        status = _topic_status(
            topic_id=topic.id,
            missing_topic_ids=missing_topic_ids,
            contested_topic_ids=contested_topic_ids,
            material_ids=material_ids,
        )
        topic_nodes.append(
            EvidenceTopicNode(
                topic_id=topic.id,
                label=topic.label,
                priority=topic.priority.value,
                status=status,
                question_ids=question_ids,
                answer_ids=answer_ids,
                claim_ids=claim_ids,
                material_ids=material_ids,
                finding_ids=tuple(sorted(finding_ids_by_topic.get(topic.id, set()))),
                indicator_ids=tuple(sorted(indicator_ids_by_topic.get(topic.id, set()))),
            )
        )

    summary = EvidenceMapSummary(
        total_topics=len(case.topics),
        covered_topics=sum(1 for node in topic_nodes if node.status != TopicEvidenceStatus.MISSING),
        grounded_topics=sum(1 for node in topic_nodes if node.status == TopicEvidenceStatus.GROUNDED),
        material_only_topics=sum(1 for node in topic_nodes if node.status == TopicEvidenceStatus.MATERIAL_ONLY),
        contested_topics=sum(1 for node in topic_nodes if node.status == TopicEvidenceStatus.CONTESTED),
        missing_topics=sum(1 for node in topic_nodes if node.status == TopicEvidenceStatus.MISSING),
        total_questions=len(case.questions),
        answered_questions=len(answered_question_ids),
        total_answers=len(case.answers),
        total_claims=sum(len(answer.claims) for answer in case.answers),
        total_materials=len(materials),
        total_material_question_links=len(material_links),
        total_findings=len(review.findings),
    )

    return EvidenceMap(
        case_id=case.id,
        summary=summary,
        topic_nodes=tuple(topic_nodes),
    )


def _topic_status(
    *,
    topic_id: str,
    missing_topic_ids: set[str],
    contested_topic_ids: set[str],
    material_ids: tuple[str, ...],
) -> TopicEvidenceStatus:
    if topic_id in contested_topic_ids:
        return TopicEvidenceStatus.CONTESTED
    if topic_id in missing_topic_ids:
        if material_ids:
            return TopicEvidenceStatus.MATERIAL_ONLY
        return TopicEvidenceStatus.MISSING
    if material_ids:
        return TopicEvidenceStatus.GROUNDED
    return TopicEvidenceStatus.COVERED


def _answer_topics(answers: tuple[Answer, ...]) -> dict[str, tuple[str, ...]]:
    return {answer.id: answer.topic_ids for answer in answers}


def _claim_topics(answers: tuple[Answer, ...]) -> dict[str, tuple[str, ...]]:
    return {
        claim.id: answer.topic_ids
        for answer in answers
        for claim in answer.claims
    }


def _finding_topics(
    review: InterviewReview,
    answer_topics: dict[str, tuple[str, ...]],
) -> tuple[dict[str, set[str]], set[str]]:
    finding_ids_by_topic: dict[str, set[str]] = {}
    contested_topic_ids: set[str] = set()

    for index, finding in enumerate(review.findings, start=1):
        finding_id = f"finding-{index:03d}"
        linked_topic_ids = set(
            linked_id for linked_id in finding.linked_ids if linked_id.startswith("topic-")
        )
        hinted_topic_ids = _claim_attribute_topic_ids(finding.metadata.get("attribute"))
        if hinted_topic_ids:
            linked_topic_ids.update(hinted_topic_ids)
        else:
            for linked_id in finding.linked_ids:
                linked_topic_ids.update(answer_topics.get(linked_id, ()))

        if finding.category == "potential_inconsistency":
            contested_topic_ids.update(linked_topic_ids)

        for topic_id in linked_topic_ids:
            finding_ids_by_topic.setdefault(topic_id, set()).add(finding_id)

    return finding_ids_by_topic, contested_topic_ids


def _claim_attribute_topic_ids(attribute: object) -> tuple[str, ...]:
    return _CLAIM_ATTRIBUTE_TOPIC_HINTS.get(str(attribute), ())


def _indicator_topics(
    indicators: tuple[Indicator, ...],
    answer_topics: dict[str, tuple[str, ...]],
    claim_topics: dict[str, tuple[str, ...]],
) -> dict[str, set[str]]:
    indicator_ids_by_topic: dict[str, set[str]] = {}

    for indicator in indicators:
        linked_ids = set(indicator.linked_ids)
        for factor in indicator.factors:
            linked_ids.update(factor.linked_ids)

        topic_ids: set[str] = set()
        for linked_id in linked_ids:
            if linked_id.startswith("topic-"):
                topic_ids.add(linked_id)
            topic_ids.update(answer_topics.get(linked_id, ()))
            topic_ids.update(claim_topics.get(linked_id, ()))

        for topic_id in topic_ids:
            indicator_ids_by_topic.setdefault(topic_id, set()).add(indicator.id)

    return indicator_ids_by_topic


def _material_topics(
    material_links: tuple[MaterialQuestionLink, ...],
    material_topic_signals: tuple[MaterialTopicSignal, ...],
) -> dict[str, set[str]]:
    material_ids_by_topic: dict[str, set[str]] = {}

    for link in material_links:
        for topic_id in link.topic_ids:
            material_ids_by_topic.setdefault(topic_id, set()).add(link.material_id)

    for signal in material_topic_signals:
        material_ids_by_topic.setdefault(signal.topic_id, set()).add(signal.material_id)

    return material_ids_by_topic
