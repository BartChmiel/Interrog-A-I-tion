"""Prompt rendering helpers."""

from __future__ import annotations

import json
from dataclasses import asdict, is_dataclass
from pathlib import Path
from typing import Any

from interigaition.domain.models import Case


PROJECT_ROOT = Path(__file__).resolve().parents[3]
PROMPTS_ROOT = PROJECT_ROOT / "prompts"


def load_system_prompt(name: str, prompts_root: Path | None = None) -> str:
    root = prompts_root or PROMPTS_ROOT
    return (root / name).read_text(encoding="utf-8").strip()


def render_followup_user_prompt(case: Case) -> str:
    """Render a compact JSON context for follow-up suggestions."""

    payload = {
        "task": "suggest_followup_questions",
        "case": {
            "id": case.id,
            "title": case.title,
            "topics": [
                {
                    "id": topic.id,
                    "label": topic.label,
                    "priority": topic.priority.value,
                }
                for topic in case.topics
            ],
            "questions": [
                {
                    "id": question.id,
                    "text": question.text,
                    "type": question.question_type.value,
                    "topic_ids": list(question.topic_ids),
                }
                for question in case.questions
            ],
            "answers": [
                {
                    "id": answer.id,
                    "question_id": answer.question_id,
                    "text": answer.text,
                    "topic_ids": list(answer.topic_ids),
                    "claims": [_to_jsonable(claim) for claim in answer.claims],
                }
                for answer in case.answers
            ],
        },
    }

    return json.dumps(payload, ensure_ascii=False, indent=2)


def _to_jsonable(value: Any) -> Any:
    if is_dataclass(value):
        return asdict(value)

    return value

