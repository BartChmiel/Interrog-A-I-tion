"""Simple first-pass checks for potentially non-neutral questions.

This is not a final psychological validator. It is a conservative helper that
marks questions requiring human review.
"""

from __future__ import annotations


LEADING_PATTERNS: tuple[str, ...] = (
    "czyli ",
    "przeciez ",
    "przecież ",
    "prawda?",
    "nie jest tak",
    "dlaczego pan ukrywa",
    "dlaczego pani ukrywa",
    "skoro ",
    "musial pan",
    "musiała pani",
)

ACCUSATORY_PATTERNS: tuple[str, ...] = (
    "dlaczego pan klamie",
    "dlaczego pani klamie",
    "dlaczego pan kłamie",
    "dlaczego pani kłamie",
    "co pan ukrywa",
    "co pani ukrywa",
    "przyzna sie pan",
    "przyzna się pan",
    "przyzna sie pani",
    "przyzna się pani",
)


def neutrality_flags(question: str) -> list[str]:
    """Return risk flags for a question that may need rewriting."""

    normalized = question.lower()
    flags: list[str] = []

    if any(pattern in normalized for pattern in LEADING_PATTERNS):
        flags.append("leading")

    if any(pattern in normalized for pattern in ACCUSATORY_PATTERNS):
        flags.append("accusatory")

    if len([part for part in question.split("?") if part.strip()]) > 1:
        flags.append("compound")

    return flags


def is_neutral_enough(question: str) -> bool:
    """Return whether a question passes the first-pass neutrality check."""

    return not neutrality_flags(question)

