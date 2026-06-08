"""Workspace-local model artifact isolation policy.

Model prompts, grounding context snapshots, generated outputs, cache files, and
evaluation artifacts must stay inside the case workspace. This module creates and
reports the prototype directory/policy structure without invoking any model runtime.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from interrogaition.security.case_workspace import CaseWorkspace, WorkspaceError


MODEL_ARTIFACT_SCHEMA_VERSION = 1
MODEL_ARTIFACT_POLICY_FILE = "artifact-policy.json"
MODEL_ARTIFACT_DIRECTORIES = (
    "prompts",
    "contexts",
    "outputs",
    "cache",
    "evaluations",
)


@dataclass(frozen=True)
class ModelArtifactPolicy:
    schema_version: int
    workspace_id: str
    root: str
    directories: dict[str, str]
    created_by: str
    created_at: datetime
    allow_external_cache: bool = False
    allow_network_artifacts: bool = False
    sensitive_material_allowed: bool = False
    notes: tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class ModelArtifactIsolationStatus:
    workspace_id: str
    state: str
    root: str
    policy_path: str
    policy_exists: bool
    missing_directories: tuple[str, ...]
    directory_count: int
    external_cache_allowed: bool
    network_artifacts_allowed: bool
    sensitive_material_allowed: bool
    detail: str
    warnings: tuple[str, ...] = field(default_factory=tuple)


def inspect_model_artifact_isolation(workspace: CaseWorkspace) -> ModelArtifactIsolationStatus:
    models_root = workspace.directory("models")
    policy_path = models_root / MODEL_ARTIFACT_POLICY_FILE
    policy = _read_policy(policy_path)
    missing_directories = tuple(
        name
        for name in MODEL_ARTIFACT_DIRECTORIES
        if not (models_root / name).is_dir()
    )
    warnings: list[str] = []

    if policy is None:
        warnings.append("Model artifact policy manifest is missing.")
    elif policy.workspace_id != workspace.manifest.workspace_id:
        warnings.append("Model artifact policy does not match workspace id.")
    elif set(policy.directories) != set(MODEL_ARTIFACT_DIRECTORIES):
        warnings.append("Model artifact policy directory set is incomplete.")

    if policy and policy.allow_external_cache:
        warnings.append("External model cache is allowed by policy.")
    if policy and policy.allow_network_artifacts:
        warnings.append("Network model artifacts are allowed by policy.")
    if workspace.manifest.allows_sensitive_material and not policy:
        warnings.append("Sensitive-capable workspace has no model artifact policy.")

    if missing_directories or warnings:
        state = "warning"
        detail = "Model artifact isolation needs initialization or review."
    else:
        state = "ready"
        detail = "Model artifacts are isolated inside the workspace models directory."

    return ModelArtifactIsolationStatus(
        workspace_id=workspace.manifest.workspace_id,
        state=state,
        root=_relative_workspace_path(workspace.root_path, models_root),
        policy_path=_relative_workspace_path(workspace.root_path, policy_path),
        policy_exists=policy is not None,
        missing_directories=missing_directories,
        directory_count=len(MODEL_ARTIFACT_DIRECTORIES) - len(missing_directories),
        external_cache_allowed=policy.allow_external_cache if policy else False,
        network_artifacts_allowed=policy.allow_network_artifacts if policy else False,
        sensitive_material_allowed=policy.sensitive_material_allowed if policy else False,
        detail=detail,
        warnings=tuple(warnings),
    )


def ensure_model_artifact_isolation(
    workspace: CaseWorkspace,
    *,
    created_by: str,
) -> ModelArtifactIsolationStatus:
    models_root = workspace.directory("models")
    models_root.mkdir(parents=True, exist_ok=True)
    for directory_name in MODEL_ARTIFACT_DIRECTORIES:
        directory = (models_root / directory_name).resolve()
        _require_inside_workspace(workspace.root_path, directory)
        directory.mkdir(parents=True, exist_ok=True)

    policy = ModelArtifactPolicy(
        schema_version=MODEL_ARTIFACT_SCHEMA_VERSION,
        workspace_id=workspace.manifest.workspace_id,
        root=_relative_workspace_path(workspace.root_path, models_root),
        directories={
            name: _relative_workspace_path(workspace.root_path, models_root / name)
            for name in MODEL_ARTIFACT_DIRECTORIES
        },
        created_by=created_by,
        created_at=datetime.now(UTC),
        sensitive_material_allowed=workspace.manifest.allows_sensitive_material,
        notes=(
            "Store model prompts, context packs, outputs, cache, and evaluations only in this workspace.",
            "Do not store external model cache paths here until deployment policy is approved.",
            "Do not enable live real-model output before STOP review.",
        ),
    )
    policy_path = models_root / MODEL_ARTIFACT_POLICY_FILE
    _write_policy(policy_path, policy)
    return inspect_model_artifact_isolation(workspace)


def _read_policy(path: Path) -> ModelArtifactPolicy | None:
    if not path.exists():
        return None
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        return ModelArtifactPolicy(
            schema_version=int(raw["schema_version"]),
            workspace_id=str(raw["workspace_id"]),
            root=str(raw["root"]),
            directories={str(key): str(value) for key, value in raw["directories"].items()},
            created_by=str(raw["created_by"]),
            created_at=datetime.fromisoformat(str(raw["created_at"])),
            allow_external_cache=bool(raw.get("allow_external_cache", False)),
            allow_network_artifacts=bool(raw.get("allow_network_artifacts", False)),
            sensitive_material_allowed=bool(raw.get("sensitive_material_allowed", False)),
            notes=tuple(str(note) for note in raw.get("notes", ())),
        )
    except (json.JSONDecodeError, OSError, TypeError, KeyError, ValueError):
        return None


def _write_policy(path: Path, policy: ModelArtifactPolicy) -> None:
    payload: dict[str, Any] = {
        "schema_version": policy.schema_version,
        "workspace_id": policy.workspace_id,
        "root": policy.root,
        "directories": policy.directories,
        "created_by": policy.created_by,
        "created_at": policy.created_at.isoformat(),
        "allow_external_cache": policy.allow_external_cache,
        "allow_network_artifacts": policy.allow_network_artifacts,
        "sensitive_material_allowed": policy.sensitive_material_allowed,
        "notes": list(policy.notes),
    }
    path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")


def _relative_workspace_path(root_path: Path, path: Path) -> str:
    try:
        return str(path.resolve().relative_to(root_path.resolve())).replace("\\", "/")
    except ValueError as exc:
        raise WorkspaceError("Model artifact path escaped the workspace root.") from exc


def _require_inside_workspace(root_path: Path, path: Path) -> None:
    try:
        path.resolve().relative_to(root_path.resolve())
    except ValueError as exc:
        raise WorkspaceError("Model artifact path escaped the workspace root.") from exc
