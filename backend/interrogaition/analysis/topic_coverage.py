"""Topic coverage helpers."""

from __future__ import annotations

from interrogaition.domain.models import Answer, Question, Topic


def covered_topic_ids(questions: list[Question], answers: list[Answer]) -> set[str]:
    """Return topic ids touched by questions or answers."""

    covered: set[str] = set()

    for question in questions:
        covered.update(question.topic_ids)

    for answer in answers:
        covered.update(answer.topic_ids)

    return covered


def missing_topics(topics: list[Topic], questions: list[Question], answers: list[Answer]) -> list[Topic]:
    """Return topics not yet covered by questions or answers."""

    covered = covered_topic_ids(questions, answers)
    return [topic for topic in topics if topic.id not in covered]

