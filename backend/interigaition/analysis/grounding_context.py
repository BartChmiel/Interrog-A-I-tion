"""Deterministic grounding context packs for future local AI prompts."""

from __future__ import annotations

from dataclasses import dataclass

from interigaition.analysis.evidence_map import EvidenceMap, EvidenceTopicNode, TopicEvidenceStatus
from interigaition.analysis.material_grounding import MaterialQuestionLink
from interigaition.domain.models import Case
from interigaition.storage.material_registry import MaterialRecord


@dataclass(frozen=True)
class GroundingRule:
    id: str
    severity: str
    instruction: str


@dataclass(frozen=True)
class GroundedTopicContext:
    topic_id: str
    label: str
    status: str
    in_focus: bool
    priority: str
    question_ids: tuple[str, ...]
    answer_ids: tuple[str, ...]
    claim_ids: tuple[str, ...]
    material_ids: tuple[str, ...]
    finding_ids: tuple[str, ...]


@dataclass(frozen=True)
class GroundedMaterialReference:
    material_id: str
    title: str
    source_type: str
    topic_ids: tuple[str, ...]
    linked_question_ids: tuple[str, ...]
    max_confidence: float
    tags: tuple[str, ...]


@dataclass(frozen=True)
class GroundingContextPack:
    case_id: str
    focus_question_id: str | None
    task: str
    allowed_source_ids: tuple[str, ...]
    topic_contexts: tuple[GroundedTopicContext, ...]
    material_references: tuple[GroundedMaterialReference, ...]
    rules: tuple[GroundingRule, ...]
    operator_review_required: bool


DEFAULT_GROUNDING_RULES: tuple[GroundingRule, ...] = (
    GroundingRule(
        id="cite-source-ids",
        severity="required",
        instruction=(
            "Every suggestion must cite the question, answer, claim, material, finding, "
            "or indicator ids that support it."
        ),
    ),
    GroundingRule(
        id="no-truthfulness-verdict",
        severity="required",
        instruction=(
            "Do not state that a participant is lying, truthful, guilty, innocent, "
            "or procedurally reliable."
        ),
    ),
    GroundingRule(
        id="neutral-followups-only",
        severity="required",
        instruction="Suggest only neutral, non-leading follow-up or clarification questions.",
    ),
    GroundingRule(
        id="mark-unknowns",
        severity="required",
        instruction="When the grounded sources do not support a claim, mark it as unknown.",
    ),
    GroundingRule(
        id="human-decision",
        severity="required",
        instruction="The authorized human operator remains responsible for interpretation and action.",
    ),
)


def build_grounding_context_pack(
    *,
    case: Case,
    evidence_map: EvidenceMap,
    materials: tuple[MaterialRecord, ...] = (),
    material_links: tuple[MaterialQuestionLink, ...] = (),
    focus_question_id: str | None = None,
    task: str = "suggest_grounded_followup_questions",
) -> GroundingContextPack:
    """Build a bounded context package for grounded local AI tasks."""

    focus_topic_ids = _focus_topic_ids(case, focus_question_id)
    always_include_statuses = {
        TopicEvidenceStatus.CONTESTED.value,
        TopicEvidenceStatus.MATERIAL_ONLY.value,
        TopicEvidenceStatus.MISSING.value,
    }
    selected_nodes = tuple(
        node
        for node in evidence_map.topic_nodes
        if node.topic_id in focus_topic_ids or node.status.value in always_include_statuses
    )
    if not selected_nodes:
        selected_nodes = evidence_map.topic_nodes

    material_references = _material_references(materials, material_links, selected_nodes)
    allowed_source_ids = tuple(
        sorted(
            {
                source_id
                for node in selected_nodes
                for source_id in (
                    *node.question_ids,
                    *node.answer_ids,
                    *node.claim_ids,
                    *node.material_ids,
                    *node.finding_ids,
                    *node.indicator_ids,
                )
            }
        )
    )

    return GroundingContextPack(
        case_id=case.id,
        focus_question_id=focus_question_id,
        task=task,
        allowed_source_ids=allowed_source_ids,
        topic_contexts=tuple(
            GroundedTopicContext(
                topic_id=node.topic_id,
                label=node.label,
                status=node.status.value,
                in_focus=node.topic_id in focus_topic_ids,
                priority=node.priority,
                question_ids=node.question_ids,
                answer_ids=node.answer_ids,
                claim_ids=node.claim_ids,
                material_ids=node.material_ids,
                finding_ids=node.finding_ids,
            )
            for node in selected_nodes
        ),
        material_references=material_references,
        rules=DEFAULT_GROUNDING_RULES,
        operator_review_required=True,
    )


def _focus_topic_ids(case: Case, focus_question_id: str | None) -> set[str]:
    if not focus_question_id:
        return set()

    return {
        topic_id
        for question in case.questions
        if question.id == focus_question_id
        for topic_id in question.topic_ids
    }


def _material_references(
    materials: tuple[MaterialRecord, ...],
    material_links: tuple[MaterialQuestionLink, ...],
    selected_nodes: tuple[EvidenceTopicNode, ...],
) -> tuple[GroundedMaterialReference, ...]:
    selected_topic_ids = {node.topic_id for node in selected_nodes}
    material_topic_ids: dict[str, set[str]] = {}
    for node in selected_nodes:
        for material_id in node.material_ids:
            material_topic_ids.setdefault(material_id, set()).add(node.topic_id)

    links_by_material: dict[str, list[MaterialQuestionLink]] = {}
    for link in material_links:
        if selected_topic_ids and not set(link.topic_ids).intersection(selected_topic_ids):
            continue
        links_by_material.setdefault(link.material_id, []).append(link)

    references: list[GroundedMaterialReference] = []
    for material in materials:
        links = links_by_material.get(material.id, [])
        topic_ids = {
            *material_topic_ids.get(material.id, set()),
            *(topic_id for link in links for topic_id in link.topic_ids),
        }
        if not topic_ids:
            continue
        references.append(
            GroundedMaterialReference(
                material_id=material.id,
                title=material.title,
                source_type=material.source_type.value,
                topic_ids=tuple(sorted(topic_ids)),
                linked_question_ids=tuple(sorted({link.question_id for link in links})),
                max_confidence=max((link.confidence for link in links), default=0.0),
                tags=material.tags,
            )
        )

    return tuple(sorted(references, key=lambda reference: reference.material_id))
