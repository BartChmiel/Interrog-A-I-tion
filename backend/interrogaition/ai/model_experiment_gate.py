"""STOP-gated readiness checks for local real-model experiments."""

from __future__ import annotations

from dataclasses import dataclass

from interrogaition.ai.local_model_runtime import LocalModelRuntimeConfig


ExperimentState = str


@dataclass(frozen=True)
class ModelExperimentIssue:
    code: str
    severity: str
    detail: str
    remediation: str = ""


@dataclass(frozen=True)
class ModelExperimentReadinessReport:
    state: ExperimentState
    provider: str
    effective_provider: str
    configured_model: str
    stop_review_approved: bool
    workspace_id: str | None
    workspace_security_state: str | None
    artifact_isolation_state: str | None
    can_run_real_smoke: bool
    can_enable_live_output: bool
    issue_count: int
    issues: tuple[ModelExperimentIssue, ...]


def assess_model_experiment_readiness(
    *,
    config: LocalModelRuntimeConfig,
    stop_review_approved: bool,
    workspace_id: str | None,
    workspace_security_state: str | None,
    artifact_isolation_state: str | None,
) -> ModelExperimentReadinessReport:
    """Return readiness for a controlled local real-model smoke experiment."""

    issues: list[ModelExperimentIssue] = []
    if config.provider not in {"ollama", "bridge"}:
        issues.append(
            ModelExperimentIssue(
                code="real_model_provider_required",
                severity="error",
                detail="Controlled real-model experiments require provider=ollama or provider=bridge.",
                remediation="Set INTERROGAITION_MODEL_PROVIDER=ollama or INTERROGAITION_MODEL_PROVIDER=bridge in the developer shell.",
            )
        )
    if not config.real_model_enabled:
        issues.append(
            ModelExperimentIssue(
                code="real_model_disabled",
                severity="error",
                detail="Real model execution is disabled by configuration.",
                remediation="Set INTERROGAITION_ENABLE_REAL_MODEL=1 only for the approved experiment shell.",
            )
        )
    if config.live_output_enabled:
        issues.append(
            ModelExperimentIssue(
                code="live_output_enabled",
                severity="error",
                detail="Live real-model output is enabled; this gate only approves controlled smoke experiments.",
                remediation="Unset INTERROGAITION_ENABLE_LIVE_MODEL_OUTPUT before running the smoke experiment.",
            )
        )
    if not stop_review_approved:
        issues.append(
            ModelExperimentIssue(
                code="stop_review_required",
                severity="error",
                detail="A strategic STOP review approval is required before a real-model experiment.",
                remediation="Record an audited STOP approval before running the real-model smoke experiment.",
            )
        )
    if workspace_id is None:
        issues.append(
            ModelExperimentIssue(
                code="workspace_required",
                severity="error",
                detail="A workspace is required so experiment prompts, context, and outputs can stay isolated.",
                remediation="Create a workspace and initialize model artifact isolation.",
            )
        )
    if workspace_security_state not in {None, "ready"}:
        issues.append(
            ModelExperimentIssue(
                code="workspace_security_not_ready",
                severity="error",
                detail=f"Workspace security state is {workspace_security_state}.",
                remediation="Resolve workspace security issues before running a model experiment.",
            )
        )
    if artifact_isolation_state not in {None, "ready"}:
        issues.append(
            ModelExperimentIssue(
                code="artifact_isolation_not_ready",
                severity="error",
                detail=f"Model artifact isolation state is {artifact_isolation_state}.",
                remediation="Initialize workspace model artifact isolation before running the experiment.",
            )
        )

    state = _state_from_issues(issues)
    return ModelExperimentReadinessReport(
        state=state,
        provider=config.provider,
        effective_provider=config.effective_provider,
        configured_model=config.configured_model,
        stop_review_approved=stop_review_approved,
        workspace_id=workspace_id,
        workspace_security_state=workspace_security_state,
        artifact_isolation_state=artifact_isolation_state,
        can_run_real_smoke=state == "ready",
        can_enable_live_output=False,
        issue_count=len(issues),
        issues=tuple(issues),
    )


def _state_from_issues(issues: list[ModelExperimentIssue]) -> ExperimentState:
    if any(issue.severity == "error" for issue in issues):
        return "blocked"
    if issues:
        return "warning"
    return "ready"
