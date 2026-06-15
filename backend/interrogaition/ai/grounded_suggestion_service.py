"""Grounded AI suggestion workflow with citation validation."""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, is_dataclass
from typing import Any

from interrogaition.ai.model_client import ModelClient, ModelRequest
from interrogaition.ai.prompt_renderer import (
    load_system_prompt,
    render_grounded_followup_user_prompt,
)
from interrogaition.ai.response_parser import ParsedSuggestionBatch, parse_suggestion_response
from interrogaition.analysis.grounding_context import GroundingContextPack


PROMPT_VERSION = "grounded_followup_questions.system.md@v1"


@dataclass(frozen=True)
class GroundedSuggestionWarning:
    suggestion_id: str
    warning_type: str
    detail: str


@dataclass(frozen=True)
class GroundedSuggestionResult:
    batch: ParsedSuggestionBatch
    warnings: tuple[GroundedSuggestionWarning, ...]
    prompt_version: str
    prompt_hash: str
    prompt_text: str
    context_hash: str
    output_hash: str
    output_text: str


def generate_grounded_suggestions(
    *,
    grounding_pack: GroundingContextPack,
    model_client: ModelClient,
    locale: str,
    citation_policy: str = "warn",
) -> GroundedSuggestionResult:
    """Generate model suggestions and validate source citations against the grounding pack."""

    user_prompt = render_grounded_followup_user_prompt(grounding_pack, locale=locale)
    context_hash = _sha256_json(grounding_pack)
    request = ModelRequest(
        system_prompt=load_system_prompt("grounded_followup_questions.system.md"),
        user_prompt=user_prompt,
        temperature=0.2,
        response_format="json",
    )
    prompt_text = _prompt_artifact_text(
        request=request,
        prompt_version=PROMPT_VERSION,
        context_hash=context_hash,
    )
    response = model_client.complete(request)
    batch = parse_suggestion_response(response.text, model=response.model)
    warnings = _citation_warnings(
        batch=batch,
        allowed_source_ids=set(grounding_pack.allowed_source_ids),
    )
    if warnings and citation_policy == "reject":
        details = "; ".join(warning.detail for warning in warnings)
        raise ValueError(f"Grounded suggestions contain invalid citations: {details}")

    return GroundedSuggestionResult(
        batch=batch,
        warnings=warnings,
        prompt_version=PROMPT_VERSION,
        prompt_hash=hashlib.sha256(prompt_text.encode("utf-8")).hexdigest(),
        prompt_text=prompt_text,
        context_hash=context_hash,
        output_hash=hashlib.sha256(response.text.encode("utf-8")).hexdigest(),
        output_text=response.text,
    )


def _prompt_artifact_text(
    *,
    request: ModelRequest,
    prompt_version: str,
    context_hash: str,
) -> str:
    payload = {
        "artifact_schema": "grounded_suggestion_prompt@v1",
        "prompt_version": prompt_version,
        "context_hash": context_hash,
        "request": {
            "system_prompt": request.system_prompt,
            "user_prompt": request.user_prompt,
            "temperature": request.temperature,
            "response_format": request.response_format,
        },
    }
    return json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True)


def _citation_warnings(
    *,
    batch: ParsedSuggestionBatch,
    allowed_source_ids: set[str],
) -> tuple[GroundedSuggestionWarning, ...]:
    warnings: list[GroundedSuggestionWarning] = []

    for suggestion in batch.suggestions:
        if not suggestion.linked_evidence:
            warnings.append(
                GroundedSuggestionWarning(
                    suggestion_id=suggestion.id,
                    warning_type="missing_linked_evidence",
                    detail=f"Suggestion {suggestion.id} does not cite source ids.",
                )
            )
            continue

        for source_id in suggestion.linked_evidence:
            if source_id not in allowed_source_ids:
                warnings.append(
                    GroundedSuggestionWarning(
                        suggestion_id=suggestion.id,
                        warning_type="unknown_source_id",
                        detail=f"Suggestion {suggestion.id} cites source id outside grounding pack: {source_id}.",
                    )
                )

    return tuple(warnings)


def _sha256_json(value: Any) -> str:
    payload = json.dumps(_to_jsonable(value), ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _to_jsonable(value: Any) -> Any:
    if is_dataclass(value):
        return {
            key: _to_jsonable(item)
            for key, item in asdict(value).items()
        }
    if isinstance(value, tuple):
        return [_to_jsonable(item) for item in value]
    if isinstance(value, list):
        return [_to_jsonable(item) for item in value]
    if isinstance(value, dict):
        return {str(key): _to_jsonable(item) for key, item in value.items()}
    if hasattr(value, "value"):
        return value.value

    return value
