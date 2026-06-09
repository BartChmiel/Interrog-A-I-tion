"""Structured decision-support indicators.

Indicators describe the interview material and process. They do not issue legal,
procedural, guilt, or deception verdicts.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class IndicatorCategory(StrEnum):
    PROCESS = "process"
    CONSISTENCY = "consistency"
    EVIDENCE_ALIGNMENT = "evidence_alignment"
    CREDIBILITY_REVIEW = "credibility_review"


@dataclass(frozen=True)
class IndicatorFactor:
    id: str
    label: str
    description: str
    value: str
    linked_ids: tuple[str, ...] = ()
    weight: float | None = None


@dataclass(frozen=True)
class Indicator:
    id: str
    category: IndicatorCategory
    label: str
    description: str
    score: float | None
    confidence: float
    factors: tuple[IndicatorFactor, ...]
    linked_ids: tuple[str, ...] = ()
    interpretation: str = ""
    limitations: tuple[str, ...] = ()

