"""Hash-chain helpers for append-only audit records."""

from __future__ import annotations

import hashlib
import json
from dataclasses import replace
from datetime import UTC, datetime
from typing import Any

from interrogaition.domain.models import Actor, AuditEvent


def utc_now() -> datetime:
    return datetime.now(UTC)


def create_audit_event(
    *,
    event_id: str,
    actor: Actor,
    action: str,
    object_type: str,
    object_id: str,
    details: dict[str, object] | None = None,
    previous_hash: str | None = None,
    timestamp: datetime | None = None,
) -> AuditEvent:
    """Create an audit event and calculate its chain hash."""

    event = AuditEvent(
        id=event_id,
        timestamp=timestamp or utc_now(),
        actor=actor,
        action=action,
        object_type=object_type,
        object_id=object_id,
        details=details or {},
        previous_hash=previous_hash,
    )
    return replace(event, event_hash=event_hash(event))


def event_hash(event: AuditEvent) -> str:
    """Calculate the canonical SHA-256 hash for an audit event."""

    return hashlib.sha256(_event_payload(event).encode("utf-8")).hexdigest()


def verify_hash_chain(events: tuple[AuditEvent, ...]) -> bool:
    """Return whether events form an unbroken hash chain."""

    previous_hash: str | None = None
    for event in events:
        if event.previous_hash != previous_hash:
            return False
        if event.event_hash != event_hash(event):
            return False
        previous_hash = event.event_hash

    return True


def _event_payload(event: AuditEvent) -> str:
    payload: dict[str, Any] = {
        "id": event.id,
        "timestamp": event.timestamp.isoformat(),
        "actor": event.actor.value,
        "action": event.action,
        "object_type": event.object_type,
        "object_id": event.object_id,
        "details": event.details,
        "previous_hash": event.previous_hash,
    }
    return json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
