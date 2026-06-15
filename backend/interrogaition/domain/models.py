"""Core domain models.

These models intentionally describe interview material and workflow decisions.
They do not model a person's truthfulness, guilt, or psychological profile.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum


def utc_now() -> datetime:
    return datetime.now(UTC)


class Actor(StrEnum):
    HUMAN = "human"
    AI = "ai"
    SYSTEM = "system"


class QuestionSource(StrEnum):
    HUMAN = "human"
    AI = "ai"
    IMPORTED = "imported"


class QuestionType(StrEnum):
    OPEN = "open"
    CLARIFYING = "clarifying"
    CHRONOLOGICAL = "chronological"
    SOURCE_OF_KNOWLEDGE = "source_of_knowledge"
    CONTROL = "control"
    SUMMARY = "summary"
    CHALLENGE = "challenge"


class SuggestionType(StrEnum):
    INTERVIEW_PLAN = "interview_plan"
    FOLLOW_UP_QUESTION = "follow_up_question"
    GAP = "gap"
    POTENTIAL_INCONSISTENCY = "potential_inconsistency"
    NEUTRALITY_REWRITE = "neutrality_rewrite"
    SUMMARY = "summary"


class SuggestionStatus(StrEnum):
    PROPOSED = "proposed"
    ACCEPTED = "accepted"
    EDITED = "edited"
    REJECTED = "rejected"


class Priority(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


@dataclass(frozen=True)
class Topic:
    id: str
    label: str
    description: str = ""
    priority: Priority = Priority.MEDIUM


@dataclass(frozen=True)
class Question:
    id: str
    text: str
    source: QuestionSource
    question_type: QuestionType
    topic_ids: tuple[str, ...] = ()
    neutrality_flags: tuple[str, ...] = ()
    rationale: str = ""


@dataclass(frozen=True)
class Claim:
    id: str
    subject: str
    attribute: str
    value: str
    source_text: str = ""


@dataclass(frozen=True)
class Answer:
    id: str
    question_id: str
    text: str
    topic_ids: tuple[str, ...] = ()
    claims: tuple[Claim, ...] = ()
    created_at: datetime = field(default_factory=utc_now)


@dataclass(frozen=True)
class AISuggestion:
    id: str
    suggestion_type: SuggestionType
    text: str
    reason: str
    linked_topics: tuple[str, ...] = ()
    linked_evidence: tuple[str, ...] = ()
    risk_flags: tuple[str, ...] = ()
    confidence: float | None = None
    status: SuggestionStatus = SuggestionStatus.PROPOSED
    created_at: datetime = field(default_factory=utc_now)


@dataclass(frozen=True)
class AuditEvent:
    id: str
    timestamp: datetime
    actor: Actor
    action: str
    object_type: str
    object_id: str
    details: dict[str, object] = field(default_factory=dict)
    previous_hash: str | None = None
    event_hash: str | None = None


@dataclass(frozen=True)
class Case:
    id: str
    title: str
    description: str = ""
    topics: tuple[Topic, ...] = ()
    questions: tuple[Question, ...] = ()
    answers: tuple[Answer, ...] = ()
    ai_suggestions: tuple[AISuggestion, ...] = ()
    audit_events: tuple[AuditEvent, ...] = ()
    created_at: datetime = field(default_factory=utc_now)
