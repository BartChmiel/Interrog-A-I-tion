import sys
import unittest
import uuid
from contextlib import redirect_stderr, redirect_stdout
from io import StringIO
from pathlib import Path
from unittest.mock import patch

from interrogaition.cli import main
from interrogaition.export.integrity_manifest import read_export_manifest, verify_export_manifest
from interrogaition.security.case_workspace import CaseWorkspaceManager
from interrogaition.security.model_artifacts import (
    ensure_model_artifact_isolation,
    write_model_artifact,
)


ROOT = Path(__file__).resolve().parents[1]
CASE_PATH = ROOT / "data" / "synthetic" / "case-001" / "case.json"
TEST_OUTPUT_ROOT = ROOT / "backend" / "test-output" / "cli-exports"


class CliExportIntegrityTest(unittest.TestCase):
    def test_review_command_writes_report_and_manifest(self) -> None:
        export_root = TEST_OUTPUT_ROOT / f"export-{uuid.uuid4()}"
        report_path = export_root / "report.md"
        manifest_path = export_root / "manifest.json"

        with patch.object(
            sys,
            "argv",
            [
                "interrogaition",
                "review",
                str(CASE_PATH),
                "--output",
                str(report_path),
                "--manifest",
                str(manifest_path),
                "--created-by",
                "investigator-001",
            ],
        ):
            exit_code = main()

        manifest = read_export_manifest(manifest_path)
        verification = verify_export_manifest(manifest, root_path=export_root)

        self.assertEqual(exit_code, 0)
        self.assertTrue(report_path.exists())
        self.assertIn("Decision-support indicators", report_path.read_text(encoding="utf-8"))
        self.assertEqual(manifest.case_id, "case-001")
        self.assertEqual(manifest.created_by, "investigator-001")
        self.assertTrue(verification.verified)

    def test_review_command_can_include_model_artifact_references(self) -> None:
        export_root = TEST_OUTPUT_ROOT / f"export-model-artifacts-{uuid.uuid4()}"
        report_path = export_root / "report.md"
        manifest_path = export_root / "manifest.json"
        workspace = _workspace_with_model_artifact()

        with patch.object(
            sys,
            "argv",
            [
                "interrogaition",
                "review",
                str(CASE_PATH),
                "--output",
                str(report_path),
                "--manifest",
                str(manifest_path),
                "--created-by",
                "investigator-001",
                "--workspace-root",
                str(workspace.root_path),
                "--include-model-artifacts",
            ],
        ):
            exit_code = main()

        manifest = read_export_manifest(manifest_path)
        verification = verify_export_manifest(
            manifest,
            root_path=export_root,
            workspace_root_path=workspace.root_path,
        )

        self.assertEqual(exit_code, 0)
        self.assertIsNotNone(manifest.model_artifacts)
        self.assertEqual(manifest.model_artifacts.record_count, 1)
        self.assertTrue(verification.verified)

    def test_review_command_requires_output_for_manifest(self) -> None:
        with patch.object(
            sys,
            "argv",
            [
                "interrogaition",
                "review",
                str(CASE_PATH),
                "--manifest",
                str(TEST_OUTPUT_ROOT / "manifest.json"),
            ],
        ):
            with redirect_stderr(StringIO()):
                with self.assertRaises(SystemExit) as caught:
                    main()

        self.assertEqual(caught.exception.code, 2)

    def test_verify_export_command_returns_success_for_valid_manifest(self) -> None:
        export_root = TEST_OUTPUT_ROOT / f"verify-{uuid.uuid4()}"
        report_path = export_root / "report.md"
        manifest_path = export_root / "manifest.json"
        _write_cli_export(report_path, manifest_path)

        with patch.object(sys, "argv", ["interrogaition", "verify-export", str(manifest_path)]):
            with redirect_stdout(StringIO()):
                exit_code = main()

        self.assertEqual(exit_code, 0)

    def test_verify_export_command_returns_failure_for_changed_file(self) -> None:
        export_root = TEST_OUTPUT_ROOT / f"verify-changed-{uuid.uuid4()}"
        report_path = export_root / "report.md"
        manifest_path = export_root / "manifest.json"
        _write_cli_export(report_path, manifest_path)
        report_path.write_text("changed\n", encoding="utf-8")

        with patch.object(sys, "argv", ["interrogaition", "verify-export", str(manifest_path)]):
            with redirect_stdout(StringIO()):
                exit_code = main()

        self.assertEqual(exit_code, 1)


def _write_cli_export(report_path: Path, manifest_path: Path) -> None:
    with patch.object(
        sys,
        "argv",
        [
            "interrogaition",
            "review",
            str(CASE_PATH),
            "--output",
            str(report_path),
            "--manifest",
            str(manifest_path),
            "--created-by",
            "investigator-001",
        ],
    ):
        exit_code = main()

    if exit_code != 0:
        raise AssertionError(f"CLI export failed: {exit_code}")


def _workspace_with_model_artifact():
    manager = CaseWorkspaceManager(TEST_OUTPUT_ROOT / f"workspace-root-{uuid.uuid4()}")
    workspace = manager.create_workspace(
        case_id="case-001",
        created_by="investigator-001",
        workspace_id=f"workspace-{uuid.uuid4().hex[:10]}",
    )
    ensure_model_artifact_isolation(workspace, created_by="admin-001")
    write_model_artifact(
        workspace,
        artifact_type="prompt",
        content='{"instruction":"cli export"}',
        content_type="application/json",
        source="cli-test",
        created_by="model-audit-test",
    )
    return workspace


if __name__ == "__main__":
    unittest.main()
