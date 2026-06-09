"""Workspace-local model artifact isolation policy.

Model prompts, grounding context snapshots, generated outputs, cache files, and
evaluation artifacts must stay inside the case workspace. This module creates and
reports the prototype directory/policy structure without invoking any model runtime.
"""

from __future__ import annotations

import json
import hashlib
import uuid
from dataclasses import dataclass, field, replace
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from interrogaition.security.case_workspace import CaseWorkspace, WorkspaceError


MODEL_ARTIFACT_SCHEMA_VERSION = 1
MODEL_ARTIFACT_POLICY_FILE = "artifact-policy.json"
MODEL_ARTIFACT_MANIFEST_FILE = "artifact-manifest.json"
MAX_MODEL_ARTIFACT_BYTES = 1_000_000
MODEL_ARTIFACT_DIRECTORIES = (
    "prompts",
    "contexts",
    "outputs",
    "cache",
    "evaluations",
)
MODEL_ARTIFACT_TYPES = ("prompt", "context", "output", "cache", "evaluation")
_ARTIFACT_TYPE_DIRECTORIES = {
    "prompt": "prompts",
    "context": "contexts",
    "output": "outputs",
    "cache": "cache",
    "evaluation": "evaluations",
}


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


@dataclass(frozen=True)
class ModelArtifactRecord:
    artifact_id: str
    artifact_type: str
    relative_path: str
    sha256: str
    size_bytes: int
    content_type: str
    source: str
    created_by: str
    created_at: datetime
    metadata: dict[str, Any] = field(default_factory=dict)
    previous_hash: str | None = None
    record_hash: str | None = None


@dataclass(frozen=True)
class ModelArtifactManifest:
    schema_version: int
    workspace_id: str
    manifest_path: str
    record_count: int
    records: tuple[ModelArtifactRecord, ...]
    chain_valid: bool
    latest_record_hash: str | None = None


@dataclass(frozen=True)
class ModelArtifactWriteResult:
    record: ModelArtifactRecord
    manifest: ModelArtifactManifest
    deduplicated: bool = False


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


def list_model_artifact_manifest(workspace: CaseWorkspace) -> ModelArtifactManifest:
    return _read_manifest(workspace)


def write_model_artifact(
    workspace: CaseWorkspace,
    *,
    artifact_type: str,
    content: str,
    created_by: str,
    content_type: str = "application/json",
    source: str = "",
    metadata: dict[str, Any] | None = None,
) -> ModelArtifactWriteResult:
    _require_isolation_ready(workspace)
    artifact_type = artifact_type.strip().lower()
    if artifact_type not in MODEL_ARTIFACT_TYPES:
        raise WorkspaceError(f"Unsupported model artifact type: {artifact_type}.")
    if not created_by.strip():
        raise WorkspaceError("created_by cannot be empty.")
    if not content.strip():
        raise WorkspaceError("model artifact content cannot be empty.")

    content_bytes = content.encode("utf-8")
    if len(content_bytes) > MAX_MODEL_ARTIFACT_BYTES:
        raise WorkspaceError("model artifact content exceeds prototype size limit.")

    manifest = _read_manifest(workspace)
    if not manifest.chain_valid:
        raise WorkspaceError("Model artifact manifest hash chain is invalid.")

    content_hash = hashlib.sha256(content_bytes).hexdigest()
    existing_record = _find_duplicate_record(
        manifest,
        artifact_type=artifact_type,
        sha256=content_hash,
    )
    if existing_record is not None:
        return ModelArtifactWriteResult(
            record=existing_record,
            manifest=manifest,
            deduplicated=True,
        )

    created_at = datetime.now(UTC)
    artifact_id = f"{artifact_type}-{created_at.strftime('%Y%m%dT%H%M%SZ')}-{uuid.uuid4().hex[:8]}"
    extension = "json" if content_type == "application/json" else "txt"
    models_root = workspace.directory("models")
    artifact_dir = (models_root / _ARTIFACT_TYPE_DIRECTORIES[artifact_type]).resolve()
    _require_inside_workspace(workspace.root_path, artifact_dir)
    artifact_path = (artifact_dir / f"{artifact_id}.{extension}").resolve()
    _require_inside_workspace(workspace.root_path, artifact_path)
    artifact_path.write_bytes(content_bytes)

    record = ModelArtifactRecord(
        artifact_id=artifact_id,
        artifact_type=artifact_type,
        relative_path=_relative_workspace_path(workspace.root_path, artifact_path),
        sha256=content_hash,
        size_bytes=len(content_bytes),
        content_type=content_type,
        source=source.strip(),
        created_by=created_by.strip(),
        created_at=created_at,
        metadata=metadata or {},
    )
    manifest = _append_manifest_record(workspace, record)
    return ModelArtifactWriteResult(record=record, manifest=manifest)


def _find_duplicate_record(
    manifest: ModelArtifactManifest,
    *,
    artifact_type: str,
    sha256: str,
) -> ModelArtifactRecord | None:
    for record in manifest.records:
        if record.artifact_type == artifact_type and record.sha256 == sha256:
            return record

    return None


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


def _require_isolation_ready(workspace: CaseWorkspace) -> None:
    status = inspect_model_artifact_isolation(workspace)
    if status.state != "ready":
        raise WorkspaceError("Model artifact isolation must be initialized before writing artifacts.")


def _read_manifest(workspace: CaseWorkspace) -> ModelArtifactManifest:
    models_root = workspace.directory("models")
    manifest_path = models_root / MODEL_ARTIFACT_MANIFEST_FILE
    if not manifest_path.exists():
        return ModelArtifactManifest(
            schema_version=MODEL_ARTIFACT_SCHEMA_VERSION,
            workspace_id=workspace.manifest.workspace_id,
            manifest_path=_relative_workspace_path(workspace.root_path, manifest_path),
            record_count=0,
            records=(),
            chain_valid=True,
        )

    try:
        raw = json.loads(manifest_path.read_text(encoding="utf-8"))
        if raw.get("workspace_id") != workspace.manifest.workspace_id:
            raise WorkspaceError("Model artifact manifest does not match workspace id.")
        records = tuple(_artifact_record_from_dict(item) for item in raw.get("records", ()))
    except WorkspaceError:
        raise
    except (json.JSONDecodeError, OSError, TypeError, KeyError, ValueError) as exc:
        raise WorkspaceError("Model artifact manifest is unreadable.") from exc

    latest_record_hash = records[-1].record_hash if records else None
    return ModelArtifactManifest(
        schema_version=int(raw.get("schema_version", MODEL_ARTIFACT_SCHEMA_VERSION)),
        workspace_id=workspace.manifest.workspace_id,
        manifest_path=_relative_workspace_path(workspace.root_path, manifest_path),
        record_count=len(records),
        records=records,
        chain_valid=_verify_manifest_chain(records),
        latest_record_hash=latest_record_hash,
    )


def _append_manifest_record(
    workspace: CaseWorkspace,
    record: ModelArtifactRecord,
) -> ModelArtifactManifest:
    manifest = _read_manifest(workspace)
    if not manifest.chain_valid:
        raise WorkspaceError("Model artifact manifest hash chain is invalid.")

    chained_record = replace(record, previous_hash=manifest.latest_record_hash)
    chained_record = replace(chained_record, record_hash=_artifact_record_hash(chained_record))
    next_records = (*manifest.records, chained_record)
    models_root = workspace.directory("models")
    manifest_path = models_root / MODEL_ARTIFACT_MANIFEST_FILE
    payload = {
        "schema_version": MODEL_ARTIFACT_SCHEMA_VERSION,
        "workspace_id": workspace.manifest.workspace_id,
        "records": [_artifact_record_to_dict(item) for item in next_records],
    }
    manifest_path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    return _read_manifest(workspace)


def _artifact_record_from_dict(raw: dict[str, Any]) -> ModelArtifactRecord:
    return ModelArtifactRecord(
        artifact_id=str(raw["artifact_id"]),
        artifact_type=str(raw["artifact_type"]),
        relative_path=str(raw["relative_path"]),
        sha256=str(raw["sha256"]),
        size_bytes=int(raw["size_bytes"]),
        content_type=str(raw["content_type"]),
        source=str(raw.get("source", "")),
        created_by=str(raw["created_by"]),
        created_at=datetime.fromisoformat(str(raw["created_at"])),
        metadata=dict(raw.get("metadata", {})),
        previous_hash=raw.get("previous_hash"),
        record_hash=raw.get("record_hash"),
    )


def _artifact_record_to_dict(record: ModelArtifactRecord) -> dict[str, Any]:
    return {
        "artifact_id": record.artifact_id,
        "artifact_type": record.artifact_type,
        "relative_path": record.relative_path,
        "sha256": record.sha256,
        "size_bytes": record.size_bytes,
        "content_type": record.content_type,
        "source": record.source,
        "created_by": record.created_by,
        "created_at": record.created_at.isoformat(),
        "metadata": record.metadata,
        "previous_hash": record.previous_hash,
        "record_hash": record.record_hash,
    }


def _verify_manifest_chain(records: tuple[ModelArtifactRecord, ...]) -> bool:
    previous_hash: str | None = None
    for record in records:
        if record.previous_hash != previous_hash:
            return False
        if record.record_hash != _artifact_record_hash(record):
            return False
        previous_hash = record.record_hash

    return True


def _artifact_record_hash(record: ModelArtifactRecord) -> str:
    payload = {
        "artifact_id": record.artifact_id,
        "artifact_type": record.artifact_type,
        "relative_path": record.relative_path,
        "sha256": record.sha256,
        "size_bytes": record.size_bytes,
        "content_type": record.content_type,
        "source": record.source,
        "created_by": record.created_by,
        "created_at": record.created_at.isoformat(),
        "metadata": record.metadata,
        "previous_hash": record.previous_hash,
    }
    return hashlib.sha256(
        json.dumps(
            payload,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
            default=str,
        ).encode("utf-8")
    ).hexdigest()


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
