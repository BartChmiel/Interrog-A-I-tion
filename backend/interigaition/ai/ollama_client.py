"""Ollama model client adapter.

This adapter is not used by default. It stays behind the `ModelClient`
interface so tests and core logic remain deterministic.
"""

from __future__ import annotations

import json
import urllib.request
from dataclasses import dataclass

from interigaition.ai.model_client import ModelRequest, ModelResponse


@dataclass(frozen=True)
class OllamaClient:
    model: str
    base_url: str = "http://127.0.0.1:11434"
    timeout_seconds: int = 120

    def complete(self, request: ModelRequest) -> ModelResponse:
        payload = {
            "model": self.model,
            "stream": False,
            "messages": [
                {"role": "system", "content": request.system_prompt},
                {"role": "user", "content": request.user_prompt},
            ],
            "options": {
                "temperature": request.temperature,
            },
        }

        body = json.dumps(payload).encode("utf-8")
        http_request = urllib.request.Request(
            url=f"{self.base_url.rstrip('/')}/api/chat",
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        with urllib.request.urlopen(http_request, timeout=self.timeout_seconds) as response:
            response_payload = json.loads(response.read().decode("utf-8"))

        text = str(response_payload.get("message", {}).get("content", ""))
        return ModelResponse(text=text, model=self.model)
