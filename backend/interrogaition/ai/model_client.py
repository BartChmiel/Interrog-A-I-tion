"""Model client abstraction.

Real local model runtimes should implement this interface. Tests use
`FakeModelClient` so the application logic remains deterministic.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class ModelRequest:
    system_prompt: str
    user_prompt: str
    temperature: float = 0.2
    response_format: str = "json"


@dataclass(frozen=True)
class ModelResponse:
    text: str
    model: str = "fake"
    prompt_tokens: int | None = None
    completion_tokens: int | None = None


class ModelClient(Protocol):
    def complete(self, request: ModelRequest) -> ModelResponse:
        """Return a model response for a prompt request."""


@dataclass
class FakeModelClient:
    response_text: str
    model: str = "fake-model"
    requests: list[ModelRequest] | None = None

    def complete(self, request: ModelRequest) -> ModelResponse:
        if self.requests is None:
            self.requests = []

        self.requests.append(request)
        return ModelResponse(text=self.response_text, model=self.model)


@dataclass
class DeterministicGroundedModelClient:
    """Rule-based fake model for grounded suggestion workflow tests and demos."""

    model: str = "deterministic-grounded-fake"
    requests: list[ModelRequest] | None = None

    def complete(self, request: ModelRequest) -> ModelResponse:
        if self.requests is None:
            self.requests = []

        self.requests.append(request)
        payload = json.loads(request.user_prompt)
        pack = payload["grounding_pack"]
        locale = payload.get("locale", "en")
        suggestions = [
            suggestion
            for topic in pack["topic_contexts"]
            if topic["status"] in {"contested", "missing", "material_only"}
            for suggestion in _suggestions_for_topic(topic, locale=locale)
        ]
        if not suggestions and pack["topic_contexts"]:
            suggestions.append(_followup_suggestion_for_topic(pack["topic_contexts"][0], locale=locale))

        if pack["topic_contexts"]:
            suggestions.append(_summary_suggestion(pack, locale=locale))

        return ModelResponse(
            text=json.dumps({"suggestions": suggestions}, ensure_ascii=False),
            model=self.model,
        )


def _suggestions_for_topic(topic: dict[str, object], *, locale: str) -> list[dict[str, object]]:
    status = str(topic["status"])
    suggestions = [_followup_suggestion_for_topic(topic, locale=locale)]
    if status in {"missing", "material_only"}:
        suggestions.append(_gap_suggestion_for_topic(topic, locale=locale))
    if status == "contested":
        suggestions.append(_inconsistency_suggestion_for_topic(topic, locale=locale))

    return suggestions


def _followup_suggestion_for_topic(topic: dict[str, object], *, locale: str) -> dict[str, object]:
    topic_id = str(topic["topic_id"])
    label = str(topic["label"])
    status = str(topic["status"])
    evidence = _topic_evidence(topic)

    if locale == "pl":
        question = _pl_question(label, status)
        reason = _pl_reason(label, status)
    else:
        question = _en_question(label, status)
        reason = _en_reason(label, status)

    return {
        "type": "follow_up_question",
        "question": question,
        "reason": reason,
        "linked_topics": [topic_id],
        "linked_evidence": evidence,
        "risk_flags": ["operator_review_required"],
        "confidence": 0.68 if status == "contested" else 0.62,
    }


def _gap_suggestion_for_topic(topic: dict[str, object], *, locale: str) -> dict[str, object]:
    topic_id = str(topic["topic_id"])
    label = str(topic["label"])
    status = str(topic["status"])
    evidence = _topic_evidence(topic)
    if locale == "pl":
        text = f"Luka tematyczna wymaga pokrycia: {label}."
        reason = _pl_reason(label, status)
    else:
        text = f"Topic gap requires coverage: {label}."
        reason = _en_reason(label, status)

    return {
        "type": "gap",
        "text": text,
        "reason": reason,
        "linked_topics": [topic_id],
        "linked_evidence": evidence,
        "risk_flags": ["operator_review_required"],
        "confidence": 0.6,
    }


def _inconsistency_suggestion_for_topic(topic: dict[str, object], *, locale: str) -> dict[str, object]:
    topic_id = str(topic["topic_id"])
    label = str(topic["label"])
    evidence = _topic_evidence(topic)
    if locale == "pl":
        text = f"Potencjalna niespojnosc w watku '{label}' wymaga spokojnego doprecyzowania."
        reason = _pl_reason(label, "contested")
    else:
        text = f"Potential inconsistency in '{label}' requires calm clarification."
        reason = _en_reason(label, "contested")

    return {
        "type": "potential_inconsistency",
        "text": text,
        "reason": reason,
        "linked_topics": [topic_id],
        "linked_evidence": evidence,
        "risk_flags": ["operator_review_required"],
        "confidence": 0.66,
    }


def _summary_suggestion(pack: dict[str, object], *, locale: str) -> dict[str, object]:
    contexts = pack["topic_contexts"]
    topic_ids = [str(topic["topic_id"]) for topic in contexts]
    evidence = [
        str(source_id)
        for topic in contexts
        for source_id in _topic_evidence(topic)
    ][:6]
    if locale == "pl":
        text = "Mapa sprawy wskazuje watki wymagajace dalszego prowadzenia bez automatycznego werdyktu."
        reason = "Podsumowanie obejmuje tematy z aktualnego pakietu kontekstowego."
    else:
        text = "The case map shows threads that need further handling without an automated verdict."
        reason = "The summary covers topics from the current grounding context pack."

    return {
        "type": "summary",
        "text": text,
        "reason": reason,
        "linked_topics": topic_ids,
        "linked_evidence": evidence,
        "risk_flags": ["operator_review_required"],
        "confidence": 0.58,
    }


def _topic_evidence(topic: dict[str, object]) -> list[str]:
    source_ids = [
        str(source_id)
        for key in ("question_ids", "answer_ids", "claim_ids", "material_ids", "finding_ids")
        for source_id in topic.get(key, [])
    ]
    if source_ids:
        return source_ids[:4]

    return [str(topic["topic_id"])]


def _pl_question(label: str, status: str) -> str:
    if status == "contested":
        return f"Prosze doprecyzowac watek: {label}. Co dokladnie Pan/Pani pamieta i w jakiej kolejnosci?"
    if status == "material_only":
        return f"Czy moze Pan/Pani odniesc sie do watku: {label}, jesli jest on Panu/Pani znany?"
    if status == "missing":
        return f"Co moze Pan/Pani powiedziec o watku: {label}?"
    return f"Czy chce Pan/Pani cos doprecyzowac w watku: {label}?"


def _pl_reason(label: str, status: str) -> str:
    if status == "contested":
        return f"Mapa sprawy oznacza temat '{label}' jako wymagajacy wyjasnienia."
    if status == "material_only":
        return f"Zarejestrowany material wskazuje temat '{label}', ale nie ma jeszcze odpowiedzi w tym watku."
    if status == "missing":
        return f"Temat '{label}' nie ma jeszcze pokrycia w pytaniach lub odpowiedziach."
    return f"Temat '{label}' jest w zakresie aktualnego kontekstu."


def _en_question(label: str, status: str) -> str:
    if status == "contested":
        return f"Please clarify the {label} thread. What exactly do you remember, and in what order?"
    if status == "material_only":
        return f"Can you comment on the {label} thread, if it is known to you?"
    if status == "missing":
        return f"What can you say about the {label} thread?"
    return f"Would you like to clarify anything about the {label} thread?"


def _en_reason(label: str, status: str) -> str:
    if status == "contested":
        return f"The case map marks '{label}' as requiring clarification."
    if status == "material_only":
        return f"Registered material points to '{label}', but no answer covers it yet."
    if status == "missing":
        return f"The '{label}' topic has no question or answer coverage yet."
    return f"The '{label}' topic is in the current grounded context."
