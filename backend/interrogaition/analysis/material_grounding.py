"""Deterministic links between registered materials and interview questions."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Iterable

from interrogaition.domain.models import Case, Topic
from interrogaition.storage.material_registry import MaterialRecord


@dataclass(frozen=True)
class MaterialText:
    record: MaterialRecord
    text: str


@dataclass(frozen=True)
class MaterialTopicSignal:
    material_id: str
    topic_id: str
    matched_terms: tuple[str, ...]
    confidence: float


@dataclass(frozen=True)
class MaterialQuestionLink:
    material_id: str
    question_id: str
    topic_ids: tuple[str, ...]
    matched_terms: tuple[str, ...]
    confidence: float
    rationale: str


_TOKEN_RE = re.compile(r"[a-z0-9_:-]{3,}")
_TOPIC_KEYWORDS: dict[str, tuple[str, ...]] = {
    "topic-chronology": (
        "19:45",
        "20:10",
        "czas",
        "godzina",
        "godziny",
        "kiedy",
        "o ktorej",
        "time",
        "when",
    ),
    "topic-location": (
        "biblioteka",
        "chodnik",
        "gdzie",
        "miejsce",
        "stojak",
        "stojaku",
        "ulica",
        "bicycle stand",
        "library",
        "location",
    ),
    "topic-person": (
        "ciemna kurtka",
        "kurtka",
        "mezczyzna",
        "osoba",
        "person",
        "jacket",
        "man",
    ),
    "topic-source": (
        "swiadek",
        "widzial",
        "widzialem",
        "zauwazyl",
        "observation",
        "saw",
        "source",
        "witness",
    ),
    "topic-recording": (
        "kamera",
        "kamery",
        "monitoring",
        "nagranie",
        "recording",
        "camera",
        "cctv",
    ),
    "topic-pharmacy-chronology": (
        "22:14",
        "22:15",
        "22:28",
        "22:36",
        "czas",
        "godzina",
        "kiedy",
        "time",
        "when",
    ),
    "topic-pharmacy-access": (
        "dostep",
        "drzwi",
        "korytarz serwisowy",
        "otwarte",
        "zamkniete",
        "service corridor",
        "service door",
        "locked",
        "open",
        "access",
    ),
    "topic-pharmacy-person": (
        "ciemna bluza",
        "nieznana osoba",
        "osoba",
        "unknown person",
        "dark hoodie",
        "person",
    ),
    "topic-pharmacy-alarm": (
        "alarm",
        "panel",
        "czujnik",
        "sensor",
        "alarm panel",
    ),
    "topic-pharmacy-recording": (
        "kamera",
        "monitoring",
        "nagranie",
        "cctv",
        "camera",
        "recording",
    ),
    "topic-pharmacy-source": (
        "zrodlo",
        "widzial",
        "obserwacja",
        "log",
        "source",
        "observation",
        "panel export",
    ),
    "topic-care-chronology": (
        "18:40",
        "19:03",
        "19:05",
        "czas",
        "godzina",
        "chronologia",
        "time",
        "timeline",
    ),
    "topic-care-medication-log": (
        "dokumentacja lekowa",
        "papierowy log",
        "wpis",
        "medication log",
        "paper log",
        "entry",
    ),
    "topic-care-access": (
        "dostep",
        "klucz",
        "szafka",
        "access",
        "key",
        "cabinet",
    ),
    "topic-care-role-boundary": (
        "rola",
        "swiadek",
        "podejrzany",
        "role",
        "witness",
        "suspect",
    ),
    "topic-care-source": (
        "zrodlo",
        "obserwacja",
        "dokumentacja",
        "source",
        "observation",
        "documentation",
    ),
    "topic-care-inventory": (
        "inwentaryzacja",
        "uzgodnienie",
        "stan lekow",
        "inventory",
        "reconciliation",
    ),
    "topic-care-recording": (
        "monitoring",
        "nagranie",
        "log dostepu",
        "recording",
        "access log",
        "corridor monitoring",
    ),
}


def link_materials_to_questions(
    case: Case,
    materials: Iterable[MaterialText],
) -> tuple[MaterialQuestionLink, ...]:
    """Return deterministic material-question links based on shared topic signals."""

    topics_by_id = {topic.id: topic for topic in case.topics}
    links: list[MaterialQuestionLink] = []

    for material in materials:
        topic_signals = infer_material_topic_signals(topics_by_id.values(), material)
        signals_by_topic = {signal.topic_id: signal for signal in topic_signals}
        for question in case.questions:
            topic_ids = tuple(
                topic_id for topic_id in question.topic_ids if topic_id in signals_by_topic
            )
            if not topic_ids:
                continue

            matched_terms = tuple(
                sorted(
                    {
                        term
                        for topic_id in topic_ids
                        for term in signals_by_topic[topic_id].matched_terms
                    }
                )
            )
            confidence = min(
                1.0,
                round(
                    0.45
                    + 0.15 * len(topic_ids)
                    + 0.02 * min(len(matched_terms), 10),
                    2,
                ),
            )
            topic_labels = ", ".join(topics_by_id[topic_id].label for topic_id in topic_ids)
            links.append(
                MaterialQuestionLink(
                    material_id=material.record.id,
                    question_id=question.id,
                    topic_ids=tuple(sorted(topic_ids)),
                    matched_terms=matched_terms,
                    confidence=confidence,
                    rationale=f"Material and question share topic signal(s): {topic_labels}.",
                )
            )

    return tuple(
        sorted(
            links,
            key=lambda link: (
                link.question_id,
                link.material_id,
                -link.confidence,
            ),
        )
    )


def infer_material_topic_signals(
    topics: Iterable[Topic],
    material: MaterialText,
) -> tuple[MaterialTopicSignal, ...]:
    """Infer topic signals from material text, title, type, and tags."""

    searchable = _fold(
        " ".join(
            (
                material.record.title,
                material.record.description,
                material.record.source_type.value,
                material.record.original_name,
                " ".join(material.record.tags),
                material.text,
            )
        )
    )
    signals: list[MaterialTopicSignal] = []

    for topic in topics:
        matched_terms = tuple(
            sorted(
                term
                for term in _topic_terms(topic)
                if _term_matches(term, searchable)
            )
        )
        if not matched_terms:
            continue

        confidence = min(1.0, round(0.5 + 0.05 * min(len(matched_terms), 8), 2))
        signals.append(
            MaterialTopicSignal(
                material_id=material.record.id,
                topic_id=topic.id,
                matched_terms=matched_terms,
                confidence=confidence,
            )
        )

    return tuple(sorted(signals, key=lambda signal: signal.topic_id))


def _topic_terms(topic: Topic) -> tuple[str, ...]:
    custom_terms = _TOPIC_KEYWORDS.get(topic.id, ())
    raw_terms = (
        topic.id.removeprefix("topic-"),
        topic.label,
        topic.description,
        *custom_terms,
    )
    terms: set[str] = set()
    for raw_term in raw_terms:
        folded = _fold(raw_term)
        if len(folded) >= 3:
            terms.add(folded)
        terms.update(match.group(0) for match in _TOKEN_RE.finditer(folded))

    return tuple(sorted(terms))


def _term_matches(term: str, searchable: str) -> bool:
    if " " in term or ":" in term:
        return term in searchable
    return re.search(rf"\b{re.escape(term)}\b", searchable) is not None


def _fold(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    without_marks = "".join(character for character in normalized if not unicodedata.combining(character))
    return without_marks.lower()
