import unittest
import uuid
from pathlib import Path

from interigaition.api.app import (
    AddAnswerRequest,
    CreateWorkspaceRequest,
    GroundedSuggestionDecisionRequest,
    HTTPException,
    MaterialQuestionLinkDecisionRequest,
    RegisterMaterialRequest,
    StartSessionRequest,
    create_app,
)
from interigaition.domain.models import SuggestionStatus
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
        link_materials = endpoint(app, "link_workspace_materials_to_questions")
        record_link_decision = endpoint(app, "record_material_question_link_decision")
        get_evidence_map = endpoint(app, "get_workspace_evidence_map")
        get_grounding_pack = endpoint(app, "get_workspace_grounding_pack")
        generate_grounded_suggestions = endpoint(app, "generate_workspace_grounded_suggestions")
        record_suggestion_decision = endpoint(app, "record_workspace_grounded_suggestion_decision")
        get_workspace_audit = endpoint(app, "get_workspace_audit")
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
        material_links = link_materials("api-workspace-001", case_id="case-001", locale="en")
        first_link = material_links["links"][0]
        link_decision = record_link_decision(
            "api-workspace-001",
            first_link["material_id"],
            first_link["question_id"],
            MaterialQuestionLinkDecisionRequest(
                decision="accepted",
                case_id="case-001",
                question_id=first_link["question_id"],
                topic_ids=first_link["topic_ids"],
                matched_terms=first_link["matched_terms"],
                confidence=first_link["confidence"],
                rationale=first_link["rationale"],
            ),
        )
        evidence_map = get_evidence_map(
            "api-workspace-001",
            case_id="case-001",
            session_id=None,
            locale="en",
        )
        grounding_pack = get_grounding_pack(
            "api-workspace-001",
            case_id="case-001",
            session_id=None,
            question_id="q-001",
            locale="en",
        )
        grounded_suggestions = generate_grounded_suggestions(
            "api-workspace-001",
            case_id="case-001",
            session_id=None,
            question_id="q-001",
            locale="en",
        )
        first_suggestion = grounded_suggestions["suggestions"][0]
        decision = record_suggestion_decision(
            "api-workspace-001",
            first_suggestion["id"],
            GroundedSuggestionDecisionRequest(
                decision=SuggestionStatus.ACCEPTED,
                original_text=first_suggestion["text"],
                final_text=first_suggestion["text"],
                suggestion_type=first_suggestion["suggestion_type"],
                reason=first_suggestion["reason"],
                linked_topics=first_suggestion["linked_topics"],
                linked_evidence=first_suggestion["linked_evidence"],
                risk_flags=first_suggestion["risk_flags"],
                confidence=first_suggestion["confidence"],
                model=grounded_suggestions["model"],
                prompt_version=grounded_suggestions["prompt_version"],
                context_hash=grounded_suggestions["context_hash"],
                output_hash=grounded_suggestions["output_hash"],
                case_id="case-001",
                question_id="q-001",
            ),
        )
        workspace_audit = get_workspace_audit("api-workspace-001")
        material_verification = verify_material("api-workspace-001", "api-material-001")

        self.assertEqual(created["manifest"]["workspace_id"], "api-workspace-001")
        self.assertEqual(loaded["manifest"]["case_id"], "case-001")
        self.assertTrue(allowed["allowed"])
        self.assertFalse(denied["allowed"])
        self.assertFalse(encryption_status["available"])
        self.assertEqual(material["id"], "api-material-001")
        self.assertEqual(material["source_type"], "case_protocol")
        self.assertEqual(len(materials["materials"]), 1)
        self.assertIn(
            "q-001",
            {link["question_id"] for link in material_links["links"]},
        )
        self.assertEqual(link_decision["decision"], "accepted")
        self.assertTrue(link_decision["chain_valid"])
        self.assertEqual(link_decision["audit_event"]["action"], "material_question_link_accepted")
        self.assertEqual(link_decision["audit_event"]["details"]["material_id"], first_link["material_id"])
        self.assertEqual(evidence_map["evidence_map"]["case_id"], "case-001")
        self.assertEqual(evidence_map["evidence_map"]["summary"]["total_materials"], 1)
        self.assertIn(
            "api-material-001",
            {
                material_id
                for node in evidence_map["evidence_map"]["topic_nodes"]
                if node["topic_id"] == "topic-location"
                for material_id in node["material_ids"]
            },
        )
        self.assertEqual(grounding_pack["grounding_pack"]["focus_question_id"], "q-001")
        self.assertIn(
            "no-truthfulness-verdict",
            {rule["id"] for rule in grounding_pack["grounding_pack"]["rules"]},
        )
        self.assertIn(
            "api-material-001",
            {
                reference["material_id"]
                for reference in grounding_pack["grounding_pack"]["material_references"]
            },
        )
        self.assertIn("suggestions", grounded_suggestions)
        self.assertEqual(grounded_suggestions["model"], "deterministic-grounded-fake")
        self.assertEqual(len(grounded_suggestions["context_hash"]), 64)
        self.assertEqual(len(grounded_suggestions["output_hash"]), 64)
        self.assertEqual(grounded_suggestions["warnings"], [])
        self.assertTrue(grounded_suggestions["suggestions"])
        self.assertEqual(decision["decision"], "accepted")
        self.assertTrue(decision["chain_valid"])
        self.assertEqual(decision["audit_event"]["action"], "grounded_suggestion_accepted")
        self.assertEqual(decision["audit_event"]["details"]["context_hash"], grounded_suggestions["context_hash"])
        self.assertTrue(workspace_audit["chain_valid"])
        self.assertEqual(
            [event["action"] for event in workspace_audit["events"]],
            [
                "material_question_link_accepted",
                "grounded_suggestions_generated",
                "grounded_suggestion_accepted",
            ],
        )
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
