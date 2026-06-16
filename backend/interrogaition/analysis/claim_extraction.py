"""Deterministic first-pass claim extraction for live answers.

This module extracts a small set of auditable structured claims from live
answer text. It is intentionally conservative: claims are observations for
review, not truthfulness, guilt, or psychological assessments.
"""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import re
import unicodedata

from interrogaition.domain.models import Answer, Case, Claim, ClaimReviewStatus, Question


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


@dataclass(frozen=True)
class _MarkerMatch:
    value: str
    marker: str
    source_start: int | None
    source_end: int | None


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

    for value, source_start, source_end in _time_values(answer_text):
        claims.append(
            _claim(
                answer_id=answer_id,
                case_id=case.id,
                question_id=question.id,
                answer_text=answer_text,
                ordinal=len(claims) + 1,
                subject=_time_subject(case, question, normalized_text),
                attribute=_time_attribute(case, question, normalized_text),
                value=value,
                source_text=_source_sentence(answer_text, value),
                extraction_rule="time-expression.v1",
                confidence=0.86,
                source_start=source_start,
                source_end=source_end,
            )
        )

    for match in _key_holder_values(answer_text):
        claims.append(
            _claim(
                answer_id=answer_id,
                case_id=case.id,
                question_id=question.id,
                answer_text=answer_text,
                ordinal=len(claims) + 1,
                subject="medication_cabinet",
                attribute="key_holder",
                value=match.value,
                source_text=_source_sentence(answer_text, match.marker),
                extraction_rule="medication-cabinet-key-holder.v1",
                confidence=0.78,
                source_start=match.source_start,
                source_end=match.source_end,
            )
        )

    door_status = _service_door_status(answer_text, normalized_text)
    if door_status:
        claims.append(
            _claim(
                answer_id=answer_id,
                case_id=case.id,
                question_id=question.id,
                answer_text=answer_text,
                ordinal=len(claims) + 1,
                subject="service_door",
                attribute="status",
                value=door_status.value,
                source_text=answer_text.strip(),
                extraction_rule="service-door-status.v1",
                confidence=0.74,
                source_start=door_status.source_start,
                source_end=door_status.source_end,
            )
        )

    source_of_knowledge = _source_of_knowledge(answer_text, normalized_text)
    if source_of_knowledge:
        claims.append(
            _claim(
                answer_id=answer_id,
                case_id=case.id,
                question_id=question.id,
                answer_text=answer_text,
                ordinal=len(claims) + 1,
                subject=_source_subject(case, question),
                attribute="source_of_knowledge",
                value=source_of_knowledge.value,
                source_text=answer_text.strip(),
                extraction_rule="source-of-knowledge.v1",
                confidence=0.72,
                source_start=source_of_knowledge.source_start,
                source_end=source_of_knowledge.source_end,
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
    case_id: str,
    question_id: str,
    answer_text: str,
    ordinal: int,
    subject: str,
    attribute: str,
    value: str,
    source_text: str,
    extraction_rule: str,
    confidence: float,
    source_start: int | None,
    source_end: int | None,
) -> Claim:
    extraction_hash = calculate_claim_extraction_hash(
        case_id=case_id,
        question_id=question_id,
        answer_id=answer_id,
        answer_text=answer_text,
        extraction_rule=extraction_rule,
        subject=subject,
        attribute=attribute,
        value=value,
        source_text=source_text,
        confidence=confidence,
        source_start=source_start,
        source_end=source_end,
    )
    return Claim(
        id=f"{answer_id}-claim-{ordinal:02d}",
        subject=subject,
        attribute=attribute,
        value=value,
        source_text=source_text,
        review_status=ClaimReviewStatus.PENDING,
        extraction_rule=extraction_rule,
        extraction_hash=extraction_hash,
        confidence=confidence,
        source_start=source_start,
        source_end=source_end,
    )


def calculate_claim_extraction_hash(
    *,
    case_id: str,
    question_id: str,
    answer_id: str,
    answer_text: str,
    extraction_rule: str,
    subject: str,
    attribute: str,
    value: str,
    source_text: str,
    confidence: float,
    source_start: int | None,
    source_end: int | None,
) -> str:
    """Return a stable hash for the original deterministic claim candidate."""

    payload = {
        "schema": "claim-extraction-candidate.v1",
        "case_id": case_id,
        "question_id": question_id,
        "answer_id": answer_id,
        "answer_text_sha256": hashlib.sha256(answer_text.encode("utf-8")).hexdigest(),
        "extraction_rule": extraction_rule,
        "subject": subject,
        "attribute": attribute,
        "value": value,
        "source_text": source_text,
        "confidence": confidence,
        "source_start": source_start,
        "source_end": source_end,
    }
    canonical_payload = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical_payload.encode("utf-8")).hexdigest()


def _time_values(text: str) -> tuple[tuple[str, int, int], ...]:
    return tuple(
        (match.group(0).replace(".", ":"), match.start(), match.end())
        for match in _TIME_RE.finditer(text)
    )


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


def _key_holder_values(text: str) -> tuple[_MarkerMatch, ...]:
    normalized = _normalize(text)
    values: list[_MarkerMatch] = []
    if any(marker in normalized for marker in ("supervisor", "przelozon", "kierownik")):
        source_start, source_end = _first_marker_span(
            text,
            ("supervisor", "prze\u0142o\u017con", "przelozon", "kierownik"),
        )
        values.append(
            _MarkerMatch(
                value="supervisor",
                marker=_marker_text(text, source_start, source_end, "supervisor"),
                source_start=source_start,
                source_end=source_end,
            )
        )
    if any(marker in normalized for marker in ("own key", "my key", "wlasn", "uzylem")):
        source_start, source_end = _first_marker_span(
            text,
            ("own key", "my key", "w\u0142as", "wlas", "u\u017cy\u0142em", "u\u017cy\u0142am", "uzylem", "uzylam"),
        )
        values.append(
            _MarkerMatch(
                value="witness",
                marker=_marker_text(text, source_start, source_end, "key"),
                source_start=source_start,
                source_end=source_end,
            )
        )
    return tuple(values)


def _service_door_status(text: str, normalized_text: str) -> _MarkerMatch | None:
    if "service door" not in normalized_text and "drzwi serwis" not in normalized_text:
        return None
    if any(marker in normalized_text for marker in ("locked", "zamkn")):
        source_start, source_end = _first_marker_span(text, ("locked", "zamkn"))
        return _MarkerMatch(
            value="locked",
            marker=_marker_text(text, source_start, source_end, "locked"),
            source_start=source_start,
            source_end=source_end,
        )
    if any(marker in normalized_text for marker in ("open", "otwart")):
        source_start, source_end = _first_marker_span(text, ("open", "otwart"))
        return _MarkerMatch(
            value="open",
            marker=_marker_text(text, source_start, source_end, "open"),
            source_start=source_start,
            source_end=source_end,
        )
    return None


def _source_of_knowledge(text: str, normalized_text: str) -> _MarkerMatch | None:
    direct_markers = (
        "own observation",
        "direct observation",
        "saw",
        "widzia\u0142",
        "widzial",
        "osobi\u015bcie",
        "osobiscie",
    )
    documentation_markers = (
        "documentation",
        "document",
        "log",
        "recording",
        "camera",
        "dokument",
        "nagran",
        "monitoring",
    )
    direct = any(
        marker in normalized_text
        for marker in direct_markers
    )
    documentation = any(
        marker in normalized_text
        for marker in documentation_markers
    )
    source_start, source_end = _first_marker_span(text, (*direct_markers, *documentation_markers))
    marker = _marker_text(text, source_start, source_end, "source")
    if direct and documentation:
        return _MarkerMatch("direct observation and documentation", marker, source_start, source_end)
    if direct:
        return _MarkerMatch("direct observation", marker, source_start, source_end)
    if documentation:
        return _MarkerMatch("documentation", marker, source_start, source_end)
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


def _first_marker_span(text: str, markers: tuple[str, ...]) -> tuple[int | None, int | None]:
    lowered = text.casefold()
    for marker in markers:
        index = lowered.find(marker.casefold())
        if index >= 0:
            return index, index + len(marker)
    return None, None


def _marker_text(text: str, start: int | None, end: int | None, fallback: str) -> str:
    if start is None or end is None:
        return fallback
    return text[start:end]


def _normalize(value: str) -> str:
    normalized = value.translate(_POLISH_TRANSLATION)
    normalized = unicodedata.normalize("NFKD", normalized)
    normalized = normalized.encode("ascii", "ignore").decode("ascii")
    return " ".join(normalized.casefold().strip().split())
