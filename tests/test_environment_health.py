import unittest
import uuid
from pathlib import Path

from interrogaition.ai.local_model_runtime import LocalModelRuntimeConfig
from interrogaition.security.encryption_status import EncryptionBackend, EncryptionStatus
from interrogaition.security.environment_health import build_environment_health_report


TEST_OUTPUT_ROOT = Path(__file__).resolve().parents[1] / "backend" / "test-output" / "environment-health"


class EnvironmentHealthTest(unittest.TestCase):
    def test_reports_warning_when_encryption_is_unavailable(self) -> None:
        synthetic_root = _root("synthetic")
        case_root = synthetic_root / "case-001"
        case_root.mkdir(parents=True)
        (case_root / "case.json").write_text("{}", encoding="utf-8")
        workspace_root = _root("workspaces")
        workspace_root.mkdir(parents=True)

        report = build_environment_health_report(
            synthetic_cases_root=synthetic_root,
            workspace_root=workspace_root,
            encryption_status=_unavailable_encryption_status(),
            local_model_config=LocalModelRuntimeConfig(),
        )

        self.assertEqual(report.state, "warning")
        self.assertEqual(report.summary["blocked"], 0)
        self.assertEqual(
            {check.id: check.state for check in report.checks}["encryption"],
            "warning",
        )

    def test_blocks_when_synthetic_cases_are_missing(self) -> None:
        report = build_environment_health_report(
            synthetic_cases_root=_root("missing-synthetic"),
            workspace_root=_root("missing-workspaces"),
            encryption_status=_available_encryption_status(),
            local_model_config=LocalModelRuntimeConfig(),
        )

        self.assertEqual(report.state, "blocked")
        self.assertEqual(
            {check.id: check.state for check in report.checks}["synthetic_cases"],
            "blocked",
        )


def _root(name: str) -> Path:
    return TEST_OUTPUT_ROOT / f"{name}-{uuid.uuid4()}"


def _available_encryption_status() -> EncryptionStatus:
    return EncryptionStatus(
        backend=EncryptionBackend.SQLCIPHER,
        available=True,
        detail="SQLCipher available.",
        version="4.5.0",
    )


def _unavailable_encryption_status() -> EncryptionStatus:
    return EncryptionStatus(
        backend=EncryptionBackend.STANDARD_SQLITE,
        available=False,
        detail="SQLCipher unavailable.",
        version=None,
    )


if __name__ == "__main__":
    unittest.main()
