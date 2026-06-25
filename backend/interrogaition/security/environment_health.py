"""Local environment readiness checks for the prototype runtime."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from interrogaition.ai.local_model_runtime import LocalModelRuntimeConfig
from interrogaition.security.encryption_status import EncryptionStatus


HealthState = str


@dataclass(frozen=True)
class EnvironmentHealthCheck:
    id: str
    label: str
    state: HealthState
    detail: str
    remediation: str = ""


@dataclass(frozen=True)
class EnvironmentHealthReport:
    state: HealthState
    generated_at: datetime
    checks: tuple[EnvironmentHealthCheck, ...]
    summary: dict[str, int]


def build_environment_health_report(
    *,
    synthetic_cases_root: Path,
    workspace_root: Path,
    encryption_status: EncryptionStatus,
    local_model_config: LocalModelRuntimeConfig,
) -> EnvironmentHealthReport:
    checks = (
        _api_check(),
        _synthetic_cases_check(synthetic_cases_root),
        _workspace_root_check(workspace_root),
        _encryption_check(encryption_status),
        _local_model_check(local_model_config),
    )
    summary = {
        "ready": sum(1 for check in checks if check.state == "ready"),
        "warning": sum(1 for check in checks if check.state == "warning"),
        "blocked": sum(1 for check in checks if check.state == "blocked"),
    }
    if summary["blocked"]:
        state = "blocked"
    elif summary["warning"]:
        state = "warning"
    else:
        state = "ready"

    return EnvironmentHealthReport(
        state=state,
        generated_at=datetime.now(UTC),
        checks=checks,
        summary=summary,
    )


def _api_check() -> EnvironmentHealthCheck:
    return EnvironmentHealthCheck(
        id="api",
        label="Local API",
        state="ready",
        detail="Local API process is responding.",
    )


def _synthetic_cases_check(root: Path) -> EnvironmentHealthCheck:
    if not root.exists():
        return EnvironmentHealthCheck(
            id="synthetic_cases",
            label="Synthetic cases",
            state="blocked",
            detail=f"Synthetic case root does not exist: {root}.",
            remediation="Restore data/synthetic before running prototype workflows.",
        )

    case_files = tuple(root.glob("*/case.json"))
    if not case_files:
        return EnvironmentHealthCheck(
            id="synthetic_cases",
            label="Synthetic cases",
            state="blocked",
            detail=f"No synthetic case.json files found under {root}.",
            remediation="Add at least one synthetic case fixture.",
        )

    return EnvironmentHealthCheck(
        id="synthetic_cases",
        label="Synthetic cases",
        state="ready",
        detail=f"{len(case_files)} synthetic case fixture(s) available.",
    )


def _workspace_root_check(root: Path) -> EnvironmentHealthCheck:
    if root.exists() and root.is_dir():
        return EnvironmentHealthCheck(
            id="workspace_root",
            label="Workspace root",
            state="ready",
            detail=f"Workspace root exists: {root}.",
        )
    if root.parent.exists():
        return EnvironmentHealthCheck(
            id="workspace_root",
            label="Workspace root",
            state="warning",
            detail=f"Workspace root is not created yet: {root}.",
            remediation="Create or open a workspace to initialize the directory.",
        )
    return EnvironmentHealthCheck(
        id="workspace_root",
        label="Workspace root",
        state="blocked",
        detail=f"Workspace parent does not exist: {root.parent}.",
        remediation="Create the local data directory before workspace operations.",
    )


def _encryption_check(status: EncryptionStatus) -> EnvironmentHealthCheck:
    if status.available:
        return EnvironmentHealthCheck(
            id="encryption",
            label="Encrypted storage",
            state="ready",
            detail=f"{status.backend.value} available: {status.version or status.detail}.",
        )

    return EnvironmentHealthCheck(
        id="encryption",
        label="Encrypted storage",
        state="warning",
        detail=f"Encrypted storage is unavailable: {status.detail}.",
        remediation="Use synthetic/plain prototype data only, or install SQLCipher before sensitive imports.",
    )


def _local_model_check(config: LocalModelRuntimeConfig) -> EnvironmentHealthCheck:
    if config.live_output_enabled:
        return EnvironmentHealthCheck(
            id="local_model",
            label="Local model runtime",
            state="blocked",
            detail="Real model live output is enabled before institutional STOP review.",
            remediation="Disable live model output until the STOP review is complete.",
        )
    if config.provider in {"ollama", "bridge"} and config.real_model_enabled:
        return EnvironmentHealthCheck(
            id="local_model",
            label="Local model runtime",
            state="warning",
            detail=f"{config.provider} real-model execution is enabled for {config.configured_model}.",
            remediation="Use only smoke tests until model governance and evaluation are reviewed.",
        )

    return EnvironmentHealthCheck(
        id="local_model",
        label="Local model runtime",
        state="ready",
        detail=f"{config.effective_provider} runtime active; live real-model output is blocked.",
    )
