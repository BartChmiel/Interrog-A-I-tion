import unittest
import uuid
from dataclasses import replace
from pathlib import Path

from interigaition.export.integrity_manifest import (
    ExportIntegrityError,
    create_export_manifest,
    read_export_manifest,
    verify_export_manifest,
    write_export_manifest,
)


TEST_OUTPUT_ROOT = Path(__file__).resolve().parents[1] / "backend" / "test-output" / "exports"


class ExportIntegrityManifestTest(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
