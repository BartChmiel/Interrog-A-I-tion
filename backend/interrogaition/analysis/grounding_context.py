"""Deterministic grounding context packs for future local AI prompts."""

from __future__ import annotations

from dataclasses import dataclass

from interrogaition.analysis.evidence_map import EvidenceMap, EvidenceTopicNode, TopicEvidenceStatus
from interrogaition.analysis.material_grounding import MaterialQuestionLink
from interrogaition.domain.models import Case
from interrogaition.storage.material_registry import MaterialRecord


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
    indicator_ids: tuple[str, ...]


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
class GroundingSourceReference:
    source_id: str
    source_type: str
    label: str
    detail: str
    topic_ids: tuple[str, ...]


@dataclass(frozen=True)
class GroundingContextPack:
    case_id: str
    focus_question_id: str | None
    task: str
    allowed_source_ids: tuple[str, ...]
    topic_contexts: tuple[GroundedTopicContext, ...]
    material_references: tuple[GroundedMaterialReference, ...]
    source_references: tuple[GroundingSourceReference, ...]
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

    topic_contexts = tuple(
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
            indicator_ids=node.indicator_ids,
        )
        for node in selected_nodes
    )

    return GroundingContextPack(
        case_id=case.id,
        focus_question_id=focus_question_id,
        task=task,
        allowed_source_ids=allowed_source_ids,
        topic_contexts=topic_contexts,
        material_references=material_references,
        source_references=_source_references(
            case=case,
            allowed_source_ids=allowed_source_ids,
            topic_contexts=topic_contexts,
            material_references=material_references,
        ),
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


def _source_references(
    *,
    case: Case,
    allowed_source_ids: tuple[str, ...],
    topic_contexts: tuple[GroundedTopicContext, ...],
    material_references: tuple[GroundedMaterialReference, ...],
) -> tuple[GroundingSourceReference, ...]:
    questions = {question.id: question for question in case.questions}
    answers = {answer.id: answer for answer in case.answers}
    claims = {claim.id: claim for answer in case.answers for claim in answer.claims}
    materials = {material.material_id: material for material in material_references}
    topic_ids_by_source = _topic_ids_by_source(topic_contexts)
    references: list[GroundingSourceReference] = []

    for source_id in allowed_source_ids:
        topic_ids = topic_ids_by_source.get(source_id, ())
        if source_id in questions:
            question = questions[source_id]
            references.append(
                GroundingSourceReference(
                    source_id=source_id,
                    source_type="question",
                    label=f"Question {source_id}",
                    detail=_clip(question.text),
                    topic_ids=topic_ids,
                )
            )
        elif source_id in answers:
            answer = answers[source_id]
            references.append(
                GroundingSourceReference(
                    source_id=source_id,
                    source_type="answer",
                    label=f"Answer {source_id}",
                    detail=_clip(answer.text),
                    topic_ids=topic_ids,
                )
            )
        elif source_id in claims:
            claim = claims[source_id]
            references.append(
                GroundingSourceReference(
                    source_id=source_id,
                    source_type="claim",
                    label=f"Claim {source_id}",
                    detail=_clip(f"{claim.subject}.{claim.attribute}: {claim.value}"),
                    topic_ids=topic_ids,
                )
            )
        elif source_id in materials:
            material = materials[source_id]
            detail_parts = [material.source_type]
            if material.tags:
                detail_parts.append(", ".join(material.tags[:4]))
            references.append(
                GroundingSourceReference(
                    source_id=source_id,
                    source_type="material",
                    label=material.title,
                    detail=_clip(" / ".join(detail_parts)),
                    topic_ids=topic_ids or material.topic_ids,
                )
            )
        elif source_id.startswith("finding-"):
            references.append(
                GroundingSourceReference(
                    source_id=source_id,
                    source_type="finding",
                    label=f"Finding {source_id}",
                    detail="Review finding linked to this topic.",
                    topic_ids=topic_ids,
                )
            )
        elif source_id.startswith("indicator-"):
            references.append(
                GroundingSourceReference(
                    source_id=source_id,
                    source_type="indicator",
                    label=f"Indicator {source_id}",
                    detail="Derived review indicator linked to this topic.",
                    topic_ids=topic_ids,
                )
            )
        else:
            references.append(
                GroundingSourceReference(
                    source_id=source_id,
                    source_type="unknown",
                    label=source_id,
                    detail="Source id is allowed but has no typed reference in the current pack.",
                    topic_ids=topic_ids,
                )
            )

    return tuple(references)


def _topic_ids_by_source(topic_contexts: tuple[GroundedTopicContext, ...]) -> dict[str, tuple[str, ...]]:
    grouped: dict[str, set[str]] = {}
    for topic in topic_contexts:
        for source_id in (
            *topic.question_ids,
            *topic.answer_ids,
            *topic.claim_ids,
            *topic.material_ids,
            *topic.finding_ids,
            *topic.indicator_ids,
        ):
            grouped.setdefault(source_id, set()).add(topic.topic_id)
    return {source_id: tuple(sorted(topic_ids)) for source_id, topic_ids in grouped.items()}


def _clip(value: str, limit: int = 180) -> str:
    normalized = " ".join(value.split())
    if len(normalized) <= limit:
        return normalized
    return f"{normalized[: limit - 3]}..."
