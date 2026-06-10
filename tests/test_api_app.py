import unittest
import uuid
from pathlib import Path

from interrogaition.api.app import (
    AddAnswerRequest,
    CreateWorkspaceRequest,
    GroundedSuggestionDecisionRequest,
    HTTPException,
    MaterialQuestionLinkDecisionRequest,
    ModelArtifactIsolationRequest,
    ModelArtifactWriteRequest,
    OperatorActionDecisionRequest,
    RegisterMaterialRequest,
    SeedWorkspaceMaterialsRequest,
    StartSessionRequest,
    create_app,
)
from interrogaition.ai.local_model_runtime import LocalModelRuntimeConfig
from interrogaition.domain.models import SuggestionStatus
from interrogaition.domain.session import ParticipantRole
from interrogaition.security.access_policy import WorkspaceAction, WorkspaceRole
from interrogaition.security.case_workspace import CaseWorkspaceManager, DataSensitivity, StorageMode
from interrogaition.security.encryption_status import EncryptionBackend, EncryptionStatus
from interrogaition.storage.material_registry import MaterialSourceType


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

    def test_environment_health_endpoint_reports_readiness_checks(self) -> None:
        app = create_app(
            workspace_manager=CaseWorkspaceManager(
                TEST_OUTPUT_ROOT / f"health-workspaces-{uuid.uuid4()}",
                encryption_status_provider=_unavailable_encryption_status,
            )
        )

        report = endpoint(app, "get_environment_health")()
        checks = {check["id"]: check for check in report["checks"]}

        self.assertEqual(report["state"], "warning")
        self.assertIn("generated_at", report)
        self.assertEqual(checks["api"]["state"], "ready")
        self.assertEqual(checks["synthetic_cases"]["state"], "ready")
        self.assertEqual(checks["encryption"]["state"], "warning")
        self.assertEqual(checks["local_model"]["state"], "ready")

    def test_local_model_config_and_deterministic_smoke_endpoint(self) -> None:
        app = create_app()

        config = endpoint(app, "get_local_model_config")()
        smoke = endpoint(app, "smoke_local_model")(execute_real=False)

        self.assertEqual(config["provider"], "deterministic")
        self.assertEqual(config["effective_provider"], "deterministic")
        self.assertFalse(config["real_model_enabled"])
        self.assertFalse(config["live_output_enabled"])
        self.assertTrue(smoke["ok"])
        self.assertEqual(smoke["model"], "deterministic-smoke")
        self.assertFalse(smoke["real_model_invoked"])

    def test_local_model_real_smoke_requires_explicit_enablement(self) -> None:
        app = create_app(
            local_model_config=LocalModelRuntimeConfig(
                provider="ollama",
                configured_model="llama3.1:8b",
                real_model_enabled=False,
            )
        )

        config = endpoint(app, "get_local_model_config")()
        smoke = endpoint(app, "smoke_local_model")(execute_real=True)

        self.assertEqual(config["provider"], "ollama")
        self.assertEqual(config["effective_provider"], "deterministic")
        self.assertFalse(smoke["ok"])
        self.assertFalse(smoke["real_model_invoked"])
        self.assertIn("disabled", smoke["detail"])

    def test_case_review_endpoint_returns_indicators_and_report(self) -> None:
        app = create_app()
        response = endpoint(app, "review_case_endpoint")("case-001", locale="en")

        self.assertEqual(response["case"]["id"], "case-001")
        self.assertIn("review", response)
        self.assertIn("indicators", response)
        self.assertIn("Decision-support indicators", response["report_markdown"])

    def test_case_catalog_endpoint_lists_synthetic_cases(self) -> None:
        app = create_app()
        response = endpoint(app, "list_cases")(locale="en")

        cases = {item["id"]: item for item in response["cases"]}

        self.assertIn("case-001", cases)
        self.assertIn("case-002", cases)
        self.assertIn("case-003", cases)
        self.assertEqual(cases["case-002"]["question_count"], 6)
        self.assertEqual(cases["case-003"]["topic_count"], 7)
        self.assertGreaterEqual(cases["case-003"]["high_priority_topic_count"], 4)

    def test_case_starter_materials_endpoint_localizes_materials(self) -> None:
        app = create_app()
        response = endpoint(app, "list_case_starter_materials")("case-003", locale="pl")

        self.assertEqual(response["case_id"], "case-003")
        self.assertEqual(len(response["materials"]), 3)
        self.assertIn("dokumentacji lekowej", response["materials"][0]["title"])
        self.assertIn("Syntetyczna dokumentacja lekowa", response["materials"][0]["content"])

    def test_seed_workspace_materials_imports_and_skips_existing_materials(self) -> None:
        app = create_app(
            workspace_manager=CaseWorkspaceManager(
                TEST_OUTPUT_ROOT / f"seed-workspaces-{uuid.uuid4()}",
                encryption_status_provider=_unavailable_encryption_status,
            )
        )
        create_workspace = endpoint(app, "create_workspace")
        seed_materials = endpoint(app, "seed_workspace_materials")

        create_workspace(
            CreateWorkspaceRequest(
                case_id="case-002",
                created_by="investigator-001",
                workspace_id="api-seed-workspace-001",
                data_sensitivity=DataSensitivity.SYNTHETIC,
                storage_mode=StorageMode.PLAIN_SQLITE_PROTOTYPE,
            )
        )

        first_seed = seed_materials(
            "api-seed-workspace-001",
            SeedWorkspaceMaterialsRequest(
                created_by="investigator-001",
                locale="en",
                role=WorkspaceRole.INVESTIGATOR,
            ),
        )
        second_seed = seed_materials(
            "api-seed-workspace-001",
            SeedWorkspaceMaterialsRequest(
                created_by="investigator-001",
                locale="en",
                role=WorkspaceRole.INVESTIGATOR,
            ),
        )

        self.assertEqual(first_seed["imported_count"], 4)
        self.assertEqual(first_seed["skipped_count"], 0)
        self.assertEqual(second_seed["imported_count"], 0)
        self.assertEqual(second_seed["skipped_count"], 4)
        self.assertEqual(len(second_seed["materials"]), 4)

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
        get_model_artifacts = endpoint(app, "get_workspace_model_artifacts")
        ensure_model_artifacts = endpoint(app, "ensure_workspace_model_artifact_isolation")
        get_model_artifact_manifest = endpoint(app, "get_workspace_model_artifact_manifest")
        write_model_artifact = endpoint(app, "write_workspace_model_artifact")
        register_material = endpoint(app, "register_workspace_material")
        list_materials = endpoint(app, "list_workspace_materials")
        preview_material = endpoint(app, "get_workspace_material_preview")
        link_materials = endpoint(app, "link_workspace_materials_to_questions")
        record_link_decision = endpoint(app, "record_material_question_link_decision")
        get_evidence_map = endpoint(app, "get_workspace_evidence_map")
        get_grounding_pack = endpoint(app, "get_workspace_grounding_pack")
        generate_grounded_suggestions = endpoint(app, "generate_workspace_grounded_suggestions")
        record_suggestion_decision = endpoint(app, "record_workspace_grounded_suggestion_decision")
        record_operator_decision = endpoint(app, "record_workspace_operator_action_decision")
        list_operator_decisions = endpoint(app, "list_workspace_operator_action_decisions")
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
        model_artifacts_before = get_model_artifacts("api-workspace-001")
        model_artifacts_after = ensure_model_artifacts(
            "api-workspace-001",
            ModelArtifactIsolationRequest(created_by="admin-001", role=WorkspaceRole.ADMIN),
        )
        model_artifact_write = write_model_artifact(
            "api-workspace-001",
            ModelArtifactWriteRequest(
                artifact_type="context",
                content='{"allowed_source_ids":["api-material-001"]}',
                content_type="application/json",
                created_by="investigator-001",
                source="api-test",
                metadata={"prompt_version": "test-v1"},
                role=WorkspaceRole.INVESTIGATOR,
            ),
        )
        model_artifact_manifest = get_model_artifact_manifest("api-workspace-001")
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
        material_preview = preview_material("api-workspace-001", "api-material-001")
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
        model_artifact_manifest_after_suggestions = get_model_artifact_manifest("api-workspace-001")
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
                prompt_hash=grounded_suggestions["prompt_hash"],
                context_hash=grounded_suggestions["context_hash"],
                output_hash=grounded_suggestions["output_hash"],
                case_id="case-001",
                question_id="q-001",
            ),
        )
        operator_decision = record_operator_decision(
            "api-workspace-001",
            OperatorActionDecisionRequest(
                action_id="ask-q-002",
                action_kind="ask",
                action_title="Ask the next question",
                action_detail="q-002: What happened next?",
                action_priority="high",
                decision_type="opened",
                created_by="investigator-001",
                case_id="case-001",
                session_id=None,
                participant_id="person-001",
                target_question_id="q-002",
                source_object_ids=["q-002", "topic-location"],
                before_state={"active_question_id": "q-001"},
                after_state={"active_question_id": "q-002"},
                prompt_hash=grounded_suggestions["prompt_hash"],
                context_hash=grounded_suggestions["context_hash"],
                output_hash=grounded_suggestions["output_hash"],
            ),
        )
        operator_decisions = list_operator_decisions(
            "api-workspace-001",
            case_id="case-001",
            session_id=None,
        )
        workspace_audit = get_workspace_audit("api-workspace-001")
        material_verification = verify_material("api-workspace-001", "api-material-001")

        self.assertEqual(created["manifest"]["workspace_id"], "api-workspace-001")
        self.assertEqual(loaded["manifest"]["case_id"], "case-001")
        self.assertTrue(allowed["allowed"])
        self.assertFalse(denied["allowed"])
        self.assertFalse(encryption_status["available"])
        self.assertEqual(model_artifacts_before["state"], "warning")
        self.assertFalse(model_artifacts_before["policy_exists"])
        self.assertEqual(model_artifacts_after["state"], "ready")
        self.assertEqual(model_artifacts_after["directory_count"], 5)
        self.assertFalse(model_artifacts_after["external_cache_allowed"])
        self.assertEqual(model_artifact_write["record"]["artifact_type"], "context")
        self.assertEqual(model_artifact_write["manifest"]["record_count"], 1)
        self.assertTrue(model_artifact_write["manifest"]["chain_valid"])
        self.assertEqual(model_artifact_manifest["record_count"], 1)
        self.assertTrue(model_artifact_manifest["chain_valid"])
        self.assertEqual(material["id"], "api-material-001")
        self.assertEqual(material["source_type"], "case_protocol")
        self.assertEqual(len(materials["materials"]), 1)
        self.assertEqual(material_preview["material_id"], "api-material-001")
        self.assertIn("bicycle", material_preview["text_preview"])
        self.assertFalse(material_preview["truncated"])
        self.assertEqual(material_preview["line_count"], 1)
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
        self.assertEqual(len(grounded_suggestions["prompt_hash"]), 64)
        self.assertEqual(len(grounded_suggestions["context_hash"]), 64)
        self.assertEqual(len(grounded_suggestions["output_hash"]), 64)
        self.assertIsNotNone(grounded_suggestions["prompt_artifact"])
        self.assertIsNotNone(grounded_suggestions["context_artifact"])
        self.assertIsNotNone(grounded_suggestions["output_artifact"])
        self.assertIsNone(grounded_suggestions["artifact_warning"])
        self.assertEqual(grounded_suggestions["prompt_artifact"]["artifact_type"], "prompt")
        self.assertEqual(grounded_suggestions["context_artifact"]["artifact_type"], "context")
        self.assertEqual(grounded_suggestions["output_artifact"]["artifact_type"], "output")
        self.assertEqual(len(grounded_suggestions["prompt_artifact"]["sha256"]), 64)
        self.assertEqual(len(grounded_suggestions["context_artifact"]["sha256"]), 64)
        self.assertEqual(len(grounded_suggestions["output_artifact"]["sha256"]), 64)
        self.assertFalse(grounded_suggestions["prompt_artifact"]["deduplicated"])
        self.assertFalse(grounded_suggestions["context_artifact"]["deduplicated"])
        self.assertFalse(grounded_suggestions["output_artifact"]["deduplicated"])
        self.assertEqual(model_artifact_manifest_after_suggestions["record_count"], 4)
        self.assertTrue(model_artifact_manifest_after_suggestions["chain_valid"])
        self.assertEqual(len(model_artifact_manifest_after_suggestions["latest_record_hash"]), 64)
        self.assertEqual(
            [record["artifact_type"] for record in model_artifact_manifest_after_suggestions["records"]],
            ["context", "prompt", "context", "output"],
        )
        self.assertEqual(grounded_suggestions["warnings"], [])
        self.assertTrue(grounded_suggestions["suggestions"])
        self.assertEqual(decision["decision"], "accepted")
        self.assertTrue(decision["chain_valid"])
        self.assertEqual(decision["audit_event"]["action"], "grounded_suggestion_accepted")
        self.assertEqual(decision["audit_event"]["details"]["prompt_hash"], grounded_suggestions["prompt_hash"])
        self.assertEqual(decision["audit_event"]["details"]["context_hash"], grounded_suggestions["context_hash"])
        self.assertEqual(operator_decision["decision"]["decision_type"], "opened")
        self.assertEqual(operator_decision["decision"]["action_id"], "ask-q-002")
        self.assertEqual(operator_decision["decision"]["target_question_id"], "q-002")
        self.assertEqual(operator_decision["audit_event"]["action"], "operator_action_opened")
        self.assertTrue(operator_decision["chain_valid"])
        self.assertTrue(operator_decisions["chain_valid"])
        self.assertEqual(len(operator_decisions["decisions"]), 1)
        self.assertEqual(operator_decisions["decisions"][0]["event_hash"], operator_decision["decision"]["event_hash"])
        self.assertTrue(workspace_audit["chain_valid"])
        generated_event = workspace_audit["events"][1]
        self.assertEqual(
            generated_event["details"]["prompt_artifact_id"],
            grounded_suggestions["prompt_artifact"]["artifact_id"],
        )
        self.assertEqual(
            generated_event["details"]["prompt_artifact_sha256"],
            grounded_suggestions["prompt_artifact"]["sha256"],
        )
        self.assertFalse(generated_event["details"]["prompt_artifact_deduplicated"])
        self.assertEqual(
            generated_event["details"]["context_artifact_id"],
            grounded_suggestions["context_artifact"]["artifact_id"],
        )
        self.assertEqual(
            generated_event["details"]["context_artifact_sha256"],
            grounded_suggestions["context_artifact"]["sha256"],
        )
        self.assertFalse(generated_event["details"]["context_artifact_deduplicated"])
        self.assertEqual(
            generated_event["details"]["output_artifact_id"],
            grounded_suggestions["output_artifact"]["artifact_id"],
        )
        self.assertEqual(
            generated_event["details"]["output_artifact_sha256"],
            grounded_suggestions["output_artifact"]["sha256"],
        )
        self.assertFalse(generated_event["details"]["output_artifact_deduplicated"])
        self.assertEqual(
            [event["action"] for event in workspace_audit["events"]],
            [
                "material_question_link_accepted",
                "grounded_suggestions_generated",
                "grounded_suggestion_accepted",
                "operator_action_opened",
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

    def test_operator_action_decision_validates_access_and_question_target(self) -> None:
        app = create_app(
            workspace_manager=CaseWorkspaceManager(
                TEST_OUTPUT_ROOT / f"workspaces-{uuid.uuid4()}",
                encryption_status_provider=_unavailable_encryption_status,
            )
        )
        create_workspace = endpoint(app, "create_workspace")
        record_operator_decision = endpoint(app, "record_workspace_operator_action_decision")

        create_workspace(
            CreateWorkspaceRequest(
                case_id="case-001",
                created_by="investigator-001",
                workspace_id="api-workspace-operator-access",
                data_sensitivity=DataSensitivity.SYNTHETIC,
                storage_mode=StorageMode.PLAIN_SQLITE_PROTOTYPE,
            )
        )

        with self.assertRaises(HTTPException) as denied:
            record_operator_decision(
                "api-workspace-operator-access",
                OperatorActionDecisionRequest(
                    action_id="ask-q-001",
                    action_kind="ask",
                    action_title="Ask the next question",
                    action_detail="q-001",
                    action_priority="high",
                    decision_type="opened",
                    case_id="case-001",
                    target_question_id="q-001",
                    role=WorkspaceRole.OBSERVER,
                ),
            )

        with self.assertRaises(HTTPException) as bad_question:
            record_operator_decision(
                "api-workspace-operator-access",
                OperatorActionDecisionRequest(
                    action_id="ask-unknown",
                    action_kind="ask",
                    action_title="Ask the next question",
                    action_detail="unknown",
                    action_priority="high",
                    decision_type="opened",
                    case_id="case-001",
                    target_question_id="q-missing",
                ),
            )

        self.assertEqual(denied.exception.status_code, 403)
        self.assertEqual(bad_question.exception.status_code, 400)

    def test_operator_action_decisions_support_skip_and_dismiss_controls(self) -> None:
        app = create_app(
            workspace_manager=CaseWorkspaceManager(
                TEST_OUTPUT_ROOT / f"workspaces-{uuid.uuid4()}",
                encryption_status_provider=_unavailable_encryption_status,
            )
        )
        create_workspace = endpoint(app, "create_workspace")
        record_operator_decision = endpoint(app, "record_workspace_operator_action_decision")
        list_operator_decisions = endpoint(app, "list_workspace_operator_action_decisions")
        get_workspace_audit = endpoint(app, "get_workspace_audit")

        create_workspace(
            CreateWorkspaceRequest(
                case_id="case-003",
                created_by="investigator-001",
                workspace_id="api-workspace-operator-controls",
                data_sensitivity=DataSensitivity.SYNTHETIC,
                storage_mode=StorageMode.PLAIN_SQLITE_PROTOTYPE,
            )
        )

        skipped = record_operator_decision(
            "api-workspace-operator-controls",
            OperatorActionDecisionRequest(
                action_id="ask-q-305",
                action_kind="ask",
                action_title="Ask the next question",
                action_detail="q-305: Medication reconciliation follow-up",
                action_priority="high",
                decision_type="skipped",
                created_by="investigator-001",
                case_id="case-003",
                session_id="session-operator-controls",
                participant_id="person-001",
                target_question_id="q-305",
                source_object_ids=["q-305", "topic-documentation"],
                before_state={"active_question_id": "q-301"},
                after_state={
                    "active_question_id": "q-301",
                    "hidden_action_id": "ask-q-305",
                },
            ),
        )
        dismissed = record_operator_decision(
            "api-workspace-operator-controls",
            OperatorActionDecisionRequest(
                action_id="materials-q-301",
                action_kind="materials",
                action_title="Check sources for this question",
                action_detail="Monitoring memo, medication cabinet key handover",
                action_priority="medium",
                decision_type="dismissed",
                created_by="investigator-001",
                case_id="case-003",
                session_id="session-operator-controls",
                participant_id="person-001",
                target_tab="materials",
                source_object_ids=["material-monitoring", "material-key-handover"],
                before_state={"active_operations_tab": "monitor"},
                after_state={
                    "active_operations_tab": "monitor",
                    "hidden_action_id": "materials-q-301",
                },
            ),
        )

        decisions = list_operator_decisions(
            "api-workspace-operator-controls",
            case_id="case-003",
            session_id="session-operator-controls",
        )
        workspace_audit = get_workspace_audit("api-workspace-operator-controls")

        self.assertEqual(skipped["decision"]["decision_type"], "skipped")
        self.assertEqual(skipped["audit_event"]["action"], "operator_action_skipped")
        self.assertEqual(dismissed["decision"]["decision_type"], "dismissed")
        self.assertEqual(dismissed["audit_event"]["action"], "operator_action_dismissed")
        self.assertTrue(decisions["chain_valid"])
        self.assertEqual(
            [decision["decision_type"] for decision in decisions["decisions"]],
            ["dismissed", "skipped"],
        )
        self.assertEqual(
            decisions["decisions"][0]["event_hash"],
            dismissed["decision"]["event_hash"],
        )
        self.assertEqual(
            [event["action"] for event in workspace_audit["events"]],
            ["operator_action_skipped", "operator_action_dismissed"],
        )
        self.assertTrue(workspace_audit["chain_valid"])

    def test_grounded_suggestions_warn_when_artifact_isolation_is_missing(self) -> None:
        app = create_app(
            workspace_manager=CaseWorkspaceManager(
                TEST_OUTPUT_ROOT / f"workspaces-{uuid.uuid4()}",
                encryption_status_provider=_unavailable_encryption_status,
            )
        )
        create_workspace = endpoint(app, "create_workspace")
        generate_grounded_suggestions = endpoint(app, "generate_workspace_grounded_suggestions")
        get_model_artifact_manifest = endpoint(app, "get_workspace_model_artifact_manifest")
        get_workspace_audit = endpoint(app, "get_workspace_audit")

        create_workspace(
            CreateWorkspaceRequest(
                case_id="case-001",
                created_by="investigator-001",
                workspace_id="api-workspace-missing-artifacts",
                data_sensitivity=DataSensitivity.SYNTHETIC,
                storage_mode=StorageMode.PLAIN_SQLITE_PROTOTYPE,
            )
        )

        grounded_suggestions = generate_grounded_suggestions(
            "api-workspace-missing-artifacts",
            case_id="case-001",
            session_id=None,
            question_id="q-001",
            locale="en",
        )
        manifest = get_model_artifact_manifest("api-workspace-missing-artifacts")
        workspace_audit = get_workspace_audit("api-workspace-missing-artifacts")

        self.assertTrue(grounded_suggestions["suggestions"])
        self.assertIsNone(grounded_suggestions["prompt_artifact"])
        self.assertIsNone(grounded_suggestions["context_artifact"])
        self.assertIsNone(grounded_suggestions["output_artifact"])
        self.assertIn("not ready", grounded_suggestions["artifact_warning"])
        self.assertEqual(manifest["record_count"], 0)
        self.assertTrue(manifest["chain_valid"])
        self.assertTrue(workspace_audit["chain_valid"])
        self.assertEqual(workspace_audit["events"][0]["action"], "grounded_suggestions_generated")
        self.assertIn("artifact_warning", workspace_audit["events"][0]["details"])
        self.assertNotIn("context_artifact_id", workspace_audit["events"][0]["details"])

    def test_grounded_suggestions_deduplicate_repeated_artifacts(self) -> None:
        app = create_app(
            workspace_manager=CaseWorkspaceManager(
                TEST_OUTPUT_ROOT / f"workspaces-{uuid.uuid4()}",
                encryption_status_provider=_unavailable_encryption_status,
            )
        )
        create_workspace = endpoint(app, "create_workspace")
        ensure_model_artifacts = endpoint(app, "ensure_workspace_model_artifact_isolation")
        generate_grounded_suggestions = endpoint(app, "generate_workspace_grounded_suggestions")
        get_model_artifact_manifest = endpoint(app, "get_workspace_model_artifact_manifest")
        get_workspace_audit = endpoint(app, "get_workspace_audit")

        create_workspace(
            CreateWorkspaceRequest(
                case_id="case-001",
                created_by="investigator-001",
                workspace_id="api-workspace-dedup-artifacts",
                data_sensitivity=DataSensitivity.SYNTHETIC,
                storage_mode=StorageMode.PLAIN_SQLITE_PROTOTYPE,
            )
        )
        ensure_model_artifacts(
            "api-workspace-dedup-artifacts",
            ModelArtifactIsolationRequest(created_by="admin-001", role=WorkspaceRole.ADMIN),
        )

        first = generate_grounded_suggestions(
            "api-workspace-dedup-artifacts",
            case_id="case-001",
            session_id=None,
            question_id="q-001",
            locale="en",
        )
        first_manifest = get_model_artifact_manifest("api-workspace-dedup-artifacts")
        second = generate_grounded_suggestions(
            "api-workspace-dedup-artifacts",
            case_id="case-001",
            session_id=None,
            question_id="q-001",
            locale="en",
        )
        second_manifest = get_model_artifact_manifest("api-workspace-dedup-artifacts")
        workspace_audit = get_workspace_audit("api-workspace-dedup-artifacts")

        self.assertEqual(first_manifest["record_count"], 3)
        self.assertTrue(first_manifest["chain_valid"])
        self.assertEqual(second_manifest["record_count"], 3)
        self.assertTrue(second_manifest["chain_valid"])
        self.assertEqual(
            [record["artifact_type"] for record in second_manifest["records"]],
            ["prompt", "context", "output"],
        )
        for key in ("prompt_artifact", "context_artifact", "output_artifact"):
            self.assertEqual(second[key]["artifact_id"], first[key]["artifact_id"])
            self.assertFalse(first[key]["deduplicated"])
            self.assertTrue(second[key]["deduplicated"])

        self.assertFalse(workspace_audit["events"][0]["details"]["prompt_artifact_deduplicated"])
        self.assertTrue(workspace_audit["events"][1]["details"]["prompt_artifact_deduplicated"])

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
