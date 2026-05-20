"""Role-based access decisions for local case workspaces."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from interigaition.security.case_workspace import (
    CaseWorkspaceManifest,
    DataSensitivity,
    StorageMode,
    WorkspaceStatus,
)


class WorkspaceRole(StrEnum):
    ADMIN = "admin"
    PROSECUTOR = "prosecutor"
    INVESTIGATOR = "investigator"
    FORENSIC_EXPERT = "forensic_expert"
    DEFENSE_COUNSEL = "defense_counsel"
    OBSERVER = "observer"


class WorkspaceAction(StrEnum):
    READ_CASE = "read_case"
    WRITE_INTERVIEW = "write_interview"
    RUN_REVIEW = "run_review"
    IMPORT_MATERIAL = "import_material"
    EXPORT_REPORT = "export_report"
    MANAGE_WORKSPACE = "manage_workspace"


@dataclass(frozen=True)
class AccessDecision:
    role: WorkspaceRole
    action: WorkspaceAction
    allowed: bool
    reason: str


_ROLE_ACTIONS: dict[WorkspaceRole, set[WorkspaceAction]] = {
    WorkspaceRole.ADMIN: set(WorkspaceAction),
    WorkspaceRole.PROSECUTOR: {
        WorkspaceAction.READ_CASE,
        WorkspaceAction.WRITE_INTERVIEW,
        WorkspaceAction.RUN_REVIEW,
        WorkspaceAction.IMPORT_MATERIAL,
        WorkspaceAction.EXPORT_REPORT,
        WorkspaceAction.MANAGE_WORKSPACE,
    },
    WorkspaceRole.INVESTIGATOR: {
        WorkspaceAction.READ_CASE,
        WorkspaceAction.WRITE_INTERVIEW,
        WorkspaceAction.RUN_REVIEW,
        WorkspaceAction.IMPORT_MATERIAL,
        WorkspaceAction.EXPORT_REPORT,
    },
    WorkspaceRole.FORENSIC_EXPERT: {
        WorkspaceAction.READ_CASE,
        WorkspaceAction.RUN_REVIEW,
        WorkspaceAction.EXPORT_REPORT,
    },
    WorkspaceRole.DEFENSE_COUNSEL: {
        WorkspaceAction.READ_CASE,
        WorkspaceAction.EXPORT_REPORT,
    },
    WorkspaceRole.OBSERVER: {
        WorkspaceAction.READ_CASE,
    },
}


def decide_workspace_access(
    *,
    role: WorkspaceRole,
    action: WorkspaceAction,
    manifest: CaseWorkspaceManifest,
) -> AccessDecision:
    """Return a deterministic prototype access decision."""

    if action not in _ROLE_ACTIONS[role]:
        return AccessDecision(
            role=role,
            action=action,
            allowed=False,
            reason=f"{role.value} cannot perform {action.value}.",
        )

    if manifest.status != WorkspaceStatus.ACTIVE and action in {
        WorkspaceAction.WRITE_INTERVIEW,
        WorkspaceAction.RUN_REVIEW,
        WorkspaceAction.IMPORT_MATERIAL,
    }:
        return AccessDecision(
            role=role,
            action=action,
            allowed=False,
            reason=f"Workspace is {manifest.status.value}; mutable operations are blocked.",
        )

    if (
        action == WorkspaceAction.IMPORT_MATERIAL
        and manifest.data_sensitivity in {DataSensitivity.ANONYMIZED, DataSensitivity.SENSITIVE}
        and manifest.storage_mode == StorageMode.PLAIN_SQLITE_PROTOTYPE
    ):
        return AccessDecision(
            role=role,
            action=action,
            allowed=False,
            reason="Non-synthetic material requires encrypted workspace storage.",
        )

    return AccessDecision(
        role=role,
        action=action,
        allowed=True,
        reason="Allowed by prototype workspace policy.",
    )
