"""End-to-end review pipeline for one interview case."""

from __future__ import annotations

from dataclasses import dataclass, field

from interigaition.analysis.narrative_consistency import ClaimConflict, find_claim_conflicts
from interigaition.analysis.question_neutrality import neutrality_flags
from interigaition.analysis.topic_coverage import covered_topic_ids, missing_topics
from interigaition.domain.models import Case, Question, Topic


@dataclass(frozen=True)
class ReviewFinding:
    category: str
    title: str
    detail: str
    linked_ids: tuple[str, ...] = ()
    severity: str = "medium"
    metadata: dict[str, object] = field(default_factory=dict)


@dataclass(frozen=True)
class InterviewReview:
    case_id: str
    covered_topic_ids: tuple[str, ...]
    missing_topic_ids: tuple[str, ...]
    findings: tuple[ReviewFinding, ...]


def review_case(case: Case) -> InterviewReview:
    """Run deterministic analysis for a case."""

    topics = list(case.topics)
    questions = list(case.questions)
    answers = list(case.answers)

    covered = tuple(sorted(covered_topic_ids(questions, answers)))
    missing = tuple(topic.id for topic in missing_topics(topics, questions, answers))

    findings: list[ReviewFinding] = []
    findings.extend(_missing_topic_findings(topics, missing))
    findings.extend(_question_neutrality_findings(questions))
    findings.extend(_claim_conflict_findings(find_claim_conflicts(answers)))

    return InterviewReview(
        case_id=case.id,
        covered_topic_ids=covered,
        missing_topic_ids=missing,
        findings=tuple(findings),
    )


def _missing_topic_findings(topics: list[Topic], missing_topic_ids: tuple[str, ...]) -> list[ReviewFinding]:
    topics_by_id = {topic.id: topic for topic in topics}
    findings: list[ReviewFinding] = []

    for topic_id in missing_topic_ids:
        topic = topics_by_id[topic_id]
        findings.append(
            ReviewFinding(
                category="missing_topic",
                title=f"Missing topic: {topic.label}",
                detail="Topic was not covered by any question or answer.",
                linked_ids=(topic.id,),
                severity="high" if topic.priority == "high" else "medium",
                metadata={"topic_label": topic.label},
            )
        )

    return findings


def _question_neutrality_findings(questions: list[Question]) -> list[ReviewFinding]:
    findings: list[ReviewFinding] = []

    for question in questions:
        flags = neutrality_flags(question.text)
        if not flags:
            continue

        findings.append(
            ReviewFinding(
                category="question_neutrality",
                title="Question may require neutral rewrite",
                detail=f"Detected flags: {', '.join(flags)}.",
                linked_ids=(question.id,),
                severity="medium",
                metadata={"flags": flags},
            )
        )

    return findings


def _claim_conflict_findings(conflicts: list[ClaimConflict]) -> list[ReviewFinding]:
    findings: list[ReviewFinding] = []

    for conflict in conflicts:
        values = ", ".join(sorted({claim.value for claim in conflict.claims}))
        findings.append(
            ReviewFinding(
                category="potential_inconsistency",
                title=f"Potential inconsistency: {conflict.attribute}",
                detail=(
                    "Different values were recorded for the same narrative element: "
                    f"{values}. This requires clarification, not a truthfulness verdict."
                ),
                linked_ids=conflict.answer_ids,
                severity="medium",
                metadata={
                    "attribute": conflict.attribute,
                    "values": sorted({claim.value for claim in conflict.claims}),
                },
            )
        )

    return findings
