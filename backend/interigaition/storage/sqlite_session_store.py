"""SQLite-backed local storage for live interview sessions."""

from __future__ import annotations

import json
import sqlite3
import threading
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from interigaition.domain.models import Actor, Answer, AuditEvent, Claim
from interigaition.domain.session import (
    InterviewSession,
    LiveNote,
    ParticipantRole,
    RoleAssignment,
    SessionEvent,
    SessionEventType,
    SessionStatus,
)
from interigaition.security.audit_chain import create_audit_event, verify_hash_chain


class SQLiteSessionStore:
    """Persist sessions and append-only audit events in SQLite."""

    def __init__(self, database_path: Path | str) -> None:
        self.database_path = database_path
        self._lock = threading.RLock()
        self._connection = _connect(database_path)
        self._initialize_schema()

    @classmethod
    def in_memory(cls) -> SQLiteSessionStore:
        return cls(":memory:")

    def create_session(self, session: InterviewSession) -> InterviewSession:
        with self._lock, self._connection:
            self._insert_session(session)
        return session

    def get_session(self, session_id: str) -> InterviewSession | None:
        with self._lock:
            row = self._connection.execute(
                """
                SELECT id, case_id, participant_id, current_question_id, status, started_at
                FROM sessions
                WHERE id = ?
                """,
                (session_id,),
            ).fetchone()
            if row is None:
                return None

            return InterviewSession(
                id=row["id"],
                case_id=row["case_id"],
                participant_id=row["participant_id"],
                role_history=self._load_role_history(session_id),
                current_question_id=row["current_question_id"],
                answers=self._load_answers(session_id),
                notes=self._load_notes(session_id),
                events=self._load_session_events(session_id),
                status=SessionStatus(row["status"]),
                started_at=_parse_datetime(row["started_at"]),
            )

    def save_session(self, session: InterviewSession) -> InterviewSession:
        with self._lock, self._connection:
            self._delete_session_children(session.id)
            self._connection.execute(
                """
                UPDATE sessions
                SET case_id = ?,
                    participant_id = ?,
                    current_question_id = ?,
                    status = ?,
                    started_at = ?
                WHERE id = ?
                """,
                (
                    session.case_id,
                    session.participant_id,
                    session.current_question_id,
                    session.status.value,
                    session.started_at.isoformat(),
                    session.id,
                ),
            )
            self._insert_session_children(session)
        return session

    def append_audit_event(
        self,
        *,
        actor: Actor,
        action: str,
        object_type: str,
        object_id: str,
        details: dict[str, object] | None = None,
    ) -> AuditEvent:
        with self._lock, self._connection:
            previous_hash = self._latest_audit_hash()
            event = create_audit_event(
                event_id=f"audit-{uuid.uuid4()}",
                actor=actor,
                action=action,
                object_type=object_type,
                object_id=object_id,
                details=details,
                previous_hash=previous_hash,
            )
            self._connection.execute(
                """
                INSERT INTO audit_events (
                    id, timestamp, actor, action, object_type, object_id,
                    details_json, previous_hash, event_hash
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    event.id,
                    event.timestamp.isoformat(),
                    event.actor.value,
                    event.action,
                    event.object_type,
                    event.object_id,
                    _json_dumps(event.details),
                    event.previous_hash,
                    event.event_hash,
                ),
            )
            return event

    def list_audit_events(self) -> tuple[AuditEvent, ...]:
        with self._lock:
            rows = self._connection.execute(
                """
                SELECT id, timestamp, actor, action, object_type, object_id,
                       details_json, previous_hash, event_hash
                FROM audit_events
                ORDER BY sequence ASC
                """
            ).fetchall()
            return tuple(_audit_event_from_row(row) for row in rows)

    def verify_audit_chain(self) -> bool:
        return verify_hash_chain(self.list_audit_events())

    def close(self) -> None:
        with self._lock:
            self._connection.close()

    def __del__(self) -> None:
        try:
            self._connection.close()
        except Exception:
            pass

    def _initialize_schema(self) -> None:
        with self._lock, self._connection:
            self._connection.executescript(
                """
                PRAGMA foreign_keys = ON;

                CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY,
                    case_id TEXT NOT NULL,
                    participant_id TEXT NOT NULL,
                    current_question_id TEXT,
                    status TEXT NOT NULL,
                    started_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS role_assignments (
                    session_id TEXT NOT NULL,
                    ordinal INTEGER NOT NULL,
                    participant_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    assigned_at TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    PRIMARY KEY (session_id, ordinal),
                    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS answers (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    ordinal INTEGER NOT NULL,
                    question_id TEXT NOT NULL,
                    text TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS answer_topics (
                    answer_id TEXT NOT NULL,
                    ordinal INTEGER NOT NULL,
                    topic_id TEXT NOT NULL,
                    PRIMARY KEY (answer_id, ordinal),
                    FOREIGN KEY (answer_id) REFERENCES answers(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS claims (
                    id TEXT PRIMARY KEY,
                    answer_id TEXT NOT NULL,
                    ordinal INTEGER NOT NULL,
                    subject TEXT NOT NULL,
                    attribute TEXT NOT NULL,
                    value TEXT NOT NULL,
                    source_text TEXT NOT NULL,
                    FOREIGN KEY (answer_id) REFERENCES answers(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS live_notes (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    ordinal INTEGER NOT NULL,
                    actor TEXT NOT NULL,
                    text TEXT NOT NULL,
                    linked_question_id TEXT,
                    topic_ids_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS session_events (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    ordinal INTEGER NOT NULL,
                    event_type TEXT NOT NULL,
                    actor TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    details_json TEXT NOT NULL,
                    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS audit_events (
                    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
                    id TEXT NOT NULL UNIQUE,
                    timestamp TEXT NOT NULL,
                    actor TEXT NOT NULL,
                    action TEXT NOT NULL,
                    object_type TEXT NOT NULL,
                    object_id TEXT NOT NULL,
                    details_json TEXT NOT NULL,
                    previous_hash TEXT,
                    event_hash TEXT NOT NULL UNIQUE
                );

                CREATE TRIGGER IF NOT EXISTS audit_events_no_update
                BEFORE UPDATE ON audit_events
                BEGIN
                    SELECT RAISE(ABORT, 'audit log is append-only');
                END;

                CREATE TRIGGER IF NOT EXISTS audit_events_no_delete
                BEFORE DELETE ON audit_events
                BEGIN
                    SELECT RAISE(ABORT, 'audit log is append-only');
                END;
                """
            )

    def _insert_session(self, session: InterviewSession) -> None:
        self._connection.execute(
            """
            INSERT INTO sessions (
                id, case_id, participant_id, current_question_id, status, started_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                session.id,
                session.case_id,
                session.participant_id,
                session.current_question_id,
                session.status.value,
                session.started_at.isoformat(),
            ),
        )
        self._insert_session_children(session)

    def _insert_session_children(self, session: InterviewSession) -> None:
        for ordinal, role in enumerate(session.role_history):
            self._connection.execute(
                """
                INSERT INTO role_assignments (
                    session_id, ordinal, participant_id, role, assigned_at, reason
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    session.id,
                    ordinal,
                    role.participant_id,
                    role.role.value,
                    role.assigned_at.isoformat(),
                    role.reason,
                ),
            )

        for ordinal, answer in enumerate(session.answers):
            self._connection.execute(
                """
                INSERT INTO answers (id, session_id, ordinal, question_id, text, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    answer.id,
                    session.id,
                    ordinal,
                    answer.question_id,
                    answer.text,
                    answer.created_at.isoformat(),
                ),
            )
            for topic_ordinal, topic_id in enumerate(answer.topic_ids):
                self._connection.execute(
                    """
                    INSERT INTO answer_topics (answer_id, ordinal, topic_id)
                    VALUES (?, ?, ?)
                    """,
                    (answer.id, topic_ordinal, topic_id),
                )
            for claim_ordinal, claim in enumerate(answer.claims):
                self._connection.execute(
                    """
                    INSERT INTO claims (
                        id, answer_id, ordinal, subject, attribute, value, source_text
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        claim.id,
                        answer.id,
                        claim_ordinal,
                        claim.subject,
                        claim.attribute,
                        claim.value,
                        claim.source_text,
                    ),
                )

        for ordinal, note in enumerate(session.notes):
            self._connection.execute(
                """
                INSERT INTO live_notes (
                    id, session_id, ordinal, actor, text, linked_question_id,
                    topic_ids_json, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    note.id,
                    session.id,
                    ordinal,
                    note.actor.value,
                    note.text,
                    note.linked_question_id,
                    _json_dumps(note.topic_ids),
                    note.created_at.isoformat(),
                ),
            )

        for ordinal, event in enumerate(session.events):
            self._connection.execute(
                """
                INSERT INTO session_events (
                    id, session_id, ordinal, event_type, actor, timestamp, details_json
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    event.id,
                    session.id,
                    ordinal,
                    event.event_type.value,
                    event.actor.value,
                    event.timestamp.isoformat(),
                    _json_dumps(event.details),
                ),
            )

    def _delete_session_children(self, session_id: str) -> None:
        for table in ("session_events", "live_notes", "answers", "role_assignments"):
            self._connection.execute(f"DELETE FROM {table} WHERE session_id = ?", (session_id,))

    def _load_role_history(self, session_id: str) -> tuple[RoleAssignment, ...]:
        rows = self._connection.execute(
            """
            SELECT participant_id, role, assigned_at, reason
            FROM role_assignments
            WHERE session_id = ?
            ORDER BY ordinal ASC
            """,
            (session_id,),
        ).fetchall()
        return tuple(
            RoleAssignment(
                participant_id=row["participant_id"],
                role=ParticipantRole(row["role"]),
                assigned_at=_parse_datetime(row["assigned_at"]),
                reason=row["reason"],
            )
            for row in rows
        )

    def _load_answers(self, session_id: str) -> tuple[Answer, ...]:
        rows = self._connection.execute(
            """
            SELECT id, question_id, text, created_at
            FROM answers
            WHERE session_id = ?
            ORDER BY ordinal ASC
            """,
            (session_id,),
        ).fetchall()
        return tuple(
            Answer(
                id=row["id"],
                question_id=row["question_id"],
                text=row["text"],
                topic_ids=self._load_answer_topics(row["id"]),
                claims=self._load_claims(row["id"]),
                created_at=_parse_datetime(row["created_at"]),
            )
            for row in rows
        )

    def _load_answer_topics(self, answer_id: str) -> tuple[str, ...]:
        rows = self._connection.execute(
            """
            SELECT topic_id
            FROM answer_topics
            WHERE answer_id = ?
            ORDER BY ordinal ASC
            """,
            (answer_id,),
        ).fetchall()
        return tuple(row["topic_id"] for row in rows)

    def _load_claims(self, answer_id: str) -> tuple[Claim, ...]:
        rows = self._connection.execute(
            """
            SELECT id, subject, attribute, value, source_text
            FROM claims
            WHERE answer_id = ?
            ORDER BY ordinal ASC
            """,
            (answer_id,),
        ).fetchall()
        return tuple(
            Claim(
                id=row["id"],
                subject=row["subject"],
                attribute=row["attribute"],
                value=row["value"],
                source_text=row["source_text"],
            )
            for row in rows
        )

    def _load_notes(self, session_id: str) -> tuple[LiveNote, ...]:
        rows = self._connection.execute(
            """
            SELECT id, actor, text, linked_question_id, topic_ids_json, created_at
            FROM live_notes
            WHERE session_id = ?
            ORDER BY ordinal ASC
            """,
            (session_id,),
        ).fetchall()
        return tuple(
            LiveNote(
                id=row["id"],
                actor=Actor(row["actor"]),
                text=row["text"],
                linked_question_id=row["linked_question_id"],
                topic_ids=tuple(json.loads(row["topic_ids_json"])),
                created_at=_parse_datetime(row["created_at"]),
            )
            for row in rows
        )

    def _load_session_events(self, session_id: str) -> tuple[SessionEvent, ...]:
        rows = self._connection.execute(
            """
            SELECT id, event_type, actor, timestamp, details_json
            FROM session_events
            WHERE session_id = ?
            ORDER BY ordinal ASC
            """,
            (session_id,),
        ).fetchall()
        return tuple(
            SessionEvent(
                id=row["id"],
                event_type=SessionEventType(row["event_type"]),
                actor=Actor(row["actor"]),
                timestamp=_parse_datetime(row["timestamp"]),
                details=json.loads(row["details_json"]),
            )
            for row in rows
        )

    def _latest_audit_hash(self) -> str | None:
        row = self._connection.execute(
            """
            SELECT event_hash
            FROM audit_events
            ORDER BY sequence DESC
            LIMIT 1
            """
        ).fetchone()
        if row is None:
            return None
        return row["event_hash"]


def _connect(database_path: Path | str) -> sqlite3.Connection:
    if database_path != ":memory:":
        parent = Path(database_path).parent
        if not parent.exists():
            parent.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(database_path, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def _audit_event_from_row(row: sqlite3.Row) -> AuditEvent:
    return AuditEvent(
        id=row["id"],
        timestamp=_parse_datetime(row["timestamp"]),
        actor=Actor(row["actor"]),
        action=row["action"],
        object_type=row["object_type"],
        object_id=row["object_id"],
        details=json.loads(row["details_json"]),
        previous_hash=row["previous_hash"],
        event_hash=row["event_hash"],
    )


def _parse_datetime(value: str) -> datetime:
    return datetime.fromisoformat(value)


def _json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)
