"""Load synthetic case files from JSON."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from interrogaition.domain.models import (
    Answer,
    Case,
    Claim,
    Priority,
    Question,
    QuestionSource,
    QuestionType,
    Topic,
)
from interrogaition.i18n.localization import normalize_locale


def load_case_from_json(path: Path, locale: str = "en") -> Case:
    """Load a case JSON file into domain models."""

    data = json.loads(path.read_text(encoding="utf-8"))
    normalized_locale = normalize_locale(locale)

    topics = tuple(_load_topic(item, normalized_locale) for item in data.get("topics", []))
    questions = tuple(_load_question(item) for item in data.get("questions", []))
    answers = tuple(_load_answer(item) for item in data.get("answers", []))

    created_at = _parse_datetime(data.get("created_at"))

    return Case(
        id=data["id"],
        title=_localized_value(data, "title", normalized_locale),
        description=_localized_value(data, "description", normalized_locale),
        topics=topics,
        questions=questions,
        answers=answers,
        created_at=created_at,
    )


def _load_topic(data: dict[str, Any], locale: str) -> Topic:
    return Topic(
        id=data["id"],
        label=_localized_value(data, "label", locale),
        description=_localized_value(data, "description", locale),
        priority=Priority(data.get("priority", Priority.MEDIUM.value)),
    )


def _load_question(data: dict[str, Any]) -> Question:
    return Question(
        id=data["id"],
        text=data["text"],
        source=QuestionSource(data.get("source", QuestionSource.HUMAN.value)),
        question_type=QuestionType(data["question_type"]),
        topic_ids=tuple(data.get("topic_ids", [])),
        rationale=data.get("rationale", ""),
    )


def _load_answer(data: dict[str, Any]) -> Answer:
    return Answer(
        id=data["id"],
        question_id=data["question_id"],
        text=data["text"],
        topic_ids=tuple(data.get("topic_ids", [])),
        claims=tuple(_load_claim(item) for item in data.get("claims", [])),
        created_at=_parse_datetime(data.get("created_at")),
    )


def _load_claim(data: dict[str, Any]) -> Claim:
    return Claim(
        id=data["id"],
        subject=data["subject"],
        attribute=data["attribute"],
        value=data["value"],
        source_text=data.get("source_text", ""),
    )


def _parse_datetime(value: str | None) -> datetime:
    if not value:
        return datetime.now(UTC)

    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _localized_value(data: dict[str, Any], key: str, locale: str) -> str:
    localized = data.get(f"{key}_i18n", {})
    if isinstance(localized, dict):
        value = localized.get(locale) or localized.get("en")
        if value is not None:
            return str(value)

    return str(data.get(key, ""))
