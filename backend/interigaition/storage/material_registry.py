"""Workspace-bound source material registry."""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from pathlib import Path
from typing import Any

from interigaition.security.case_workspace import (
    CaseWorkspace,
    DataSensitivity,
    StorageMode,
)


MATERIAL_REGISTRY_SCHEMA_VERSION = 1
_SAFE_IDENTIFIER = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$")


class MaterialRegistryError(ValueError):
    """Raised when source material cannot be registered or verified safely."""


class MaterialSourceType(StrEnum):
    TEXT_NOTE = "text_note"
    CASE_PROTOCOL = "case_protocol"
    AUDIO_TRANSCRIPT = "audio_transcript"
    EXTERNAL_DOCUMENT = "external_document"
    USER_NOTE = "user_note"


@dataclass(frozen=True)
class MaterialRecord:
    id: str
    workspace_id: str
    case_id: str
    title: str
    description: str
    source_type: MaterialSourceType
    data_sensitivity: DataSensitivity
    mime_type: str
    original_name: str
    relative_path: str
    sha256: str
    size_bytes: int
    tags: tuple[str, ...]
    created_by: str
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))


@dataclass(frozen=True)
class MaterialVerification:
    material_id: str
    verified: bool
    exists: bool
    sha256_matches: bool
    size_matches: bool
    expected_sha256: str
    actual_sha256: str | None = None
    expected_size_bytes: int = 0
    actual_size_bytes: int | None = None


class MaterialRegistry:
    """Stores source material metadata inside a case workspace."""

    def __init__(self, workspace: CaseWorkspace) -> None:
        self.workspace = workspace
        self.imports_root = workspace.directory("imports")
        self.materials_root = self.imports_root / "materials"
        self.registry_path = self.imports_root / "materials.json"

    def list_materials(self) -> tuple[MaterialRecord, ...]:
        return self._read_registry()

    def register_text_material(
        self,
        *,
        material_id: str,
        title: str,
        content: str,
        created_by: str,
        source_type: MaterialSourceType = MaterialSourceType.TEXT_NOTE,
        data_sensitivity: DataSensitivity = DataSensitivity.SYNTHETIC,
        description: str = "",
        tags: tuple[str, ...] = (),
        mime_type: str = "text/plain",
        original_name: str | None = None,
        created_at: datetime | None = None,
    ) -> MaterialRecord:
        _require_safe_identifier("material_id", material_id)
        _require_safe_identifier("created_by", created_by)
        _require_non_empty("title", title)
        _require_non_empty("content", content)
        _require_safe_tags(tags)
        self._require_sensitivity_allowed(data_sensitivity)

        existing_records = self._read_registry()
        if any(record.id == material_id for record in existing_records):
            raise MaterialRegistryError(f"Material already exists: {material_id}.")

        content_bytes = content.encode("utf-8")
        material_path = (self.materials_root / f"{material_id}.txt").resolve()
        _require_inside_workspace(self.workspace.root_path, material_path)
        if material_path.exists():
            raise MaterialRegistryError(f"Material file already exists: {material_id}.")

        self.materials_root.mkdir(parents=True, exist_ok=True)
        material_path.write_bytes(content_bytes)
        relative_path = _relative_workspace_path(self.workspace.root_path, material_path)
        record = MaterialRecord(
            id=material_id,
            workspace_id=self.workspace.manifest.workspace_id,
            case_id=self.workspace.manifest.case_id,
            title=title.strip(),
            description=description.strip(),
            source_type=source_type,
            data_sensitivity=data_sensitivity,
            mime_type=mime_type,
            original_name=original_name or f"{material_id}.txt",
            relative_path=relative_path,
            sha256=hashlib.sha256(content_bytes).hexdigest(),
            size_bytes=len(content_bytes),
            tags=tuple(tag.strip() for tag in tags),
            created_by=created_by,
            created_at=created_at or datetime.now(UTC),
        )
        self._write_registry((*existing_records, record))
        return record

    def verify_material(self, material_id: str) -> MaterialVerification:
        _require_safe_identifier("material_id", material_id)
        record = self._find_material(material_id)
        path = _safe_workspace_path(self.workspace.root_path, record.relative_path)

        if not path.exists():
            return MaterialVerification(
                material_id=record.id,
                verified=False,
                exists=False,
                sha256_matches=False,
                size_matches=False,
                expected_sha256=record.sha256,
                expected_size_bytes=record.size_bytes,
            )

        actual_sha256 = _sha256_file(path)
        actual_size = path.stat().st_size
        sha256_matches = actual_sha256 == record.sha256
        size_matches = actual_size == record.size_bytes
        return MaterialVerification(
            material_id=record.id,
            verified=sha256_matches and size_matches,
            exists=True,
            sha256_matches=sha256_matches,
            size_matches=size_matches,
            expected_sha256=record.sha256,
            actual_sha256=actual_sha256,
            expected_size_bytes=record.size_bytes,
            actual_size_bytes=actual_size,
        )

    def read_material_text(self, material_id: str) -> str:
        """Read registered text material through the workspace boundary."""

        _require_safe_identifier("material_id", material_id)
        record = self._find_material(material_id)
        if record.mime_type != "text/plain":
            raise MaterialRegistryError(f"Material is not text/plain: {material_id}.")

        path = _safe_workspace_path(self.workspace.root_path, record.relative_path)
        if not path.exists():
            raise MaterialRegistryError(f"Material file is missing: {material_id}.")

        return path.read_text(encoding="utf-8")

    def _find_material(self, material_id: str) -> MaterialRecord:
        for record in self._read_registry():
            if record.id == material_id:
                return record
        raise MaterialRegistryError(f"Unknown material: {material_id}.")

    def _require_sensitivity_allowed(self, data_sensitivity: DataSensitivity) -> None:
        if (
            data_sensitivity != DataSensitivity.SYNTHETIC
            and self.workspace.manifest.storage_mode == StorageMode.PLAIN_SQLITE_PROTOTYPE
        ):
            raise MaterialRegistryError(
                "Non-synthetic material requires encrypted workspace storage."
            )

    def _read_registry(self) -> tuple[MaterialRecord, ...]:
        if not self.registry_path.exists():
            return ()

        raw = json.loads(self.registry_path.read_text(encoding="utf-8"))
        if raw.get("schema_version") != MATERIAL_REGISTRY_SCHEMA_VERSION:
            raise MaterialRegistryError("Unsupported material registry schema version.")
        if (
            raw.get("workspace_id") != self.workspace.manifest.workspace_id
            or raw.get("case_id") != self.workspace.manifest.case_id
        ):
            raise MaterialRegistryError("Material registry does not match the workspace manifest.")

        return tuple(_record_from_dict(item) for item in raw.get("materials", []))

    def _write_registry(self, records: tuple[MaterialRecord, ...]) -> None:
        self.imports_root.mkdir(parents=True, exist_ok=True)
        ordered_records = sorted(records, key=lambda record: record.id)
        payload = {
            "schema_version": MATERIAL_REGISTRY_SCHEMA_VERSION,
            "workspace_id": self.workspace.manifest.workspace_id,
            "case_id": self.workspace.manifest.case_id,
            "materials": [_record_to_dict(record) for record in ordered_records],
        }
        self.registry_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True),
            encoding="utf-8",
        )


def _record_to_dict(record: MaterialRecord) -> dict[str, Any]:
    return {
        "id": record.id,
        "workspace_id": record.workspace_id,
        "case_id": record.case_id,
        "title": record.title,
        "description": record.description,
        "source_type": record.source_type.value,
        "data_sensitivity": record.data_sensitivity.value,
        "mime_type": record.mime_type,
        "original_name": record.original_name,
        "relative_path": record.relative_path,
        "sha256": record.sha256,
        "size_bytes": record.size_bytes,
        "tags": list(record.tags),
        "created_by": record.created_by,
        "created_at": record.created_at.isoformat(),
    }


def _record_from_dict(raw: dict[str, Any]) -> MaterialRecord:
    return MaterialRecord(
        id=str(raw["id"]),
        workspace_id=str(raw["workspace_id"]),
        case_id=str(raw["case_id"]),
        title=str(raw["title"]),
        description=str(raw.get("description", "")),
        source_type=MaterialSourceType(str(raw["source_type"])),
        data_sensitivity=DataSensitivity(str(raw["data_sensitivity"])),
        mime_type=str(raw["mime_type"]),
        original_name=str(raw["original_name"]),
        relative_path=str(raw["relative_path"]),
        sha256=str(raw["sha256"]),
        size_bytes=int(raw["size_bytes"]),
        tags=tuple(str(tag) for tag in raw.get("tags", [])),
        created_by=str(raw["created_by"]),
        created_at=datetime.fromisoformat(str(raw["created_at"])),
    )


def _require_safe_identifier(field_name: str, value: str) -> None:
    if not _SAFE_IDENTIFIER.fullmatch(value):
        raise MaterialRegistryError(f"{field_name} is not a safe identifier.")


def _require_non_empty(field_name: str, value: str) -> None:
    if not value.strip():
        raise MaterialRegistryError(f"{field_name} cannot be empty.")


def _require_safe_tags(tags: tuple[str, ...]) -> None:
    for tag in tags:
        if not tag.strip() or len(tag.strip()) > 64:
            raise MaterialRegistryError("Material tags must be non-empty and at most 64 characters.")


def _relative_workspace_path(root_path: Path, path: Path) -> str:
    try:
        return path.relative_to(root_path.resolve()).as_posix()
    except ValueError as exc:
        raise MaterialRegistryError("Material path escaped the workspace root.") from exc


def _safe_workspace_path(root_path: Path, relative_path: str) -> Path:
    path = (root_path / relative_path).resolve()
    _require_inside_workspace(root_path, path)
    return path


def _require_inside_workspace(root_path: Path, path: Path) -> None:
    root = root_path.resolve()
    target = path.resolve()
    if target != root and root not in target.parents:
        raise MaterialRegistryError("Material path escaped the workspace root.")


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()
