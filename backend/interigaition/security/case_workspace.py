"""Per-case local workspace metadata and filesystem boundaries."""

from __future__ import annotations

import json
import re
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from pathlib import Path
from typing import Any, Callable

from interigaition.security.encryption_status import (
    EncryptionStatus,
    inspect_sqlcipher_status,
)


WORKSPACE_SCHEMA_VERSION = 1
WORKSPACE_DIRECTORIES = ("imports", "sessions", "exports", "audit", "models")
_SAFE_IDENTIFIER = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$")


class WorkspaceError(ValueError):
    """Raised when a workspace cannot be created or loaded safely."""


class WorkspaceStatus(StrEnum):
    ACTIVE = "active"
    SEALED = "sealed"
    ARCHIVED = "archived"


class DataSensitivity(StrEnum):
    SYNTHETIC = "synthetic"
    ANONYMIZED = "anonymized"
    SENSITIVE = "sensitive"


class StorageMode(StrEnum):
    PLAIN_SQLITE_PROTOTYPE = "plain_sqlite_prototype"
    ENCRYPTED_REQUIRED = "encrypted_required"


@dataclass(frozen=True)
class CaseWorkspaceManifest:
    workspace_id: str
    case_id: str
    created_by: str
    created_at: datetime
    status: WorkspaceStatus = WorkspaceStatus.ACTIVE
    data_sensitivity: DataSensitivity = DataSensitivity.SYNTHETIC
    storage_mode: StorageMode = StorageMode.PLAIN_SQLITE_PROTOTYPE
    schema_version: int = WORKSPACE_SCHEMA_VERSION
    directories: dict[str, str] = field(
        default_factory=lambda: {name: name for name in WORKSPACE_DIRECTORIES}
    )

    @property
    def allows_sensitive_material(self) -> bool:
        return self.storage_mode != StorageMode.PLAIN_SQLITE_PROTOTYPE


@dataclass(frozen=True)
class CaseWorkspace:
    root_path: Path
    manifest: CaseWorkspaceManifest

    @property
    def manifest_path(self) -> Path:
        return self.root_path / "workspace.json"

    def directory(self, name: str) -> Path:
        try:
            relative = self.manifest.directories[name]
        except KeyError as exc:
            raise WorkspaceError(f"Unknown workspace directory: {name}.") from exc

        path = (self.root_path / relative).resolve()
        _require_inside_workspace(self.root_path, path)
        return path


class CaseWorkspaceManager:
    """Creates and opens local per-case workspace directories."""

    def __init__(
        self,
        root_path: Path | str,
        encryption_status_provider: Callable[[], EncryptionStatus] | None = None,
    ) -> None:
        self.root_path = Path(root_path).resolve()
        self._encryption_status_provider = encryption_status_provider or inspect_sqlcipher_status

    def encryption_status(self) -> EncryptionStatus:
        return self._encryption_status_provider()

    def create_workspace(
        self,
        *,
        case_id: str,
        created_by: str,
        data_sensitivity: DataSensitivity = DataSensitivity.SYNTHETIC,
        storage_mode: StorageMode = StorageMode.PLAIN_SQLITE_PROTOTYPE,
        workspace_id: str | None = None,
    ) -> CaseWorkspace:
        _require_safe_identifier("case_id", case_id)
        _require_safe_identifier("created_by", created_by)
        if workspace_id is not None:
            _require_safe_identifier("workspace_id", workspace_id)

        if (
            data_sensitivity != DataSensitivity.SYNTHETIC
            and storage_mode == StorageMode.PLAIN_SQLITE_PROTOTYPE
        ):
            raise WorkspaceError(
                "Non-synthetic case material requires encrypted workspace storage."
            )
        if storage_mode == StorageMode.ENCRYPTED_REQUIRED:
            encryption_status = self.encryption_status()
            if not encryption_status.available:
                raise WorkspaceError(
                    "Encrypted workspace storage is not available: "
                    f"{encryption_status.detail}"
                )

        effective_workspace_id = workspace_id or f"{case_id}-{uuid.uuid4().hex[:12]}"
        workspace_root = (self.root_path / effective_workspace_id).resolve()
        _require_inside_workspace(self.root_path, workspace_root)

        if workspace_root.exists():
            raise WorkspaceError(f"Workspace already exists: {effective_workspace_id}.")

        manifest = CaseWorkspaceManifest(
            workspace_id=effective_workspace_id,
            case_id=case_id,
            created_by=created_by,
            created_at=datetime.now(UTC),
            data_sensitivity=data_sensitivity,
            storage_mode=storage_mode,
        )
        workspace_root.mkdir(parents=True, exist_ok=False)
        for relative in manifest.directories.values():
            directory = (workspace_root / relative).resolve()
            _require_inside_workspace(workspace_root, directory)
            directory.mkdir(parents=True, exist_ok=False)

        workspace = CaseWorkspace(root_path=workspace_root, manifest=manifest)
        _write_manifest(workspace.manifest_path, manifest)
        return workspace

    def open_workspace(self, workspace_id: str) -> CaseWorkspace:
        _require_safe_identifier("workspace_id", workspace_id)
        workspace_root = (self.root_path / workspace_id).resolve()
        _require_inside_workspace(self.root_path, workspace_root)
        manifest_path = workspace_root / "workspace.json"
        if not manifest_path.exists():
            raise WorkspaceError(f"Workspace manifest not found: {workspace_id}.")

        manifest = _read_manifest(manifest_path)
        if manifest.workspace_id != workspace_id:
            raise WorkspaceError("Workspace manifest id does not match directory id.")

        return CaseWorkspace(root_path=workspace_root, manifest=manifest)


def _write_manifest(path: Path, manifest: CaseWorkspaceManifest) -> None:
    path.write_text(
        json.dumps(_manifest_to_dict(manifest), ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )


def _read_manifest(path: Path) -> CaseWorkspaceManifest:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if raw.get("schema_version") != WORKSPACE_SCHEMA_VERSION:
        raise WorkspaceError("Unsupported workspace manifest schema version.")

    directories = raw.get("directories", {})
    if set(directories) != set(WORKSPACE_DIRECTORIES):
        raise WorkspaceError("Workspace manifest has unexpected directory entries.")

    return CaseWorkspaceManifest(
        workspace_id=str(raw["workspace_id"]),
        case_id=str(raw["case_id"]),
        created_by=str(raw["created_by"]),
        created_at=datetime.fromisoformat(str(raw["created_at"])),
        status=WorkspaceStatus(str(raw["status"])),
        data_sensitivity=DataSensitivity(str(raw["data_sensitivity"])),
        storage_mode=StorageMode(str(raw["storage_mode"])),
        schema_version=int(raw["schema_version"]),
        directories={str(key): str(value) for key, value in directories.items()},
    )


def _manifest_to_dict(manifest: CaseWorkspaceManifest) -> dict[str, Any]:
    return {
        "schema_version": manifest.schema_version,
        "workspace_id": manifest.workspace_id,
        "case_id": manifest.case_id,
        "created_by": manifest.created_by,
        "created_at": manifest.created_at.isoformat(),
        "status": manifest.status.value,
        "data_sensitivity": manifest.data_sensitivity.value,
        "storage_mode": manifest.storage_mode.value,
        "directories": manifest.directories,
    }


def _require_safe_identifier(field_name: str, value: str) -> None:
    if not _SAFE_IDENTIFIER.fullmatch(value):
        raise WorkspaceError(f"{field_name} is not a safe workspace identifier.")


def _require_inside_workspace(root_path: Path, path: Path) -> None:
    root = root_path.resolve()
    target = path.resolve()
    if target != root and root not in target.parents:
        raise WorkspaceError("Workspace path escaped its configured root.")
