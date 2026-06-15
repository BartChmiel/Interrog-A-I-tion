"""Local model runtime configuration and smoke checks.

The live suggestion workflow still receives an explicit `ModelClient`. This module
only describes and probes the local runtime so real model output cannot be enabled
accidentally by changing environment variables alone.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Mapping

from interrogaition.ai.model_client import (
    DeterministicGroundedModelClient,
    FakeModelClient,
    ModelClient,
    ModelRequest,
)
from interrogaition.ai.ollama_client import OllamaClient


DEFAULT_DETERMINISTIC_MODEL = "deterministic-grounded-fake"
DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434"
DEFAULT_OLLAMA_MODEL = "llama3.1:8b"


@dataclass(frozen=True)
class LocalModelRuntimeConfig:
    provider: str = "deterministic"
    configured_model: str = DEFAULT_DETERMINISTIC_MODEL
    ollama_base_url: str = DEFAULT_OLLAMA_BASE_URL
    timeout_seconds: int = 120
    temperature: float = 0.2
    real_model_enabled: bool = False
    live_output_enabled: bool = False

    @property
    def effective_provider(self) -> str:
        if self.provider == "ollama" and self.real_model_enabled:
            return "ollama"
        return "deterministic"

    @property
    def restrictions(self) -> tuple[str, ...]:
        restrictions = [
            "Institutional live use remains blocked until a STOP review.",
            "Smoke prompts must not include case material, personal data, or interview notes.",
        ]
        if self.live_output_enabled and self.effective_provider == "ollama":
            restrictions.append(
                "Live grounded suggestions use the configured Ollama model for developer experiments.",
            )
        else:
            restrictions.append(
                "Grounded suggestions use the deterministic local assistant unless live Ollama output is enabled.",
            )
        if self.provider == "ollama" and not self.real_model_enabled:
            restrictions.append("Ollama is configured but real model execution is disabled.")
        if self.provider == "ollama" and self.real_model_enabled and not self.live_output_enabled:
            restrictions.append(
                "Real model smoke is available, but live grounded suggestions remain deterministic.",
            )
        return tuple(restrictions)


@dataclass(frozen=True)
class LocalModelSmokeResult:
    ok: bool
    provider: str
    model: str
    real_model_invoked: bool
    detail: str
    response_preview: str = ""
    prompt_tokens: int | None = None
    completion_tokens: int | None = None


def load_local_model_runtime_config(
    environ: Mapping[str, str] | None = None,
) -> LocalModelRuntimeConfig:
    values = os.environ if environ is None else environ
    provider = values.get("INTERROGAITION_MODEL_PROVIDER", "deterministic").strip().lower()
    if provider not in {"deterministic", "ollama"}:
        provider = "deterministic"

    ollama_model = values.get("INTERROGAITION_OLLAMA_MODEL", DEFAULT_OLLAMA_MODEL).strip()
    deterministic_model = values.get(
        "INTERROGAITION_DETERMINISTIC_MODEL",
        DEFAULT_DETERMINISTIC_MODEL,
    ).strip()
    configured_model = ollama_model if provider == "ollama" else deterministic_model

    return LocalModelRuntimeConfig(
        provider=provider,
        configured_model=configured_model or DEFAULT_DETERMINISTIC_MODEL,
        ollama_base_url=values.get("INTERROGAITION_OLLAMA_BASE_URL", DEFAULT_OLLAMA_BASE_URL).strip()
        or DEFAULT_OLLAMA_BASE_URL,
        timeout_seconds=_parse_int(values.get("INTERROGAITION_OLLAMA_TIMEOUT_SECONDS"), default=120),
        temperature=_parse_float(values.get("INTERROGAITION_MODEL_TEMPERATURE"), default=0.2),
        real_model_enabled=_parse_bool(values.get("INTERROGAITION_ENABLE_REAL_MODEL")),
        live_output_enabled=_parse_bool(values.get("INTERROGAITION_ENABLE_LIVE_MODEL_OUTPUT")),
    )


def resolve_grounded_model_client(
    config: LocalModelRuntimeConfig,
    *,
    override: ModelClient | None = None,
) -> ModelClient:
    """Select the model client for live grounded suggestions.

    Tests may pass an explicit override. Otherwise Ollama is used only when the
    provider, real-model gate, and live-output gate are all enabled.
    """

    if override is not None:
        return override

    if (
        config.provider == "ollama"
        and config.real_model_enabled
        and config.live_output_enabled
    ):
        return OllamaClient(
            model=config.configured_model,
            base_url=config.ollama_base_url,
            timeout_seconds=config.timeout_seconds,
        )

    return DeterministicGroundedModelClient()


def run_local_model_smoke(
    config: LocalModelRuntimeConfig,
    *,
    execute_real: bool = False,
    model_client: ModelClient | None = None,
) -> LocalModelSmokeResult:
    """Run a safe local model smoke check.

    By default this is deterministic and does not call Ollama. A real Ollama call
    requires both `execute_real=True` and `INTERROGAITION_ENABLE_REAL_MODEL=1`.
    """

    real_model_invoked = False
    if execute_real:
        if config.provider != "ollama":
            return LocalModelSmokeResult(
                ok=False,
                provider=config.provider,
                model=config.configured_model,
                real_model_invoked=False,
                detail="Real smoke requires provider=ollama.",
            )
        if not config.real_model_enabled:
            return LocalModelSmokeResult(
                ok=False,
                provider=config.provider,
                model=config.configured_model,
                real_model_invoked=False,
                detail="Real model execution is disabled by configuration.",
            )
        client = model_client or OllamaClient(
            model=config.configured_model,
            base_url=config.ollama_base_url,
            timeout_seconds=config.timeout_seconds,
        )
        real_model_invoked = model_client is None
    else:
        client = model_client or FakeModelClient(
            response_text='{"status":"ok","mode":"deterministic-smoke"}',
            model="deterministic-smoke",
        )

    request = ModelRequest(
        system_prompt="Return a compact JSON object for a local model smoke check.",
        user_prompt='{"task":"interrogaition-local-model-smoke","sensitive_data":false}',
        temperature=config.temperature,
    )

    try:
        response = client.complete(request)
    except Exception as exc:  # pragma: no cover - exercised with unavailable real runtimes
        return LocalModelSmokeResult(
            ok=False,
            provider=config.provider,
            model=config.configured_model,
            real_model_invoked=real_model_invoked,
            detail=f"Smoke check failed: {exc}",
        )

    response_preview = response.text.strip()[:240]
    return LocalModelSmokeResult(
        ok=bool(response_preview),
        provider=config.provider,
        model=response.model,
        real_model_invoked=real_model_invoked,
        detail="Smoke check completed.",
        response_preview=response_preview,
        prompt_tokens=response.prompt_tokens,
        completion_tokens=response.completion_tokens,
    )


def _parse_bool(value: str | None) -> bool:
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _parse_int(value: str | None, *, default: int) -> int:
    if value is None:
        return default
    try:
        parsed = int(value)
    except ValueError:
        return default
    return parsed if parsed > 0 else default


def _parse_float(value: str | None, *, default: float) -> float:
    if value is None:
        return default
    try:
        parsed = float(value)
    except ValueError:
        return default
    return parsed if 0 <= parsed <= 2 else default
