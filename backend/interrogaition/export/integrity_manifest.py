"""Integrity manifests for local report exports."""

from __future__ import annotations

import hashlib
import json
import uuid
from dataclasses import dataclass, field, replace
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Iterable

from interrogaition.security.case_workspace import CaseWorkspace
from interrogaition.security.model_artifacts import (
    ModelArtifactManifest,
    list_model_artifact_manifest,
)

EXPORT_MANIFEST_SCHEMA_VERSION = 2
SUPPORTED_EXPORT_MANIFEST_SCHEMA_VERSIONS = (1, EXPORT_MANIFEST_SCHEMA_VERSION)


class ExportIntegrityError(ValueError):
    """Raised when an export manifest cannot be created or loaded safely."""


@dataclass(frozen=True)
class ExportFileRecord:
    path: str
    sha256: str
    size_bytes: int


@dataclass(frozen=True)
class ExportModelArtifactRecord:
    artifact_id: str
    artifact_type: str
    relative_path: str
    sha256: str
    size_bytes: int
    record_hash: str | None


@dataclass(frozen=True)
class ExportModelArtifactManifestReference:
    workspace_id: str
    manifest_path: str
    manifest_sha256: str | None
    record_count: int
    chain_valid: bool
    latest_record_hash: str | None
    records: tuple[ExportModelArtifactRecord, ...] = ()


@dataclass(frozen=True)
class ExportManifest:
    export_id: str
    case_id: str
    created_by: str
    created_at: datetime
    files: tuple[ExportFileRecord, ...]
    model_artifacts: ExportModelArtifactManifestReference | None = None
    schema_version: int = EXPORT_MANIFEST_SCHEMA_VERSION
    manifest_hash: str | None = None


@dataclass(frozen=True)
class ExportVerification:
    verified: bool
    manifest_hash_valid: bool
    missing_files: tuple[str, ...] = ()
    changed_files: tuple[str, ...] = ()
    model_artifact_manifest_hash_valid: bool = True
    model_artifact_chain_valid: bool = True
    missing_model_artifact_files: tuple[str, ...] = ()
    changed_model_artifact_files: tuple[str, ...] = ()
    unexpected_errors: tuple[str, ...] = ()


def create_export_manifest(
    *,
    case_id: str,
    created_by: str,
    files: Iterable[Path],
    root_path: Path,
    model_artifacts: ExportModelArtifactManifestReference | None = None,
    export_id: str | None = None,
    created_at: datetime | None = None,
) -> ExportManifest:
    """Create a manifest for files inside an export directory."""

    root = root_path.resolve()
    records = tuple(
        _record_file(path=path.resolve(), root_path=root)
        for path in sorted(files, key=lambda item: item.resolve().as_posix())
    )
    manifest = ExportManifest(
        export_id=export_id or f"export-{uuid.uuid4()}",
        case_id=case_id,
        created_by=created_by,
        created_at=created_at or datetime.now(UTC),
        files=records,
        model_artifacts=model_artifacts,
    )
    return replace(manifest, manifest_hash=calculate_manifest_hash(manifest))


def create_model_artifact_manifest_reference(
    workspace: CaseWorkspace,
) -> ExportModelArtifactManifestReference:
    """Create an export integrity reference to a workspace model artifact manifest."""

    manifest = list_model_artifact_manifest(workspace)
    manifest_path = workspace.root_path / manifest.manifest_path
    manifest_sha256 = sha256_file(manifest_path) if manifest_path.exists() else None
    return _model_artifact_manifest_reference_from_manifest(
        manifest,
        manifest_sha256=manifest_sha256,
    )


def write_export_manifest(path: Path, manifest: ExportManifest) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(_manifest_to_dict(manifest), ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )


def read_export_manifest(path: Path) -> ExportManifest:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if raw.get("schema_version") not in SUPPORTED_EXPORT_MANIFEST_SCHEMA_VERSIONS:
        raise ExportIntegrityError("Unsupported export manifest schema version.")

    return ExportManifest(
        export_id=str(raw["export_id"]),
        case_id=str(raw["case_id"]),
        created_by=str(raw["created_by"]),
        created_at=datetime.fromisoformat(str(raw["created_at"])),
        files=tuple(
            ExportFileRecord(
                path=str(item["path"]),
                sha256=str(item["sha256"]),
                size_bytes=int(item["size_bytes"]),
            )
            for item in raw["files"]
        ),
        model_artifacts=_model_artifact_reference_from_dict(raw.get("model_artifacts")),
        schema_version=int(raw["schema_version"]),
        manifest_hash=str(raw["manifest_hash"]) if raw.get("manifest_hash") else None,
    )


def verify_export_manifest(
    manifest: ExportManifest,
    *,
    root_path: Path,
    workspace_root_path: Path | None = None,
) -> ExportVerification:
    root = root_path.resolve()
    missing_files: list[str] = []
    changed_files: list[str] = []
    missing_model_artifact_files: list[str] = []
    changed_model_artifact_files: list[str] = []
    unexpected_errors: list[str] = []
    manifest_hash_valid = manifest.manifest_hash == calculate_manifest_hash(manifest)
    model_artifact_manifest_hash_valid = True
    model_artifact_chain_valid = True

    for record in manifest.files:
        try:
            path = _safe_export_path(root, record.path)
            if not path.exists():
                missing_files.append(record.path)
                continue

            if path.stat().st_size != record.size_bytes or sha256_file(path) != record.sha256:
                changed_files.append(record.path)
        except Exception as exc:
            unexpected_errors.append(f"{record.path}: {exc}")

    if manifest.model_artifacts is not None:
        model_artifact_chain_valid = manifest.model_artifacts.chain_valid
        if workspace_root_path is None:
            unexpected_errors.append("model_artifacts: workspace_root_path is required for verification.")
        else:
            workspace_root = workspace_root_path.resolve()
            try:
                manifest_path = _safe_relative_path(
                    workspace_root,
                    manifest.model_artifacts.manifest_path,
                    "Model artifact manifest path escaped the workspace root.",
                )
                expected_manifest_hash = manifest.model_artifacts.manifest_sha256
                if expected_manifest_hash is None:
                    if manifest_path.exists():
                        changed_model_artifact_files.append(manifest.model_artifacts.manifest_path)
                        model_artifact_manifest_hash_valid = False
                elif not manifest_path.exists():
                    missing_model_artifact_files.append(manifest.model_artifacts.manifest_path)
                    model_artifact_manifest_hash_valid = False
                elif sha256_file(manifest_path) != expected_manifest_hash:
                    changed_model_artifact_files.append(manifest.model_artifacts.manifest_path)
                    model_artifact_manifest_hash_valid = False
            except Exception as exc:
                model_artifact_manifest_hash_valid = False
                unexpected_errors.append(f"{manifest.model_artifacts.manifest_path}: {exc}")

            for record in manifest.model_artifacts.records:
                try:
                    path = _safe_relative_path(
                        workspace_root,
                        record.relative_path,
                        "Model artifact path escaped the workspace root.",
                    )
                    if not path.exists():
                        missing_model_artifact_files.append(record.relative_path)
                        continue
                    if path.stat().st_size != record.size_bytes or sha256_file(path) != record.sha256:
                        changed_model_artifact_files.append(record.relative_path)
                except Exception as exc:
                    unexpected_errors.append(f"{record.relative_path}: {exc}")

    return ExportVerification(
        verified=(
            manifest_hash_valid
            and model_artifact_manifest_hash_valid
            and model_artifact_chain_valid
            and not missing_files
            and not changed_files
            and not missing_model_artifact_files
            and not changed_model_artifact_files
            and not unexpected_errors
        ),
        manifest_hash_valid=manifest_hash_valid,
        missing_files=tuple(missing_files),
        changed_files=tuple(changed_files),
        model_artifact_manifest_hash_valid=model_artifact_manifest_hash_valid,
        model_artifact_chain_valid=model_artifact_chain_valid,
        missing_model_artifact_files=tuple(missing_model_artifact_files),
        changed_model_artifact_files=tuple(changed_model_artifact_files),
        unexpected_errors=tuple(unexpected_errors),
    )


def calculate_manifest_hash(manifest: ExportManifest) -> str:
    return hashlib.sha256(_canonical_manifest_payload(manifest).encode("utf-8")).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _record_file(*, path: Path, root_path: Path) -> ExportFileRecord:
    if not path.is_file():
        raise ExportIntegrityError(f"Export path is not a file: {path}.")

    relative_path = _relative_export_path(root_path, path)
    return ExportFileRecord(
        path=relative_path,
        sha256=sha256_file(path),
        size_bytes=path.stat().st_size,
    )


def _relative_export_path(root_path: Path, path: Path) -> str:
    try:
        return path.relative_to(root_path).as_posix()
    except ValueError as exc:
        raise ExportIntegrityError("Export file escaped the export root.") from exc


def _safe_export_path(root_path: Path, relative_path: str) -> Path:
    return _safe_relative_path(
        root_path,
        relative_path,
        "Manifest path escaped the export root.",
    )


def _manifest_to_dict(manifest: ExportManifest) -> dict[str, Any]:
    payload = {
        "schema_version": manifest.schema_version,
        "export_id": manifest.export_id,
        "case_id": manifest.case_id,
        "created_by": manifest.created_by,
        "created_at": manifest.created_at.isoformat(),
        "files": [
            {
                "path": record.path,
                "sha256": record.sha256,
                "size_bytes": record.size_bytes,
            }
            for record in manifest.files
        ],
        "manifest_hash": manifest.manifest_hash,
    }
    if manifest.schema_version >= 2 or manifest.model_artifacts is not None:
        payload["model_artifacts"] = (
            _model_artifact_reference_to_dict(manifest.model_artifacts)
            if manifest.model_artifacts
            else None
        )

    return payload


def _canonical_manifest_payload(manifest: ExportManifest) -> str:
    payload = _manifest_to_dict(replace(manifest, manifest_hash=None))
    return json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )


def _safe_relative_path(root_path: Path, relative_path: str, error_message: str) -> Path:
    path = (root_path / relative_path).resolve()
    if root_path != path and root_path not in path.parents:
        raise ExportIntegrityError(error_message)
    return path


def _model_artifact_manifest_reference_from_manifest(
    manifest: ModelArtifactManifest,
    *,
    manifest_sha256: str | None,
) -> ExportModelArtifactManifestReference:
    return ExportModelArtifactManifestReference(
        workspace_id=manifest.workspace_id,
        manifest_path=manifest.manifest_path,
        manifest_sha256=manifest_sha256,
        record_count=manifest.record_count,
        chain_valid=manifest.chain_valid,
        latest_record_hash=manifest.latest_record_hash,
        records=tuple(
            ExportModelArtifactRecord(
                artifact_id=record.artifact_id,
                artifact_type=record.artifact_type,
                relative_path=record.relative_path,
                sha256=record.sha256,
                size_bytes=record.size_bytes,
                record_hash=record.record_hash,
            )
            for record in manifest.records
        ),
    )


def _model_artifact_reference_from_dict(
    raw: dict[str, Any] | None,
) -> ExportModelArtifactManifestReference | None:
    if raw is None:
        return None

    return ExportModelArtifactManifestReference(
        workspace_id=str(raw["workspace_id"]),
        manifest_path=str(raw["manifest_path"]),
        manifest_sha256=str(raw["manifest_sha256"]) if raw.get("manifest_sha256") else None,
        record_count=int(raw["record_count"]),
        chain_valid=bool(raw["chain_valid"]),
        latest_record_hash=str(raw["latest_record_hash"]) if raw.get("latest_record_hash") else None,
        records=tuple(
            ExportModelArtifactRecord(
                artifact_id=str(item["artifact_id"]),
                artifact_type=str(item["artifact_type"]),
                relative_path=str(item["relative_path"]),
                sha256=str(item["sha256"]),
                size_bytes=int(item["size_bytes"]),
                record_hash=str(item["record_hash"]) if item.get("record_hash") else None,
            )
            for item in raw.get("records", ())
        ),
    )


def _model_artifact_reference_to_dict(
    reference: ExportModelArtifactManifestReference,
) -> dict[str, Any]:
    return {
        "workspace_id": reference.workspace_id,
        "manifest_path": reference.manifest_path,
        "manifest_sha256": reference.manifest_sha256,
        "record_count": reference.record_count,
        "chain_valid": reference.chain_valid,
        "latest_record_hash": reference.latest_record_hash,
        "records": [
            {
                "artifact_id": record.artifact_id,
                "artifact_type": record.artifact_type,
                "relative_path": record.relative_path,
                "sha256": record.sha256,
                "size_bytes": record.size_bytes,
                "record_hash": record.record_hash,
            }
            for record in reference.records
        ],
    }
