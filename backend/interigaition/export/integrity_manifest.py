"""Integrity manifests for local report exports."""

from __future__ import annotations

import hashlib
import json
import uuid
from dataclasses import dataclass, field, replace
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Iterable


EXPORT_MANIFEST_SCHEMA_VERSION = 1


class ExportIntegrityError(ValueError):
    """Raised when an export manifest cannot be created or loaded safely."""


@dataclass(frozen=True)
class ExportFileRecord:
    path: str
    sha256: str
    size_bytes: int


@dataclass(frozen=True)
class ExportManifest:
    export_id: str
    case_id: str
    created_by: str
    created_at: datetime
    files: tuple[ExportFileRecord, ...]
    schema_version: int = EXPORT_MANIFEST_SCHEMA_VERSION
    manifest_hash: str | None = None


@dataclass(frozen=True)
class ExportVerification:
    verified: bool
    manifest_hash_valid: bool
    missing_files: tuple[str, ...] = ()
    changed_files: tuple[str, ...] = ()
    unexpected_errors: tuple[str, ...] = ()


def create_export_manifest(
    *,
    case_id: str,
    created_by: str,
    files: Iterable[Path],
    root_path: Path,
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
    )
    return replace(manifest, manifest_hash=calculate_manifest_hash(manifest))


def write_export_manifest(path: Path, manifest: ExportManifest) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(_manifest_to_dict(manifest), ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )


def read_export_manifest(path: Path) -> ExportManifest:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if raw.get("schema_version") != EXPORT_MANIFEST_SCHEMA_VERSION:
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
        schema_version=int(raw["schema_version"]),
        manifest_hash=str(raw["manifest_hash"]) if raw.get("manifest_hash") else None,
    )


def verify_export_manifest(manifest: ExportManifest, *, root_path: Path) -> ExportVerification:
    root = root_path.resolve()
    missing_files: list[str] = []
    changed_files: list[str] = []
    unexpected_errors: list[str] = []
    manifest_hash_valid = manifest.manifest_hash == calculate_manifest_hash(manifest)

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

    return ExportVerification(
        verified=(
            manifest_hash_valid
            and not missing_files
            and not changed_files
            and not unexpected_errors
        ),
        manifest_hash_valid=manifest_hash_valid,
        missing_files=tuple(missing_files),
        changed_files=tuple(changed_files),
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
    path = (root_path / relative_path).resolve()
    if root_path != path and root_path not in path.parents:
        raise ExportIntegrityError("Manifest path escaped the export root.")
    return path


def _manifest_to_dict(manifest: ExportManifest) -> dict[str, Any]:
    return {
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


def _canonical_manifest_payload(manifest: ExportManifest) -> str:
    payload = _manifest_to_dict(replace(manifest, manifest_hash=None))
    return json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
