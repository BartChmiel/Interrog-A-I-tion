import unittest
from dataclasses import replace
from datetime import UTC, datetime

from interrogaition.security.case_workspace import (
    CaseWorkspaceManifest,
    DataSensitivity,
    StorageMode,
)
from interrogaition.security.encryption_status import EncryptionBackend, EncryptionStatus
from interrogaition.security.workspace_security import assess_workspace_security


class WorkspaceSecurityTest(unittest.TestCase):
    def test_plain_synthetic_workspace_is_ready_without_encryption(self) -> None:
        report = assess_workspace_security(
            manifest=_manifest(),
            encryption_status=_unavailable_encryption_status(),
        )

        self.assertEqual(report.state, "ready")
        self.assertFalse(report.requires_encrypted_storage)
        self.assertFalse(report.allows_sensitive_material)
        self.assertEqual(report.issue_count, 0)

    def test_encrypted_anonymized_workspace_is_ready_when_runtime_is_available(self) -> None:
        report = assess_workspace_security(
            manifest=_manifest(
                data_sensitivity=DataSensitivity.ANONYMIZED,
                storage_mode=StorageMode.ENCRYPTED_REQUIRED,
            ),
            encryption_status=_available_encryption_status(),
        )

        self.assertEqual(report.state, "ready")
        self.assertTrue(report.requires_encrypted_storage)
        self.assertTrue(report.allows_sensitive_material)
        self.assertTrue(report.encryption_available)
        self.assertEqual(report.encryption_backend, EncryptionBackend.SQLCIPHER)

    def test_encrypted_workspace_blocks_when_runtime_becomes_unavailable(self) -> None:
        report = assess_workspace_security(
            manifest=_manifest(storage_mode=StorageMode.ENCRYPTED_REQUIRED),
            encryption_status=_unavailable_encryption_status(),
        )

        self.assertEqual(report.state, "blocked")
        self.assertFalse(report.allows_sensitive_material)
        self.assertEqual(report.issue_count, 1)
        self.assertEqual(report.issues[0].code, "encrypted_runtime_unavailable")

    def test_non_synthetic_plain_workspace_is_blocked(self) -> None:
        manifest = replace(
            _manifest(),
            data_sensitivity=DataSensitivity.SENSITIVE,
            storage_mode=StorageMode.PLAIN_SQLITE_PROTOTYPE,
        )

        report = assess_workspace_security(
            manifest=manifest,
            encryption_status=_available_encryption_status(),
        )

        self.assertEqual(report.state, "blocked")
        self.assertFalse(report.allows_sensitive_material)
        self.assertEqual(report.issue_count, 1)
        self.assertEqual(report.issues[0].code, "non_synthetic_plain_storage")


def _manifest(
    *,
    data_sensitivity: DataSensitivity = DataSensitivity.SYNTHETIC,
    storage_mode: StorageMode = StorageMode.PLAIN_SQLITE_PROTOTYPE,
) -> CaseWorkspaceManifest:
    return CaseWorkspaceManifest(
        workspace_id="workspace-001",
        case_id="case-001",
        created_by="investigator-001",
        created_at=datetime(2026, 1, 1, tzinfo=UTC),
        data_sensitivity=data_sensitivity,
        storage_mode=storage_mode,
    )


def _available_encryption_status() -> EncryptionStatus:
    return EncryptionStatus(
        backend=EncryptionBackend.SQLCIPHER,
        available=True,
        version="4.0-test",
        detail="SQLCipher runtime detected for test.",
    )


def _unavailable_encryption_status() -> EncryptionStatus:
    return EncryptionStatus(
        backend=EncryptionBackend.STANDARD_SQLITE,
        available=False,
        detail="SQLCipher runtime not detected for test.",
    )
