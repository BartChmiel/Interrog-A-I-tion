"""Guardrails for AI-generated text."""

from __future__ import annotations


FORBIDDEN_CLAIM_PATTERNS: tuple[str, ...] = (
    "klamie",
    "kłamie",
    "na pewno klamie",
    "na pewno kłamie",
    "jest winny",
    "jest winna",
    "winny",
    "winna",
    "wykryto klamstwo",
    "wykryto kłamstwo",
    "prawdomownosc",
    "prawdomówność",
    "procent klamstwa",
    "procent kłamstwa",
    "diagnoza psychologiczna",
)


def find_forbidden_claims(text: str) -> list[str]:
    """Return forbidden claim patterns found in model output."""

    normalized = text.lower()
    return [pattern for pattern in FORBIDDEN_CLAIM_PATTERNS if pattern in normalized]


def is_ai_output_allowed(text: str) -> bool:
    """Check whether model output respects the project's core interpretive boundary."""

    return not find_forbidden_claims(text)

