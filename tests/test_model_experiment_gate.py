import unittest

from interrogaition.ai.local_model_runtime import LocalModelRuntimeConfig
from interrogaition.ai.model_experiment_gate import assess_model_experiment_readiness


class ModelExperimentGateTest(unittest.TestCase):
    def test_blocks_default_deterministic_runtime(self) -> None:
        report = assess_model_experiment_readiness(
            config=LocalModelRuntimeConfig(),
            stop_review_approved=False,
            workspace_id=None,
            workspace_security_state=None,
            artifact_isolation_state=None,
        )

        self.assertEqual(report.state, "blocked")
        self.assertFalse(report.can_run_real_smoke)
        self.assertFalse(report.can_enable_live_output)
        self.assertEqual(
            {issue.code for issue in report.issues},
            {
                "real_model_provider_required",
                "real_model_disabled",
                "stop_review_required",
                "workspace_required",
            },
        )

    def test_allows_controlled_real_smoke_when_all_gates_are_ready(self) -> None:
        report = assess_model_experiment_readiness(
            config=LocalModelRuntimeConfig(
                provider="ollama",
                configured_model="llama3.1:8b",
                real_model_enabled=True,
                live_output_enabled=False,
            ),
            stop_review_approved=True,
            workspace_id="workspace-001",
            workspace_security_state="ready",
            artifact_isolation_state="ready",
        )

        self.assertEqual(report.state, "ready")
        self.assertTrue(report.can_run_real_smoke)
        self.assertFalse(report.can_enable_live_output)
        self.assertEqual(report.issue_count, 0)

    def test_allows_bridge_controlled_real_smoke_when_all_gates_are_ready(self) -> None:
        report = assess_model_experiment_readiness(
            config=LocalModelRuntimeConfig(
                provider="bridge",
                configured_model="bridge-model",
                real_model_enabled=True,
                live_output_enabled=False,
            ),
            stop_review_approved=True,
            workspace_id="workspace-001",
            workspace_security_state="ready",
            artifact_isolation_state="ready",
        )

        self.assertEqual(report.state, "ready")
        self.assertTrue(report.can_run_real_smoke)
        self.assertFalse(report.can_enable_live_output)
        self.assertEqual(report.issue_count, 0)

    def test_blocks_when_live_output_is_enabled(self) -> None:
        report = assess_model_experiment_readiness(
            config=LocalModelRuntimeConfig(
                provider="ollama",
                configured_model="llama3.1:8b",
                real_model_enabled=True,
                live_output_enabled=True,
            ),
            stop_review_approved=True,
            workspace_id="workspace-001",
            workspace_security_state="ready",
            artifact_isolation_state="ready",
        )

        self.assertEqual(report.state, "blocked")
        self.assertFalse(report.can_run_real_smoke)
        self.assertEqual(report.issues[0].code, "live_output_enabled")

    def test_blocks_when_artifact_isolation_is_not_ready(self) -> None:
        report = assess_model_experiment_readiness(
            config=LocalModelRuntimeConfig(
                provider="ollama",
                configured_model="llama3.1:8b",
                real_model_enabled=True,
            ),
            stop_review_approved=True,
            workspace_id="workspace-001",
            workspace_security_state="ready",
            artifact_isolation_state="warning",
        )

        self.assertEqual(report.state, "blocked")
        self.assertEqual(report.issues[0].code, "artifact_isolation_not_ready")
