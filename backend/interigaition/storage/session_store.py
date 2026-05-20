"""Session storage contracts for local interview sessions."""

from __future__ import annotations

from typing import Protocol

from interigaition.domain.models import Actor, AuditEvent
from interigaition.domain.session import InterviewSession


class SessionStore(Protocol):
    """Persistence boundary for live interview sessions and audit records."""

    def create_session(self, session: InterviewSession) -> InterviewSession:
        """Persist a new session."""

    def get_session(self, session_id: str) -> InterviewSession | None:
        """Return a session by id."""

    def save_session(self, session: InterviewSession) -> InterviewSession:
        """Persist a complete replacement of an existing session."""

    def append_audit_event(
        self,
        *,
        actor: Actor,
        action: str,
        object_type: str,
        object_id: str,
        details: dict[str, object] | None = None,
    ) -> AuditEvent:
        """Append a hash-chained audit record."""

    def list_audit_events(self) -> tuple[AuditEvent, ...]:
        """Return audit records in chain order."""

    def verify_audit_chain(self) -> bool:
        """Return whether the audit chain is intact."""
