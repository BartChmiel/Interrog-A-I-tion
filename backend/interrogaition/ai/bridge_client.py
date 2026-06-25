"""OpenAI-compatible bridge model client adapter.

This client is intended for developer-controlled bridges such as a local proxy,
LM Studio, llama.cpp server, or a separately approved commercial bridge. It stays
behind the same ModelClient interface and runtime gates as Ollama.
"""

from __future__ import annotations

import json
import urllib.request
from dataclasses import dataclass

from interrogaition.ai.model_client import ModelRequest, ModelResponse


@dataclass(frozen=True)
class BridgeModelClient:
    model: str
    base_url: str
    api_key: str = ""
    timeout_seconds: int = 120

    def complete(self, request: ModelRequest) -> ModelResponse:
        payload: dict[str, object] = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": request.system_prompt},
                {"role": "user", "content": request.user_prompt},
            ],
            "temperature": request.temperature,
        }
        if request.response_format == "json":
            payload["response_format"] = {"type": "json_object"}

        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        http_request = urllib.request.Request(
            url=f"{self.base_url.rstrip('/')}/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )

        with urllib.request.urlopen(http_request, timeout=self.timeout_seconds) as response:
            response_payload = json.loads(response.read().decode("utf-8"))

        choices = response_payload.get("choices", [])
        message = choices[0].get("message", {}) if choices else {}
        usage = response_payload.get("usage", {})
        return ModelResponse(
            text=str(message.get("content", "")),
            model=str(response_payload.get("model") or self.model),
            prompt_tokens=_int_or_none(usage.get("prompt_tokens")),
            completion_tokens=_int_or_none(usage.get("completion_tokens")),
        )


def _int_or_none(value: object) -> int | None:
    return value if isinstance(value, int) else None
