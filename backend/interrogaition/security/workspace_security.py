"""Workspace security posture checks."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from interrogaition.security.case_workspace import (
    CaseWorkspaceManifest,
    DataSensitivity,
    StorageMode,
)
from interrogaition.security.encryption_status import EncryptionBackend, EncryptionStatus


SecurityState = str


@dataclass(frozen=True)
class WorkspaceSecurityIssue:
    code: str
    severity: str
    detail: str
    remediation: str = ""


@dataclass(frozen=True)
class WorkspaceSecurityReport:
    workspace_id: str
    case_id: str
    state: SecurityState
    data_sensitivity: DataSensitivity
    storage_mode: StorageMode
    allows_sensitive_material: bool
    requires_encrypted_storage: bool
    encryption_backend: EncryptionBackend
    encryption_available: bool
    encryption_version: str | None
    encryption_checked_at: datetime
    issue_count: int
    issues: tuple[WorkspaceSecurityIssue, ...]


def assess_workspace_security(
    *,
    manifest: CaseWorkspaceManifest,
    encryption_status: EncryptionStatus,
) -> WorkspaceSecurityReport:
    """Return a workspace-local security gate report."""

    issues: list[WorkspaceSecurityIssue] = []
    requires_encrypted_storage = (
        manifest.data_sensitivity != DataSensitivity.SYNTHETIC
        or manifest.storage_mode == StorageMode.ENCRYPTED_REQUIRED
    )

    if (
        manifest.data_sensitivity != DataSensitivity.SYNTHETIC
        and manifest.storage_mode == StorageMode.PLAIN_SQLITE_PROTOTYPE
    ):
        issues.append(
            WorkspaceSecurityIssue(
                code="non_synthetic_plain_storage",
                severity="error",
                detail="Non-synthetic workspace data is configured for plain prototype storage.",
                remediation="Create or migrate the workspace with encrypted-required storage.",
            )
        )

    if manifest.storage_mode == StorageMode.ENCRYPTED_REQUIRED and not encryption_status.available:
        issues.append(
            WorkspaceSecurityIssue(
                code="encrypted_runtime_unavailable",
                severity="error",
                detail=f"Encrypted storage is required but unavailable: {encryption_status.detail}",
                remediation="Restore SQLCipher support before importing or reviewing protected material.",
            )
        )

    state = _state_from_issues(issues)
    return WorkspaceSecurityReport(
        workspace_id=manifest.workspace_id,
        case_id=manifest.case_id,
        state=state,
        data_sensitivity=manifest.data_sensitivity,
        storage_mode=manifest.storage_mode,
        allows_sensitive_material=manifest.allows_sensitive_material and encryption_status.available,
        requires_encrypted_storage=requires_encrypted_storage,
        encryption_backend=encryption_status.backend,
        encryption_available=encryption_status.available,
        encryption_version=encryption_status.version,
        encryption_checked_at=encryption_status.checked_at,
        issue_count=len(issues),
        issues=tuple(issues),
    )


def _state_from_issues(issues: list[WorkspaceSecurityIssue]) -> SecurityState:
    if any(issue.severity == "error" for issue in issues):
        return "blocked"
    if issues:
        return "warning"
    return "ready"
