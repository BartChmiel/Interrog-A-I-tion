import hashlib
import unittest
import uuid
from pathlib import Path

from interigaition.security.case_workspace import (
    CaseWorkspaceManager,
    DataSensitivity,
    StorageMode,
)
from interigaition.security.encryption_status import EncryptionBackend, EncryptionStatus
from interigaition.storage.material_registry import (
    MaterialRegistry,
    MaterialRegistryError,
    MaterialSourceType,
)


TEST_OUTPUT_ROOT = Path(__file__).resolve().parents[1] / "backend" / "test-output" / "materials"


class MaterialRegistryTest(unittest.TestCase):
    def test_registers_text_material_with_hash_and_verification(self) -> None:
        workspace = CaseWorkspaceManager(_workspace_root("register")).create_workspace(
            case_id="case-001",
            created_by="investigator-001",
            workspace_id="case-001-materials",
        )
        registry = MaterialRegistry(workspace)
        content = "Initial witness protocol note."

        record = registry.register_text_material(
            material_id="protocol-001",
            title="Initial protocol",
            content=content,
            created_by="investigator-001",
            source_type=MaterialSourceType.CASE_PROTOCOL,
            tags=("protocol", "witness"),
        )

        material_path = workspace.root_path / record.relative_path
        self.assertTrue(material_path.is_file())
        self.assertEqual(record.workspace_id, "case-001-materials")
        self.assertEqual(record.case_id, "case-001")
        self.assertEqual(record.relative_path, "imports/materials/protocol-001.txt")
        self.assertEqual(record.sha256, hashlib.sha256(content.encode("utf-8")).hexdigest())
        self.assertEqual(record.size_bytes, len(content.encode("utf-8")))
        self.assertEqual(registry.list_materials()[0].id, "protocol-001")
        self.assertEqual(registry.read_material_text("protocol-001"), content)

        verification = registry.verify_material("protocol-001")
        self.assertTrue(verification.verified)
        self.assertTrue(verification.exists)
        self.assertTrue(verification.sha256_matches)
        self.assertTrue(verification.size_matches)

    def test_detects_material_tampering(self) -> None:
        workspace = CaseWorkspaceManager(_workspace_root("tamper")).create_workspace(
            case_id="case-001",
            created_by="investigator-001",
        )
        registry = MaterialRegistry(workspace)
        record = registry.register_text_material(
            material_id="note-001",
            title="Note",
            content="Original content.",
            created_by="investigator-001",
        )

        (workspace.root_path / record.relative_path).write_text("Changed content.", encoding="utf-8")
        verification = registry.verify_material("note-001")

        self.assertFalse(verification.verified)
        self.assertTrue(verification.exists)
        self.assertFalse(verification.sha256_matches)

    def test_rejects_unsafe_material_identifiers(self) -> None:
        workspace = CaseWorkspaceManager(_workspace_root("unsafe")).create_workspace(
            case_id="case-001",
            created_by="investigator-001",
        )
        registry = MaterialRegistry(workspace)

        with self.assertRaises(MaterialRegistryError):
            registry.register_text_material(
                material_id="../protocol",
                title="Protocol",
                content="Text",
                created_by="investigator-001",
            )

    def test_rejects_non_synthetic_material_in_plain_workspace(self) -> None:
        workspace = CaseWorkspaceManager(_workspace_root("plain")).create_workspace(
            case_id="case-001",
            created_by="investigator-001",
            storage_mode=StorageMode.PLAIN_SQLITE_PROTOTYPE,
        )
        registry = MaterialRegistry(workspace)

        with self.assertRaises(MaterialRegistryError):
            registry.register_text_material(
                material_id="anon-001",
                title="Anonymized protocol",
                content="Anonymized content.",
                created_by="investigator-001",
                data_sensitivity=DataSensitivity.ANONYMIZED,
            )

    def test_allows_non_synthetic_material_in_encrypted_workspace(self) -> None:
        workspace = CaseWorkspaceManager(
            _workspace_root("encrypted"),
            encryption_status_provider=_available_encryption_status,
        ).create_workspace(
            case_id="case-001",
            created_by="investigator-001",
            data_sensitivity=DataSensitivity.ANONYMIZED,
            storage_mode=StorageMode.ENCRYPTED_REQUIRED,
        )
        registry = MaterialRegistry(workspace)

        record = registry.register_text_material(
            material_id="anon-001",
            title="Anonymized protocol",
            content="Anonymized content.",
            created_by="investigator-001",
            data_sensitivity=DataSensitivity.ANONYMIZED,
        )

        self.assertEqual(record.data_sensitivity, DataSensitivity.ANONYMIZED)


def _workspace_root(name: str) -> Path:
    root = TEST_OUTPUT_ROOT / f"{name}-{uuid.uuid4()}"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _available_encryption_status() -> EncryptionStatus:
    return EncryptionStatus(
        backend=EncryptionBackend.SQLCIPHER,
        available=True,
        version="4.0-test",
        detail="SQLCipher runtime detected for test.",
    )


if __name__ == "__main__":
    unittest.main()
