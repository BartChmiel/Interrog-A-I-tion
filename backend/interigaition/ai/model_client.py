"""Model client abstraction.

Real local model runtimes should implement this interface. Tests use
`FakeModelClient` so the application logic remains deterministic.
"""

from __future__ import annotations

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

