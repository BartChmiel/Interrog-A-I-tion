"""Local user-created case registry.

The synthetic fixtures remain immutable repository data. This registry stores
operator-created prototype cases under local-data so they can use the same
analysis, workspace, material, and grounded-AI pipeline.
"""

from __future__ import annotations

import json
import re
import unicodedata
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from interrogaition.domain.session import ParticipantRole
from interrogaition.storage.json_case_loader import load_case_from_json


LOCAL_CASE_SCHEMA_VERSION = 1
_SAFE_ID_RE = re.compile(r"[^a-z0-9_.-]+")


class LocalCaseRegistryError(ValueError):
    """Raised when a local case cannot be created or loaded safely."""


@dataclass(frozen=True)
class LocalCaseParticipant:
    id: str
    name: str
    role: ParticipantRole
    notes: str = ""
    created_at: datetime | None = None


@dataclass(frozen=True)
class CreatedLocalCase:
    case_id: str
    participant_id: str


class LocalCaseRegistry:
    def __init__(self, root_path: Path | str) -> None:
        self.root_path = Path(root_path).resolve()

    def case_exists(self, case_id: str) -> bool:
        return self._case_path(case_id).exists()

    def create_case(
        self,
        *,
        title: str,
        description: str = "",
        participant_name: str = "",
        created_by: str = "local-ui",
        locale: str = "pl",
        case_id: str | None = None,
    ) -> CreatedLocalCase:
        title = title.strip()
        if not title:
            raise LocalCaseRegistryError("Case title is required.")

        effective_case_id = case_id or _make_case_id(title)
        self._require_safe_identifier(effective_case_id)
        case_root = self._case_root(effective_case_id)
        if case_root.exists():
            raise LocalCaseRegistryError(f"Case already exists: {effective_case_id}.")

        now = datetime.now(UTC)
        participant = _participant_record(
            name=participant_name or _default_participant_name(locale),
            role=ParticipantRole.WITNESS,
            notes="Initial participant created with the local case.",
        )
        case_payload = _case_payload(
            case_id=effective_case_id,
            title=title,
            description=description.strip(),
            created_at=now,
            created_by=created_by,
            participant=participant,
            locale=locale,
        )
        case_root.mkdir(parents=True, exist_ok=False)
        self._write_case_payload(effective_case_id, case_payload)
        return CreatedLocalCase(
            case_id=effective_case_id,
            participant_id=str(participant["id"]),
        )

    def load_case(self, case_id: str, *, locale: str = "en"):
        path = self._case_path(case_id)
        if not path.exists():
            raise LocalCaseRegistryError(f"Local case not found: {case_id}.")
        return load_case_from_json(path, locale=locale)

    def list_cases(self, *, locale: str = "en"):
        cases = []
        for path in sorted(self.root_path.glob("*/case.json")):
            try:
                cases.append(load_case_from_json(path, locale=locale))
            except Exception:
                continue
        return tuple(cases)

    def list_participants(self, case_id: str) -> tuple[LocalCaseParticipant, ...]:
        payload = self._read_case_payload(case_id)
        return tuple(_participant_from_payload(item) for item in payload.get("participants", []))

    def add_participant(
        self,
        case_id: str,
        *,
        name: str,
        role: ParticipantRole = ParticipantRole.WITNESS,
        notes: str = "",
    ) -> LocalCaseParticipant:
        payload = self._read_case_payload(case_id)
        name = name.strip()
        if not name:
            raise LocalCaseRegistryError("Participant name is required.")

        participant = _participant_record(name=name, role=role, notes=notes.strip())
        payload.setdefault("participants", []).append(participant)
        self._write_case_payload(case_id, payload)
        return _participant_from_payload(participant)

    def _read_case_payload(self, case_id: str) -> dict[str, Any]:
        path = self._case_path(case_id)
        if not path.exists():
            raise LocalCaseRegistryError(f"Local case not found: {case_id}.")
        payload = json.loads(path.read_text(encoding="utf-8"))
        if payload.get("schema_version") != LOCAL_CASE_SCHEMA_VERSION:
            raise LocalCaseRegistryError("Unsupported local case schema version.")
        return payload

    def _write_case_payload(self, case_id: str, payload: dict[str, Any]) -> None:
        case_root = self._case_root(case_id)
        case_root.mkdir(parents=True, exist_ok=True)
        self._case_path(case_id).write_text(
            json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True),
            encoding="utf-8",
        )

    def _case_root(self, case_id: str) -> Path:
        self._require_safe_identifier(case_id)
        root = (self.root_path / case_id).resolve()
        self._require_inside_root(root)
        return root

    def _case_path(self, case_id: str) -> Path:
        return self._case_root(case_id) / "case.json"

    def _require_safe_identifier(self, value: str) -> None:
        if not value or value.startswith(".") or "/" in value or "\\" in value:
            raise LocalCaseRegistryError("Case id is not a safe identifier.")
        if _SAFE_ID_RE.search(value):
            raise LocalCaseRegistryError("Case id is not a safe identifier.")

    def _require_inside_root(self, path: Path) -> None:
        root = self.root_path.resolve()
        target = path.resolve()
        if target != root and root not in target.parents:
            raise LocalCaseRegistryError("Case path escaped registry root.")


def _case_payload(
    *,
    case_id: str,
    title: str,
    description: str,
    created_at: datetime,
    created_by: str,
    participant: dict[str, Any],
    locale: str,
) -> dict[str, Any]:
    return {
        "schema_version": LOCAL_CASE_SCHEMA_VERSION,
        "id": case_id,
        "title": title,
        "description": description,
        "created_at": created_at.isoformat(),
        "created_by": created_by,
        "source": "local",
        "participants": [participant],
        "topics": _default_topics(locale),
        "questions": _default_questions(locale),
        "answers": [],
    }


def _default_topics(locale: str) -> list[dict[str, str]]:
    if locale == "pl":
        return [
            {
                "id": "topic-scope",
                "label": "Zakres sprawy",
                "description": "Podstawowy opis zdarzenia, miejsca i kontekstu.",
                "priority": "high",
            },
            {
                "id": "topic-chronology",
                "label": "Chronologia",
                "description": "Kolejność zdarzeń, czas i punkty zwrotne.",
                "priority": "high",
            },
            {
                "id": "topic-people",
                "label": "Osoby i role",
                "description": "Uczestnicy, świadkowie, role i relacje.",
                "priority": "high",
            },
            {
                "id": "topic-materials",
                "label": "Materiały i źródła",
                "description": "Dokumenty, notatki, zapisy oraz źródła wiedzy.",
                "priority": "medium",
            },
            {
                "id": "topic-open-questions",
                "label": "Luki do wyjaśnienia",
                "description": "Niewiadome, sprzeczności i punkty wymagające doprecyzowania.",
                "priority": "medium",
            },
        ]

    return [
        {
            "id": "topic-scope",
            "label": "Case scope",
            "description": "Basic event, place, and context description.",
            "priority": "high",
        },
        {
            "id": "topic-chronology",
            "label": "Timeline",
            "description": "Event order, timing, and turning points.",
            "priority": "high",
        },
        {
            "id": "topic-people",
            "label": "People and roles",
            "description": "Participants, witnesses, roles, and relationships.",
            "priority": "high",
        },
        {
            "id": "topic-materials",
            "label": "Materials and sources",
            "description": "Documents, notes, records, and sources of knowledge.",
            "priority": "medium",
        },
        {
            "id": "topic-open-questions",
            "label": "Open questions",
            "description": "Unknowns, inconsistencies, and points requiring clarification.",
            "priority": "medium",
        },
    ]


def _default_questions(locale: str) -> list[dict[str, Any]]:
    if locale == "pl":
        return [
            {
                "id": "q-001",
                "text": "Proszę opisać sprawę własnymi słowami od początku.",
                "source": "human",
                "question_type": "open",
                "topic_ids": ["topic-scope"],
            },
            {
                "id": "q-002",
                "text": "Co wydarzyło się po kolei i kiedy zauważono najważniejsze momenty?",
                "source": "human",
                "question_type": "chronological",
                "topic_ids": ["topic-chronology"],
            },
            {
                "id": "q-003",
                "text": "Kto był zaangażowany albo mógł mieć wiedzę o tej sprawie?",
                "source": "human",
                "question_type": "clarifying",
                "topic_ids": ["topic-people"],
            },
            {
                "id": "q-004",
                "text": "Które informacje pochodzą z Pani/Pana obserwacji, a które z materiałów?",
                "source": "human",
                "question_type": "source_of_knowledge",
                "topic_ids": ["topic-materials"],
            },
            {
                "id": "q-005",
                "text": "Co nadal wymaga wyjaśnienia albo sprawdzenia w dostępnych materiałach?",
                "source": "human",
                "question_type": "summary",
                "topic_ids": ["topic-open-questions"],
            },
        ]

    return [
        {
            "id": "q-001",
            "text": "Please describe the case in your own words from the beginning.",
            "source": "human",
            "question_type": "open",
            "topic_ids": ["topic-scope"],
        },
        {
            "id": "q-002",
            "text": "What happened in order, and when were the key moments noticed?",
            "source": "human",
            "question_type": "chronological",
            "topic_ids": ["topic-chronology"],
        },
        {
            "id": "q-003",
            "text": "Who was involved or may have knowledge about this case?",
            "source": "human",
            "question_type": "clarifying",
            "topic_ids": ["topic-people"],
        },
        {
            "id": "q-004",
            "text": "Which information comes from your own observation, and which comes from materials?",
            "source": "human",
            "question_type": "source_of_knowledge",
            "topic_ids": ["topic-materials"],
        },
        {
            "id": "q-005",
            "text": "What still needs to be clarified or checked in the available material?",
            "source": "human",
            "question_type": "summary",
            "topic_ids": ["topic-open-questions"],
        },
    ]


def _participant_record(
    *,
    name: str,
    role: ParticipantRole,
    notes: str,
) -> dict[str, Any]:
    participant_id = f"person-{_slug(name)[:32]}-{uuid.uuid4().hex[:6]}"
    return {
        "id": participant_id,
        "name": name.strip(),
        "role": role.value,
        "notes": notes.strip(),
        "created_at": datetime.now(UTC).isoformat(),
    }


def _participant_from_payload(payload: dict[str, Any]) -> LocalCaseParticipant:
    created_at = payload.get("created_at")
    return LocalCaseParticipant(
        id=str(payload["id"]),
        name=str(payload["name"]),
        role=ParticipantRole(str(payload.get("role", ParticipantRole.WITNESS.value))),
        notes=str(payload.get("notes", "")),
        created_at=(
            datetime.fromisoformat(str(created_at))
            if created_at
            else None
        ),
    )


def _make_case_id(title: str) -> str:
    slug = _slug(title)[:48] or "case"
    return f"case-local-{slug}-{uuid.uuid4().hex[:8]}"


def _slug(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    without_marks = "".join(character for character in normalized if not unicodedata.combining(character))
    lowered = without_marks.lower()
    slug = _SAFE_ID_RE.sub("-", lowered).strip(".-")
    slug = re.sub(r"-{2,}", "-", slug)
    return slug or "item"


def _default_participant_name(locale: str) -> str:
    return "Świadek 1" if locale == "pl" else "Witness 1"
