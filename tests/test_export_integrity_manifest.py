import io
import unittest
import uuid
from dataclasses import replace
from pathlib import Path

from interrogaition.export.integrity_manifest import (
    ExportIntegrityError,
    calculate_manifest_hash,
    create_export_bundle_zip,
    create_export_manifest,
    create_export_manifest_from_contents,
    create_model_artifact_manifest_reference,
    read_export_manifest,
    verify_export_bundle_zip,
    verify_export_manifest,
    verify_export_manifest_contents,
    write_export_manifest,
)
import zipfile
from interrogaition.security.case_workspace import CaseWorkspaceManager
from interrogaition.security.model_artifacts import (
    ensure_model_artifact_isolation,
    write_model_artifact,
)


TEST_OUTPUT_ROOT = Path(__file__).resolve().parents[1] / "backend" / "test-output" / "exports"


class ExportIntegrityManifestTest(unittest.TestCase):
    def test_creates_manifest_from_in_memory_contents(self) -> None:
        manifest = create_export_manifest_from_contents(
            case_id="case-001",
            created_by="investigator-001",
            files=(("session-report.md", "# Report\n"),),
            export_id="export-preview-001",
        )

        self.assertEqual(manifest.export_id, "export-preview-001")
        self.assertEqual(manifest.files[0].path, "session-report.md")
        self.assertEqual(manifest.files[0].size_bytes, len("# Report\n".encode("utf-8")))
        self.assertIsNotNone(manifest.manifest_hash)

    def test_verifies_in_memory_export_contents(self) -> None:
        manifest = create_export_manifest_from_contents(
            case_id="case-001",
            created_by="investigator-001",
            files=(("session-report.md", "# Report\n"),),
        )
        verification = verify_export_manifest_contents(
            manifest,
            files=(("session-report.md", "# Report\n"),),
        )

        self.assertTrue(verification.verified)
        self.assertTrue(verification.manifest_hash_valid)

    def test_creates_zip_bundle_with_manifest(self) -> None:
        manifest = create_export_manifest_from_contents(
            case_id="case-001",
            created_by="investigator-001",
            files=(("session-report.md", "# Report\n"),),
        )
        bundle = create_export_bundle_zip(
            markdown_path="session-report.md",
            markdown_content="# Report\n",
            manifest=manifest,
            json_content='{"schema_version":1}',
        )

        with zipfile.ZipFile(io.BytesIO(bundle)) as archive:
            names = set(archive.namelist())

        self.assertEqual(names, {"session-report.md", "manifest.json", "session-report.json"})

    def test_verifies_zip_bundle_from_file(self) -> None:
        root = _export_root("bundle-verify")
        bundle_path = root / "interrogaition-case-001-export.zip"
        manifest = create_export_manifest_from_contents(
            case_id="case-001",
            created_by="investigator-001",
            files=(("session-report.md", "# Report\n"),),
        )
        bundle_path.write_bytes(
            create_export_bundle_zip(
                markdown_path="session-report.md",
                markdown_content="# Report\n",
                manifest=manifest,
            )
        )

        verification = verify_export_bundle_zip(bundle_path)

        self.assertTrue(verification.verified)
        self.assertTrue(verification.manifest_hash_valid)

    def test_zip_bundle_verification_detects_changed_report(self) -> None:
        root = _export_root("bundle-changed")
        bundle_path = root / "interrogaition-case-001-export.zip"
        manifest = create_export_manifest_from_contents(
            case_id="case-001",
            created_by="investigator-001",
            files=(("session-report.md", "# Report\n"),),
        )
        bundle_path.write_bytes(
            create_export_bundle_zip(
                markdown_path="session-report.md",
                markdown_content="# Changed\n",
                manifest=manifest,
            )
        )

        verification = verify_export_bundle_zip(bundle_path)

        self.assertFalse(verification.verified)
        self.assertEqual(verification.changed_files, ("session-report.md",))

    def test_zip_bundle_verification_reports_missing_manifest(self) -> None:
        root = _export_root("bundle-missing-manifest")
        bundle_path = root / "interrogaition-case-001-export.zip"
        with zipfile.ZipFile(bundle_path, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("session-report.md", "# Report\n")

        verification = verify_export_bundle_zip(bundle_path)

        self.assertFalse(verification.verified)
        self.assertIn("manifest.json", verification.unexpected_errors[0])

    def test_rejects_unsafe_virtual_export_paths(self) -> None:
        with self.assertRaises(ExportIntegrityError):
            create_export_manifest_from_contents(
                case_id="case-001",
                created_by="investigator-001",
                files=(("../escape.md", "nope"),),
            )

    def test_creates_writes_reads_and_verifies_export_manifest(self) -> None:
        root = _export_root("valid")
        report_path = root / "report.md"
        report_path.write_text("# Report\n\nSynthetic export.\n", encoding="utf-8")

        manifest = create_export_manifest(
            case_id="case-001",
            created_by="investigator-001",
            files=(report_path,),
            root_path=root,
            export_id="export-001",
        )
        manifest_path = root / "manifest.json"
        write_export_manifest(manifest_path, manifest)
        loaded = read_export_manifest(manifest_path)
        verification = verify_export_manifest(loaded, root_path=root)

        self.assertEqual(loaded.export_id, "export-001")
        self.assertEqual(loaded.files[0].path, "report.md")
        self.assertIsNotNone(loaded.manifest_hash)
        self.assertTrue(verification.verified)
        self.assertTrue(verification.manifest_hash_valid)

    def test_reads_and_verifies_legacy_v1_manifest(self) -> None:
        root = _export_root("legacy-v1")
        report_path = root / "report.md"
        report_path.write_text("legacy\n", encoding="utf-8")
        current = create_export_manifest(
            case_id="case-001",
            created_by="investigator-001",
            files=(report_path,),
            root_path=root,
        )
        legacy = replace(current, schema_version=1, model_artifacts=None, manifest_hash=None)
        legacy = replace(legacy, manifest_hash=calculate_manifest_hash(legacy))
        manifest_path = root / "manifest-v1.json"
        write_export_manifest(manifest_path, legacy)

        loaded = read_export_manifest(manifest_path)
        verification = verify_export_manifest(loaded, root_path=root)

        self.assertEqual(loaded.schema_version, 1)
        self.assertIsNone(loaded.model_artifacts)
        self.assertTrue(verification.verified)

    def test_includes_and_verifies_model_artifact_manifest_reference(self) -> None:
        root = _export_root("model-artifacts")
        report_path = root / "report.md"
        report_path.write_text("# Report\n", encoding="utf-8")
        workspace = _workspace_with_model_artifact("export-artifact-reference")

        manifest = create_export_manifest(
            case_id="case-001",
            created_by="investigator-001",
            files=(report_path,),
            root_path=root,
            model_artifacts=create_model_artifact_manifest_reference(workspace),
        )
        verification = verify_export_manifest(
            manifest,
            root_path=root,
            workspace_root_path=workspace.root_path,
        )

        self.assertTrue(verification.verified)
        self.assertIsNotNone(manifest.model_artifacts)
        self.assertEqual(manifest.schema_version, 2)
        self.assertEqual(manifest.model_artifacts.record_count, 1)
        self.assertTrue(manifest.model_artifacts.chain_valid)
        self.assertEqual(len(manifest.model_artifacts.records[0].record_hash or ""), 64)

    def test_detects_changed_model_artifact_file(self) -> None:
        root = _export_root("changed-model-artifact")
        report_path = root / "report.md"
        report_path.write_text("# Report\n", encoding="utf-8")
        workspace = _workspace_with_model_artifact("changed-artifact")
        manifest = create_export_manifest(
            case_id="case-001",
            created_by="investigator-001",
            files=(report_path,),
            root_path=root,
            model_artifacts=create_model_artifact_manifest_reference(workspace),
        )
        artifact_path = workspace.root_path / manifest.model_artifacts.records[0].relative_path
        artifact_path.write_text("tampered\n", encoding="utf-8")

        verification = verify_export_manifest(
            manifest,
            root_path=root,
            workspace_root_path=workspace.root_path,
        )

        self.assertFalse(verification.verified)
        self.assertTrue(verification.model_artifact_manifest_hash_valid)
        self.assertEqual(
            verification.changed_model_artifact_files,
            (manifest.model_artifacts.records[0].relative_path,),
        )

    def test_requires_workspace_root_for_model_artifact_verification(self) -> None:
        root = _export_root("model-artifact-workspace-required")
        report_path = root / "report.md"
        report_path.write_text("# Report\n", encoding="utf-8")
        workspace = _workspace_with_model_artifact("workspace-required")
        manifest = create_export_manifest(
            case_id="case-001",
            created_by="investigator-001",
            files=(report_path,),
            root_path=root,
            model_artifacts=create_model_artifact_manifest_reference(workspace),
        )

        verification = verify_export_manifest(manifest, root_path=root)

        self.assertFalse(verification.verified)
        self.assertIn("workspace_root_path is required", verification.unexpected_errors[0])

    def test_detects_changed_export_file(self) -> None:
        root = _export_root("changed")
        report_path = root / "report.md"
        report_path.write_text("original\n", encoding="utf-8")
        manifest = create_export_manifest(
            case_id="case-001",
            created_by="investigator-001",
            files=(report_path,),
            root_path=root,
        )

        report_path.write_text("tampered\n", encoding="utf-8")
        verification = verify_export_manifest(manifest, root_path=root)

        self.assertFalse(verification.verified)
        self.assertEqual(verification.changed_files, ("report.md",))

    def test_detects_manifest_hash_tampering(self) -> None:
        root = _export_root("manifest")
        report_path = root / "report.md"
        report_path.write_text("original\n", encoding="utf-8")
        manifest = create_export_manifest(
            case_id="case-001",
            created_by="investigator-001",
            files=(report_path,),
            root_path=root,
        )
        tampered = replace(manifest, case_id="case-002")

        verification = verify_export_manifest(tampered, root_path=root)

        self.assertFalse(verification.verified)
        self.assertFalse(verification.manifest_hash_valid)

    def test_rejects_files_outside_export_root(self) -> None:
        root = _export_root("outside")
        outside = TEST_OUTPUT_ROOT / f"outside-{uuid.uuid4()}.md"
        outside.write_text("outside\n", encoding="utf-8")

        with self.assertRaises(ExportIntegrityError):
            create_export_manifest(
                case_id="case-001",
                created_by="investigator-001",
                files=(outside,),
                root_path=root,
            )


def _export_root(name: str) -> Path:
    root = TEST_OUTPUT_ROOT / f"{name}-{uuid.uuid4()}"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _workspace_with_model_artifact(name: str):
    workspace = CaseWorkspaceManager(_export_root(f"workspace-root-{name}")).create_workspace(
        case_id="case-001",
        created_by="investigator-001",
        workspace_id=f"workspace-{uuid.uuid4().hex[:10]}",
    )
    ensure_model_artifact_isolation(workspace, created_by="admin-001")
    write_model_artifact(
        workspace,
        artifact_type="prompt",
        content='{"instruction":"export me"}',
        content_type="application/json",
        source="unit-test",
        created_by="model-audit-test",
    )
    return workspace


if __name__ == "__main__":
    unittest.main()
