import unittest
import uuid
from pathlib import Path

from interigaition.api.app import (
    AddAnswerRequest,
    CreateWorkspaceRequest,
    HTTPException,
    RegisterMaterialRequest,
    StartSessionRequest,
    create_app,
)
from interigaition.domain.session import ParticipantRole
from interigaition.security.access_policy import WorkspaceAction, WorkspaceRole
from interigaition.security.case_workspace import CaseWorkspaceManager, DataSensitivity, StorageMode
from interigaition.security.encryption_status import EncryptionBackend, EncryptionStatus
from interigaition.storage.material_registry import MaterialSourceType


TEST_OUTPUT_ROOT = Path(__file__).resolve().parents[1] / "backend" / "test-output" / "api"


def endpoint(app, name: str):
    for route in app.routes:
        if getattr(route, "name", None) == name:
            return route.endpoint

    raise AssertionError(f"Endpoint not found: {name}")


class ApiAppTest(unittest.TestCase):
    def test_health_and_locales(self) -> None:
        app = create_app()

        self.assertEqual(endpoint(app, "health")(), {"status": "ok"})
        self.assertEqual(endpoint(app, "locales")(), {"locales": ["en", "pl"]})

    def test_case_review_endpoint_returns_indicators_and_report(self) -> None:
        app = create_app()
        response = endpoint(app, "review_case_endpoint")("case-001", locale="en")

        self.assertEqual(response["case"]["id"], "case-001")
        self.assertIn("review", response)
        self.assertIn("indicators", response)
        self.assertIn("Decision-support indicators", response["report_markdown"])

    def test_workspace_endpoint_flow(self) -> None:
        app = create_app(
            workspace_manager=CaseWorkspaceManager(
                TEST_OUTPUT_ROOT / f"workspaces-{uuid.uuid4()}",
                encryption_status_provider=_unavailable_encryption_status,
            )
        )
        get_encryption_status = endpoint(app, "get_encryption_status")
        create_workspace = endpoint(app, "create_workspace")
        get_workspace = endpoint(app, "get_workspace")
        get_access = endpoint(app, "get_workspace_access")
        register_material = endpoint(app, "register_workspace_material")
        list_materials = endpoint(app, "list_workspace_materials")
        verify_material = endpoint(app, "verify_workspace_material")

        created = create_workspace(
            CreateWorkspaceRequest(
                case_id="case-001",
                created_by="investigator-001",
                workspace_id="api-workspace-001",
                data_sensitivity=DataSensitivity.SYNTHETIC,
                storage_mode=StorageMode.PLAIN_SQLITE_PROTOTYPE,
            )
        )
        loaded = get_workspace("api-workspace-001")
        allowed = get_access(
            "api-workspace-001",
            role=WorkspaceRole.INVESTIGATOR,
            action=WorkspaceAction.WRITE_INTERVIEW,
        )
        denied = get_access(
            "api-workspace-001",
            role=WorkspaceRole.OBSERVER,
            action=WorkspaceAction.WRITE_INTERVIEW,
        )
        encryption_status = get_encryption_status()
        material = register_material(
            "api-workspace-001",
            RegisterMaterialRequest(
                id="api-material-001",
                title="Initial protocol note",
                content="Witness says the bicycle was near the library.",
                created_by="investigator-001",
                source_type=MaterialSourceType.CASE_PROTOCOL,
                tags=["protocol", "synthetic"],
            ),
        )
        materials = list_materials("api-workspace-001")
        material_verification = verify_material("api-workspace-001", "api-material-001")

        self.assertEqual(created["manifest"]["workspace_id"], "api-workspace-001")
        self.assertEqual(loaded["manifest"]["case_id"], "case-001")
        self.assertTrue(allowed["allowed"])
        self.assertFalse(denied["allowed"])
        self.assertFalse(encryption_status["available"])
        self.assertEqual(material["id"], "api-material-001")
        self.assertEqual(material["source_type"], "case_protocol")
        self.assertEqual(len(materials["materials"]), 1)
        self.assertTrue(material_verification["verified"])

        with self.assertRaises(HTTPException) as caught:
            create_workspace(
                CreateWorkspaceRequest(
                    case_id="case-encrypted-api",
                    created_by="investigator-001",
                    workspace_id="api-workspace-encrypted",
                    data_sensitivity=DataSensitivity.SYNTHETIC,
                    storage_mode=StorageMode.ENCRYPTED_REQUIRED,
                )
            )

        self.assertEqual(caught.exception.status_code, 400)

    def test_session_endpoint_flow(self) -> None:
        app = create_app()
        start = endpoint(app, "start_session")
        add_answer = endpoint(app, "add_session_answer")
        review_session = endpoint(app, "review_session_endpoint")

        session = start(
            StartSessionRequest(
                session_id="api-session-001",
                case_id="case-001",
                participant_id="person-001",
                initial_role=ParticipantRole.WITNESS,
            )
        )

        self.assertEqual(session["id"], "api-session-001")
        self.assertEqual(session["role_history"][0]["role"], "witness")

        updated = add_answer(
            "api-session-001",
            AddAnswerRequest(
                id="api-answer-001",
                question_id="q-001",
                text="I saw the person near the bicycle stand.",
                topic_ids=["topic-location"],
                event_id="api-event-answer-001",
            ),
        )

        self.assertEqual(len(updated["answers"]), 1)
        self.assertEqual(updated["events"][-1]["event_type"], "answer_added")

        review = review_session("api-session-001", locale="en")

        self.assertEqual(review["session"]["id"], "api-session-001")
        self.assertEqual(review["snapshot"]["session_id"], "api-session-001")
        self.assertEqual(review["snapshot"]["sequence_no"], 2)
        self.assertIn("review", review["snapshot"])
        self.assertIn("indicators", review)
        self.assertIn("Decision-support indicators", review["report_markdown"])

        audit = endpoint(app, "get_session_audit")("api-session-001")

        self.assertTrue(audit["chain_valid"])
        self.assertEqual(audit["session_id"], "api-session-001")
        self.assertEqual(
            [event["action"] for event in audit["events"]],
            ["session_started", "answer_added", "review_refreshed"],
        )

    def test_start_session_rejects_duplicate_session_id(self) -> None:
        app = create_app()
        start = endpoint(app, "start_session")
        request = StartSessionRequest(
            session_id="api-session-duplicate",
            case_id="case-001",
            participant_id="person-001",
            initial_role=ParticipantRole.WITNESS,
        )

        start(request)
        other = start(
            StartSessionRequest(
                session_id="api-session-other",
                case_id="case-001",
                participant_id="person-001",
                initial_role=ParticipantRole.WITNESS,
            )
        )

        self.assertEqual(other["id"], "api-session-other")

        with self.assertRaises(HTTPException) as caught:
            start(request)

        self.assertEqual(caught.exception.status_code, 409)

    def test_add_session_answer_validates_payload(self) -> None:
        app = create_app()
        start = endpoint(app, "start_session")
        add_answer = endpoint(app, "add_session_answer")
        start(
            StartSessionRequest(
                session_id="api-session-validation",
                case_id="case-001",
                participant_id="person-001",
                initial_role=ParticipantRole.WITNESS,
            )
        )

        cases = [
            AddAnswerRequest(
                id="api-answer-empty",
                question_id="q-001",
                text="   ",
                event_id="api-event-empty",
            ),
            AddAnswerRequest(
                id="api-answer-unknown-question",
                question_id="q-999",
                text="Answer text.",
                event_id="api-event-unknown-question",
            ),
            AddAnswerRequest(
                id="api-answer-unknown-topic",
                question_id="q-001",
                text="Answer text.",
                topic_ids=["topic-unknown"],
                event_id="api-event-unknown-topic",
            ),
            AddAnswerRequest(
                id="api-answer-bad-claim",
                question_id="q-001",
                text="Answer text.",
                event_id="api-event-bad-claim",
                claims=[{"id": "claim-001", "subject": "event"}],
            ),
        ]

        for request in cases:
            with self.subTest(request=request.id):
                with self.assertRaises(HTTPException) as caught:
                    add_answer("api-session-validation", request)

                self.assertEqual(caught.exception.status_code, 400)


def _unavailable_encryption_status() -> EncryptionStatus:
    return EncryptionStatus(
        backend=EncryptionBackend.STANDARD_SQLITE,
        available=False,
        detail="SQLCipher runtime not detected for test.",
    )


if __name__ == "__main__":
    unittest.main()
