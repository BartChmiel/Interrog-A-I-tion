import unittest
import uuid
from dataclasses import replace
from pathlib import Path

from interigaition.security.access_policy import (
    WorkspaceAction,
    WorkspaceRole,
    decide_workspace_access,
)
from interigaition.security.case_workspace import (
    CaseWorkspaceManager,
    DataSensitivity,
    StorageMode,
    WorkspaceError,
    WorkspaceStatus,
)


TEST_OUTPUT_ROOT = Path(__file__).resolve().parents[1] / "backend" / "test-output" / "workspaces"


class CaseWorkspaceTest(unittest.TestCase):
    def test_creates_case_workspace_manifest_and_directories(self) -> None:
        manager = CaseWorkspaceManager(_workspace_root("create"))

        workspace = manager.create_workspace(
            case_id="case-001",
            created_by="investigator-001",
            workspace_id="case-001-workspace",
        )

        self.assertTrue(workspace.manifest_path.exists())
        self.assertEqual(workspace.manifest.case_id, "case-001")
        self.assertEqual(workspace.manifest.data_sensitivity, DataSensitivity.SYNTHETIC)
        self.assertFalse(workspace.manifest.allows_sensitive_material)
        for directory_name in ("imports", "sessions", "exports", "audit", "models"):
            self.assertTrue(workspace.directory(directory_name).is_dir())

        reopened = manager.open_workspace("case-001-workspace")
        self.assertEqual(reopened.manifest.workspace_id, workspace.manifest.workspace_id)
        self.assertEqual(reopened.manifest.created_by, "investigator-001")

    def test_rejects_unsafe_workspace_identifiers(self) -> None:
        manager = CaseWorkspaceManager(_workspace_root("unsafe"))

        with self.assertRaises(WorkspaceError):
            manager.create_workspace(
                case_id="../case-001",
                created_by="investigator-001",
            )

        with self.assertRaises(WorkspaceError):
            manager.open_workspace("../case-001")

    def test_rejects_non_synthetic_material_without_encrypted_storage(self) -> None:
        manager = CaseWorkspaceManager(_workspace_root("sensitive"))

        for sensitivity in (DataSensitivity.ANONYMIZED, DataSensitivity.SENSITIVE):
            with self.subTest(sensitivity=sensitivity):
                with self.assertRaises(WorkspaceError):
                    manager.create_workspace(
                        case_id=f"case-{sensitivity.value}",
                        created_by="investigator-001",
                        data_sensitivity=sensitivity,
                        storage_mode=StorageMode.PLAIN_SQLITE_PROTOTYPE,
                    )

    def test_workspace_access_policy_blocks_risky_operations(self) -> None:
        manager = CaseWorkspaceManager(_workspace_root("policy"))
        workspace = manager.create_workspace(
            case_id="case-policy",
            created_by="prosecutor-001",
            data_sensitivity=DataSensitivity.ANONYMIZED,
            storage_mode=StorageMode.ENCRYPTED_REQUIRED,
        )

        allowed = decide_workspace_access(
            role=WorkspaceRole.INVESTIGATOR,
            action=WorkspaceAction.WRITE_INTERVIEW,
            manifest=workspace.manifest,
        )
        denied_observer = decide_workspace_access(
            role=WorkspaceRole.OBSERVER,
            action=WorkspaceAction.WRITE_INTERVIEW,
            manifest=workspace.manifest,
        )
        denied_import = decide_workspace_access(
            role=WorkspaceRole.INVESTIGATOR,
            action=WorkspaceAction.IMPORT_MATERIAL,
            manifest=replace(
                workspace.manifest,
                storage_mode=StorageMode.PLAIN_SQLITE_PROTOTYPE,
            ),
        )
        denied_sealed = decide_workspace_access(
            role=WorkspaceRole.INVESTIGATOR,
            action=WorkspaceAction.RUN_REVIEW,
            manifest=replace(
                workspace.manifest,
                status=WorkspaceStatus.SEALED,
            ),
        )

        self.assertTrue(allowed.allowed)
        self.assertFalse(denied_observer.allowed)
        self.assertFalse(denied_import.allowed)
        self.assertFalse(denied_sealed.allowed)


def _workspace_root(name: str) -> Path:
    root = TEST_OUTPUT_ROOT / f"{name}-{uuid.uuid4()}"
    root.mkdir(parents=True, exist_ok=True)
    return root


if __name__ == "__main__":
    unittest.main()
