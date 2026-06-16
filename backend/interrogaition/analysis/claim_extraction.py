"""Deterministic first-pass claim extraction for live answers.

This module extracts a small set of auditable structured claims from live
answer text. It is intentionally conservative: claims are observations for
review, not truthfulness, guilt, or psychological assessments.
"""

from __future__ import annotations

import re
import unicodedata

from interrogaition.domain.models import Answer, Case, Claim, Question


_TIME_RE = re.compile(r"\b(?:[01]?\d|2[0-3])[:.][0-5]\d\b")
_POLISH_TRANSLATION = str.maketrans(
    {
        "\u0105": "a",
        "\u0107": "c",
        "\u0119": "e",
        "\u0142": "l",
        "\u0144": "n",
        "\u00f3": "o",
        "\u015b": "s",
        "\u017a": "z",
        "\u017c": "z",
        "\u0104": "A",
        "\u0106": "C",
        "\u0118": "E",
        "\u0141": "L",
        "\u0143": "N",
        "\u00d3": "O",
        "\u015a": "S",
        "\u0179": "Z",
        "\u017b": "Z",
    }
)


def extract_live_answer_claims(
    *,
    case: Case,
    question: Question,
    answer_id: str,
    answer_text: str,
) -> tuple[Claim, ...]:
    """Extract deterministic claims from a live answer."""

    claims: list[Claim] = []
    normalized_text = _normalize(answer_text)

    for value in _time_values(answer_text):
        claims.append(
            _claim(
                answer_id=answer_id,
                ordinal=len(claims) + 1,
                subject=_time_subject(case, question, normalized_text),
                attribute=_time_attribute(case, question, normalized_text),
                value=value,
                source_text=_source_sentence(answer_text, value),
            )
        )

    for value, marker in _key_holder_values(answer_text):
        claims.append(
            _claim(
                answer_id=answer_id,
                ordinal=len(claims) + 1,
                subject="medication_cabinet",
                attribute="key_holder",
                value=value,
                source_text=_source_sentence(answer_text, marker),
            )
        )

    door_status = _service_door_status(normalized_text)
    if door_status:
        claims.append(
            _claim(
                answer_id=answer_id,
                ordinal=len(claims) + 1,
                subject="service_door",
                attribute="status",
                value=door_status,
                source_text=answer_text.strip(),
            )
        )

    source_of_knowledge = _source_of_knowledge(normalized_text)
    if source_of_knowledge:
        claims.append(
            _claim(
                answer_id=answer_id,
                ordinal=len(claims) + 1,
                subject=_source_subject(case, question),
                attribute="source_of_knowledge",
                value=source_of_knowledge,
                source_text=answer_text.strip(),
            )
        )

    return tuple(claims)


def answer_with_extracted_claims(case: Case, answer: Answer) -> Answer:
    """Return an answer enriched with extracted claims when none were supplied."""

    if answer.claims:
        return answer

    question = next((item for item in case.questions if item.id == answer.question_id), None)
    if question is None:
        return answer

    return Answer(
        id=answer.id,
        question_id=answer.question_id,
        text=answer.text,
        topic_ids=answer.topic_ids,
        claims=extract_live_answer_claims(
            case=case,
            question=question,
            answer_id=answer.id,
            answer_text=answer.text,
        ),
        created_at=answer.created_at,
    )


def _claim(
    *,
    answer_id: str,
    ordinal: int,
    subject: str,
    attribute: str,
    value: str,
    source_text: str,
) -> Claim:
    return Claim(
        id=f"{answer_id}-claim-{ordinal:02d}",
        subject=subject,
        attribute=attribute,
        value=value,
        source_text=source_text,
    )


def _time_values(text: str) -> tuple[str, ...]:
    return tuple(match.group(0).replace(".", ":") for match in _TIME_RE.finditer(text))


def _time_subject(case: Case, question: Question, normalized_text: str) -> str:
    question_topic_ids = set(question.topic_ids)
    topic_labels = " ".join(
        topic.label.lower()
        for topic in case.topics
        if topic.id in question_topic_ids
    )
    if "medication" in topic_labels or "lek" in topic_labels or "daw" in normalized_text:
        return "missing_dose"
    if "alarm" in topic_labels or "alarm" in normalized_text:
        return "alarm"
    return "event"


def _time_attribute(case: Case, question: Question, normalized_text: str) -> str:
    subject = _time_subject(case, question, normalized_text)
    if subject == "missing_dose":
        return "discovery_time"
    return "time"


def _key_holder_values(text: str) -> tuple[tuple[str, str], ...]:
    normalized = _normalize(text)
    values: list[tuple[str, str]] = []
    if any(marker in normalized for marker in ("supervisor", "przelozon", "kierownik")):
        values.append(("supervisor", "supervisor"))
    if any(marker in normalized for marker in ("own key", "my key", "wlasn", "uzylem")):
        values.append(("witness", "key"))
    return tuple(values)


def _service_door_status(normalized_text: str) -> str | None:
    if "service door" not in normalized_text and "drzwi serwis" not in normalized_text:
        return None
    if any(marker in normalized_text for marker in ("locked", "zamkn")):
        return "locked"
    if any(marker in normalized_text for marker in ("open", "otwart")):
        return "open"
    return None


def _source_of_knowledge(normalized_text: str) -> str | None:
    direct = any(
        marker in normalized_text
        for marker in ("own observation", "direct observation", "saw", "widzial", "osobiscie")
    )
    documentation = any(
        marker in normalized_text
        for marker in ("documentation", "document", "log", "recording", "camera", "dokument", "nagran", "monitoring")
    )
    if direct and documentation:
        return "direct observation and documentation"
    if direct:
        return "direct observation"
    if documentation:
        return "documentation"
    return None


def _source_subject(case: Case, question: Question) -> str:
    if any(topic_id.startswith("topic-care") for topic_id in question.topic_ids) or case.id == "case-003":
        return "worker"
    return "witness"


def _source_sentence(text: str, marker: str) -> str:
    for sentence in re.split(r"(?<=[.!?])\s+", text.strip()):
        if marker.lower() in sentence.lower():
            return sentence.strip()
    return text.strip()


def _normalize(value: str) -> str:
    normalized = value.translate(_POLISH_TRANSLATION)
    normalized = unicodedata.normalize("NFKD", normalized)
    normalized = normalized.encode("ascii", "ignore").decode("ascii")
    return " ".join(normalized.casefold().strip().split())
