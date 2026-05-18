"""Parse and validate model responses."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from interigaition.ai.guardrails import find_forbidden_claims
from interigaition.domain.models import AISuggestion, SuggestionType


class ModelResponseError(ValueError):
    """Raised when a model response cannot be parsed or accepted."""


@dataclass(frozen=True)
class ParsedSuggestionBatch:
    suggestions: tuple[AISuggestion, ...]
    model: str


def parse_suggestion_response(text: str, *, model: str = "unknown") -> ParsedSuggestionBatch:
    """Parse a model JSON response into AI suggestions."""

    forbidden = find_forbidden_claims(text)
    if forbidden:
        raise ModelResponseError(f"Model response contains forbidden claims: {', '.join(forbidden)}")

    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ModelResponseError(f"Model response is not valid JSON: {exc}") from exc

    raw_suggestions = payload.get("suggestions")
    if not isinstance(raw_suggestions, list):
        raise ModelResponseError("Model response must contain a suggestions array.")

    suggestions = tuple(
        _parse_suggestion(raw, index=index) for index, raw in enumerate(raw_suggestions, start=1)
    )

    return ParsedSuggestionBatch(suggestions=suggestions, model=model)


def _parse_suggestion(raw: Any, *, index: int) -> AISuggestion:
    if not isinstance(raw, dict):
        raise ModelResponseError("Each suggestion must be an object.")

    suggestion_type = SuggestionType(str(raw.get("type", SuggestionType.FOLLOW_UP_QUESTION.value)))
    text = str(raw.get("text") or raw.get("question") or "").strip()
    reason = str(raw.get("reason") or "").strip()

    if not text:
        raise ModelResponseError("Suggestion text is required.")

    forbidden = find_forbidden_claims(f"{text}\n{reason}")
    if forbidden:
        raise ModelResponseError(f"Suggestion contains forbidden claims: {', '.join(forbidden)}")

    confidence = raw.get("confidence")
    if confidence is not None:
        confidence = max(0.0, min(1.0, float(confidence)))

    return AISuggestion(
        id=str(raw.get("id") or f"ai-suggestion-{index:03d}"),
        suggestion_type=suggestion_type,
        text=text,
        reason=reason,
        linked_topics=tuple(str(item) for item in raw.get("linked_topics", [])),
        linked_evidence=tuple(str(item) for item in raw.get("linked_evidence", [])),
        risk_flags=tuple(str(item) for item in raw.get("risk_flags", [])),
        confidence=confidence,
    )

