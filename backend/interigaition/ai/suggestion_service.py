"""High-level AI suggestion service."""

from __future__ import annotations

from interigaition.ai.model_client import ModelClient, ModelRequest
from interigaition.ai.prompt_renderer import load_system_prompt, render_followup_user_prompt
from interigaition.ai.response_parser import ParsedSuggestionBatch, parse_suggestion_response
from interigaition.domain.models import Case


def generate_followup_suggestions(
    case: Case,
    model_client: ModelClient,
) -> ParsedSuggestionBatch:
    """Generate guarded follow-up suggestions for a case."""

    request = ModelRequest(
        system_prompt=load_system_prompt("followup_questions.system.md"),
        user_prompt=render_followup_user_prompt(case),
        temperature=0.2,
        response_format="json",
    )
    response = model_client.complete(request)
    return parse_suggestion_response(response.text, model=response.model)

