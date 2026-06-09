import json
import hashlib
import unittest
import uuid
from pathlib import Path

from interrogaition.security.case_workspace import CaseWorkspaceManager
from interrogaition.security.model_artifacts import (
    MODEL_ARTIFACT_DIRECTORIES,
    MODEL_ARTIFACT_MANIFEST_FILE,
    MODEL_ARTIFACT_POLICY_FILE,
    ensure_model_artifact_isolation,
    inspect_model_artifact_isolation,
    list_model_artifact_manifest,
    write_model_artifact,
)


TEST_OUTPUT_ROOT = Path(__file__).resolve().parents[1] / "backend" / "test-output" / "model-artifacts"


class ModelArtifactIsolationTest(unittest.TestCase):
    def test_initializes_workspace_model_artifact_policy(self) -> None:
        workspace = CaseWorkspaceManager(_workspace_root("isolation")).create_workspace(
            case_id="case-001",
            created_by="investigator-001",
            workspace_id="workspace-model-artifacts",
        )

        before = inspect_model_artifact_isolation(workspace)
        after = ensure_model_artifact_isolation(workspace, created_by="admin-001")

        self.assertEqual(before.state, "warning")
        self.assertFalse(before.policy_exists)
        self.assertEqual(after.state, "ready")
        self.assertTrue(after.policy_exists)
        self.assertFalse(after.external_cache_allowed)
        self.assertFalse(after.network_artifacts_allowed)
        self.assertFalse(after.warnings)

        models_root = workspace.directory("models")
        for directory_name in MODEL_ARTIFACT_DIRECTORIES:
            self.assertTrue((models_root / directory_name).is_dir())

        policy = json.loads((models_root / MODEL_ARTIFACT_POLICY_FILE).read_text(encoding="utf-8"))
        self.assertEqual(policy["workspace_id"], "workspace-model-artifacts")
        self.assertEqual(policy["created_by"], "admin-001")
        self.assertEqual(set(policy["directories"]), set(MODEL_ARTIFACT_DIRECTORIES))

    def test_corrupt_policy_reports_warning_instead_of_crashing(self) -> None:
        workspace = CaseWorkspaceManager(_workspace_root("corrupt")).create_workspace(
            case_id="case-001",
            created_by="investigator-001",
            workspace_id="workspace-corrupt-policy",
        )
        models_root = workspace.directory("models")
        models_root.mkdir(parents=True, exist_ok=True)
        (models_root / MODEL_ARTIFACT_POLICY_FILE).write_text("not-json", encoding="utf-8")

        status = inspect_model_artifact_isolation(workspace)

        self.assertEqual(status.state, "warning")
        self.assertFalse(status.policy_exists)
        self.assertIn("Model artifact policy manifest is missing.", status.warnings)

    def test_writes_model_artifact_and_manifest_record(self) -> None:
        workspace = CaseWorkspaceManager(_workspace_root("write")).create_workspace(
            case_id="case-001",
            created_by="investigator-001",
            workspace_id="workspace-write-artifact",
        )
        ensure_model_artifact_isolation(workspace, created_by="admin-001")

        result = write_model_artifact(
            workspace,
            artifact_type="prompt",
            content='{"instruction":"stay grounded"}',
            content_type="application/json",
            source="unit-test",
            created_by="model-audit-test",
            metadata={"prompt_version": "test-v1"},
        )

        record = result.record
        artifact_path = workspace.root_path / record.relative_path
        expected_bytes = b'{"instruction":"stay grounded"}'
        manifest = list_model_artifact_manifest(workspace)

        self.assertTrue(artifact_path.exists())
        self.assertFalse(result.deduplicated)
        self.assertEqual(record.artifact_type, "prompt")
        self.assertEqual(record.sha256, hashlib.sha256(expected_bytes).hexdigest())
        self.assertEqual(record.size_bytes, len(expected_bytes))
        self.assertEqual(record.metadata["prompt_version"], "test-v1")
        self.assertEqual(manifest.record_count, 1)
        self.assertTrue(manifest.chain_valid)
        self.assertIsNone(manifest.records[0].previous_hash)
        self.assertEqual(len(manifest.records[0].record_hash or ""), 64)
        self.assertEqual(manifest.latest_record_hash, manifest.records[0].record_hash)
        self.assertEqual(manifest.records[0].artifact_id, record.artifact_id)
        self.assertTrue((workspace.directory("models") / MODEL_ARTIFACT_MANIFEST_FILE).exists())

    def test_deduplicates_same_type_and_hash(self) -> None:
        workspace = CaseWorkspaceManager(_workspace_root("deduplicate")).create_workspace(
            case_id="case-001",
            created_by="investigator-001",
            workspace_id="workspace-deduplicate-artifact",
        )
        ensure_model_artifact_isolation(workspace, created_by="admin-001")

        first = write_model_artifact(
            workspace,
            artifact_type="prompt",
            content='{"instruction":"same"}',
            content_type="application/json",
            source="unit-test",
            created_by="model-audit-test",
        )
        second = write_model_artifact(
            workspace,
            artifact_type="prompt",
            content='{"instruction":"same"}',
            content_type="application/json",
            source="unit-test-repeat",
            created_by="model-audit-test",
        )
        third = write_model_artifact(
            workspace,
            artifact_type="context",
            content='{"instruction":"same"}',
            content_type="application/json",
            source="unit-test-context",
            created_by="model-audit-test",
        )
        manifest = list_model_artifact_manifest(workspace)

        self.assertFalse(first.deduplicated)
        self.assertTrue(second.deduplicated)
        self.assertFalse(third.deduplicated)
        self.assertEqual(second.record.artifact_id, first.record.artifact_id)
        self.assertEqual(manifest.record_count, 2)
        self.assertTrue(manifest.chain_valid)
        self.assertEqual([record.artifact_type for record in manifest.records], ["prompt", "context"])
        self.assertIsNone(manifest.records[0].previous_hash)
        self.assertEqual(manifest.records[1].previous_hash, manifest.records[0].record_hash)
        self.assertEqual(manifest.latest_record_hash, manifest.records[1].record_hash)
        self.assertEqual(len(tuple((workspace.directory("models") / "prompts").iterdir())), 1)

    def test_detects_manifest_hash_chain_tampering_and_blocks_writes(self) -> None:
        workspace = CaseWorkspaceManager(_workspace_root("tampered-chain")).create_workspace(
            case_id="case-001",
            created_by="investigator-001",
            workspace_id="workspace-tampered-artifact-chain",
        )
        ensure_model_artifact_isolation(workspace, created_by="admin-001")
        write_model_artifact(
            workspace,
            artifact_type="prompt",
            content='{"instruction":"original"}',
            content_type="application/json",
            source="unit-test",
            created_by="model-audit-test",
        )
        manifest_path = workspace.directory("models") / MODEL_ARTIFACT_MANIFEST_FILE
        manifest_payload = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest_payload["records"][0]["metadata"]["tampered"] = True
        manifest_path.write_text(json.dumps(manifest_payload, indent=2, sort_keys=True), encoding="utf-8")

        manifest = list_model_artifact_manifest(workspace)

        self.assertFalse(manifest.chain_valid)
        with self.assertRaises(ValueError):
            write_model_artifact(
                workspace,
                artifact_type="output",
                content='{"result":"blocked"}',
                content_type="application/json",
                source="unit-test",
                created_by="model-audit-test",
            )
        self.assertEqual(tuple((workspace.directory("models") / "outputs").iterdir()), ())

    def test_requires_isolation_before_artifact_write(self) -> None:
        workspace = CaseWorkspaceManager(_workspace_root("uninitialized")).create_workspace(
            case_id="case-001",
            created_by="investigator-001",
            workspace_id="workspace-uninitialized-artifacts",
        )

        with self.assertRaises(ValueError):
            write_model_artifact(
                workspace,
                artifact_type="prompt",
                content="test",
                created_by="model-audit-test",
            )

    def test_rejects_write_when_artifact_manifest_is_corrupt(self) -> None:
        workspace = CaseWorkspaceManager(_workspace_root("corrupt-manifest")).create_workspace(
            case_id="case-001",
            created_by="investigator-001",
            workspace_id="workspace-corrupt-artifact-manifest",
        )
        ensure_model_artifact_isolation(workspace, created_by="admin-001")
        manifest_path = workspace.directory("models") / MODEL_ARTIFACT_MANIFEST_FILE
        manifest_path.write_text("not-json", encoding="utf-8")

        with self.assertRaises(ValueError):
            write_model_artifact(
                workspace,
                artifact_type="prompt",
                content="test",
                created_by="model-audit-test",
            )

        self.assertEqual(tuple((workspace.directory("models") / "prompts").iterdir()), ())


def _workspace_root(name: str) -> Path:
    root = TEST_OUTPUT_ROOT / f"{name}-{uuid.uuid4()}"
    root.mkdir(parents=True, exist_ok=True)
    return root


if __name__ == "__main__":
    unittest.main()
