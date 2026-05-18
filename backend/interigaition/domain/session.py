"""Live interview session domain models and operations."""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from datetime import UTC, datetime
from enum import StrEnum

from interigaition.domain.models import Actor, Answer, Case


def utc_now() -> datetime:
    return datetime.now(UTC)


class ParticipantRole(StrEnum):
    WITNESS = "witness"
    SUSPECT = "suspect"
    INJURED_PARTY = "injured_party"
    EXPERT = "expert"
    OTHER = "other"


class SessionStatus(StrEnum):
    ACTIVE = "active"
    PAUSED = "paused"
    CLOSED = "closed"


class SessionEventType(StrEnum):
    SESSION_STARTED = "session_started"
    QUESTION_SELECTED = "question_selected"
    ANSWER_ADDED = "answer_added"
    NOTE_ADDED = "note_added"
    ROLE_CHANGED = "role_changed"


@dataclass(frozen=True)
class RoleAssignment:
    participant_id: str
    role: ParticipantRole
    assigned_at: datetime = field(default_factory=utc_now)
    reason: str = ""


@dataclass(frozen=True)
class LiveNote:
    id: str
    actor: Actor
    text: str
    linked_question_id: str | None = None
    topic_ids: tuple[str, ...] = ()
    created_at: datetime = field(default_factory=utc_now)


@dataclass(frozen=True)
class SessionEvent:
    id: str
    event_type: SessionEventType
    actor: Actor
    timestamp: datetime = field(default_factory=utc_now)
    details: dict[str, object] = field(default_factory=dict)


@dataclass(frozen=True)
class InterviewSession:
    id: str
    case_id: str
    participant_id: str
    role_history: tuple[RoleAssignment, ...]
    current_question_id: str | None = None
    answers: tuple[Answer, ...] = ()
    notes: tuple[LiveNote, ...] = ()
    events: tuple[SessionEvent, ...] = ()
    status: SessionStatus = SessionStatus.ACTIVE
    started_at: datetime = field(default_factory=utc_now)

    @property
    def current_role(self) -> ParticipantRole:
        return self.role_history[-1].role


def start_interview_session(
    *,
    session_id: str,
    case_id: str,
    participant_id: str,
    initial_role: ParticipantRole,
    event_id: str = "event-session-started",
    timestamp: datetime | None = None,
) -> InterviewSession:
    """Create a new live interview session."""

    effective_timestamp = timestamp or utc_now()
    role_assignment = RoleAssignment(
        participant_id=participant_id,
        role=initial_role,
        assigned_at=effective_timestamp,
        reason="Initial role",
    )
    event = SessionEvent(
        id=event_id,
        event_type=SessionEventType.SESSION_STARTED,
        actor=Actor.SYSTEM,
        timestamp=effective_timestamp,
        details={"participant_id": participant_id, "initial_role": initial_role.value},
    )

    return InterviewSession(
        id=session_id,
        case_id=case_id,
        participant_id=participant_id,
        role_history=(role_assignment,),
        events=(event,),
        started_at=effective_timestamp,
    )


def select_question(
    session: InterviewSession,
    *,
    question_id: str,
    event_id: str,
    actor: Actor = Actor.HUMAN,
    timestamp: datetime | None = None,
) -> InterviewSession:
    """Set the current live question."""

    event = SessionEvent(
        id=event_id,
        event_type=SessionEventType.QUESTION_SELECTED,
        actor=actor,
        timestamp=timestamp or utc_now(),
        details={"question_id": question_id},
    )

    return replace(
        session,
        current_question_id=question_id,
        events=(*session.events, event),
    )


def add_answer(
    session: InterviewSession,
    *,
    answer: Answer,
    event_id: str,
    actor: Actor = Actor.HUMAN,
    timestamp: datetime | None = None,
) -> InterviewSession:
    """Append an answer recorded during the live session."""

    event = SessionEvent(
        id=event_id,
        event_type=SessionEventType.ANSWER_ADDED,
        actor=actor,
        timestamp=timestamp or utc_now(),
        details={"answer_id": answer.id, "question_id": answer.question_id},
    )

    return replace(
        session,
        answers=(*session.answers, answer),
        events=(*session.events, event),
    )


def add_note(
    session: InterviewSession,
    *,
    note: LiveNote,
    event_id: str,
    actor: Actor = Actor.HUMAN,
    timestamp: datetime | None = None,
) -> InterviewSession:
    """Append a live note without treating it as an answer."""

    event = SessionEvent(
        id=event_id,
        event_type=SessionEventType.NOTE_ADDED,
        actor=actor,
        timestamp=timestamp or utc_now(),
        details={"note_id": note.id, "linked_question_id": note.linked_question_id},
    )

    return replace(
        session,
        notes=(*session.notes, note),
        events=(*session.events, event),
    )


def change_participant_role(
    session: InterviewSession,
    *,
    new_role: ParticipantRole,
    event_id: str,
    reason: str,
    actor: Actor = Actor.HUMAN,
    timestamp: datetime | None = None,
) -> InterviewSession:
    """Record a procedural role change without losing role history."""

    effective_timestamp = timestamp or utc_now()
    role_assignment = RoleAssignment(
        participant_id=session.participant_id,
        role=new_role,
        assigned_at=effective_timestamp,
        reason=reason,
    )
    event = SessionEvent(
        id=event_id,
        event_type=SessionEventType.ROLE_CHANGED,
        actor=actor,
        timestamp=effective_timestamp,
        details={"new_role": new_role.value, "reason": reason},
    )

    return replace(
        session,
        role_history=(*session.role_history, role_assignment),
        events=(*session.events, event),
    )


def merge_session_answers(case: Case, session: InterviewSession) -> Case:
    """Return a case view that includes live-session answers."""

    return replace(case, answers=(*case.answers, *session.answers))
