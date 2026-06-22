"""FastAPI application for the local prototype."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import sqlite3
import uuid
from dataclasses import asdict, dataclass, field, is_dataclass, replace
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Callable


BACKEND_ROOT = Path(__file__).resolve().parents[2]
PROJECT_ROOT = Path(__file__).resolve().parents[3]

try:
    from fastapi import FastAPI, HTTPException, Query  # type: ignore  # noqa: E402
    from fastapi.middleware.cors import CORSMiddleware  # type: ignore  # noqa: E402
except Exception:  # pragma: no cover - exercised in restricted local environments
    CORSMiddleware = None

    @dataclass(frozen=True)
    class _FallbackRoute:
        path: str
        name: str
        endpoint: Callable[..., Any]
        methods: tuple[str, ...]

    class HTTPException(Exception):
        def __init__(self, status_code: int, detail: str) -> None:
            super().__init__(detail)
            self.status_code = status_code
            self.detail = detail

    class FastAPI:
        def __init__(self, **_: Any) -> None:
            self.routes: list[_FallbackRoute] = []

        def add_middleware(self, *_: Any, **__: Any) -> None:
            return None

        def middleware(self, *_: Any, **__: Any) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
            def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
                return func

            return decorator

        def get(self, path: str) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
            return self._route(path, ("GET",))

        def post(self, path: str) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
            return self._route(path, ("POST",))

        def _route(
            self,
            path: str,
            methods: tuple[str, ...],
        ) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
            def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
                self.routes.append(
                    _FallbackRoute(
                        path=path,
                        name=func.__name__,
                        endpoint=func,
                        methods=methods,
                    )
                )
                return func

            return decorator

    def Query(default: Any = None, **_: Any) -> Any:
        return default

from interrogaition.analysis.credibility_indicators import generate_indicators
from interrogaition.analysis.claim_extraction import answer_with_extracted_claims
from interrogaition.analysis.claim_provenance import verify_session_claim_provenance
from interrogaition.analysis.evidence_alignment import build_evidence_alignment
from interrogaition.analysis.evidence_map import build_evidence_map
from interrogaition.analysis.grounding_context import build_grounding_context_pack
from interrogaition.analysis.interview_review import review_case
from interrogaition.analysis.live_review import review_live_session
from interrogaition.analysis.material_grounding import (
    MaterialText,
    infer_material_topic_signals,
    link_materials_to_questions,
)
from interrogaition.analysis.material_link_decisions import (
    MaterialLinkDecisionLog,
    derive_material_link_decisions,
)
from interrogaition.ai.grounded_suggestion_service import GroundedSuggestionResult, generate_grounded_suggestions
from interrogaition.ai.local_model_runtime import (
    LOCAL_MODEL_SMOKE_SYSTEM_PROMPT,
    LOCAL_MODEL_SMOKE_USER_PROMPT,
    LocalModelSmokeResult,
    LocalModelRuntimeConfig,
    load_local_model_runtime_config,
    resolve_grounded_model_client,
    run_local_model_smoke,
)
from interrogaition.ai.model_experiment_gate import (
    ModelExperimentReadinessReport,
    assess_model_experiment_readiness,
)
from interrogaition.ai.model_client import ModelClient
from interrogaition.domain.models import (
    Actor,
    Answer,
    AuditEvent,
    Claim,
    ClaimReviewStatus,
    Case,
    Priority,
    Question,
    QuestionSource,
    QuestionType,
    SuggestionStatus,
)
from interrogaition.domain.session import (
    InterviewSession,
    ParticipantRole,
    add_answer,
    merge_session_answers,
    start_interview_session,
)
from interrogaition.export.integrity_manifest import (
    ExportIntegrityError,
    create_export_bundle_base64,
    create_export_manifest_from_contents,
    create_model_artifact_manifest_reference,
    export_manifest_to_dict,
    verify_export_manifest_contents,
)
from interrogaition.export.markdown_report import render_review_markdown
from interrogaition.security.access_policy import (
    WorkspaceAction,
    WorkspaceRole,
    decide_workspace_access,
)
from interrogaition.security.case_workspace import (
    CaseWorkspace,
    CaseWorkspaceManager,
    DataSensitivity,
    StorageMode,
    WorkspaceError,
)
from interrogaition.security.environment_health import build_environment_health_report
from interrogaition.security.model_artifacts import (
    ModelArtifactWriteResult,
    ensure_model_artifact_isolation,
    inspect_model_artifact_isolation,
    list_model_artifact_manifest,
    write_model_artifact,
)
from interrogaition.security.workspace_security import assess_workspace_security
from interrogaition.storage.json_case_loader import load_case_from_json
from interrogaition.storage.material_registry import (
    MaterialRegistry,
    MaterialRegistryError,
    MaterialSourceType,
)
from interrogaition.storage.session_store import SessionStore
from interrogaition.storage.sqlite_session_store import SQLiteSessionStore
from interrogaition.storage.synthetic_material_loader import (
    SyntheticMaterial,
    load_synthetic_materials,
)


SYNTHETIC_CASES_ROOT = PROJECT_ROOT / "data" / "synthetic"
DEFAULT_DATABASE_PATH = BACKEND_ROOT / "local-data" / "interrogaition.sqlite3"
DEFAULT_WORKSPACE_ROOT = BACKEND_ROOT / "local-data" / "workspaces"
REQUIRED_CLAIM_FIELDS = ("id", "subject", "attribute", "value")
MODEL_EXPERIMENT_STOP_GATE_ID = "local_model_real_smoke"
STOP_REVIEW_DECISIONS = {"approved", "rejected"}


@dataclass(frozen=True)
class StartSessionRequest:
    session_id: str
    case_id: str
    participant_id: str
    initial_role: ParticipantRole


@dataclass(frozen=True)
class AddAnswerRequest:
    id: str
    question_id: str
    text: str
    event_id: str
    topic_ids: list[str] = field(default_factory=list)
    claims: list[dict[str, Any]] = field(default_factory=list)
    workspace_id: str | None = None


@dataclass(frozen=True)
class ClaimReviewDecisionRequest:
    decision: ClaimReviewStatus
    subject: str = ""
    attribute: str = ""
    value: str = ""
    source_text: str = ""
    actor_id: str = "local-ui"
    operator_note: str = ""


@dataclass(frozen=True)
class CreateWorkspaceRequest:
    case_id: str
    created_by: str
    data_sensitivity: DataSensitivity = DataSensitivity.SYNTHETIC
    storage_mode: StorageMode = StorageMode.PLAIN_SQLITE_PROTOTYPE
    workspace_id: str | None = None


@dataclass(frozen=True)
class RegisterMaterialRequest:
    id: str
    title: str
    content: str
    created_by: str
    source_type: MaterialSourceType = MaterialSourceType.TEXT_NOTE
    data_sensitivity: DataSensitivity = DataSensitivity.SYNTHETIC
    description: str = ""
    tags: list[str] = field(default_factory=list)
    mime_type: str = "text/plain"
    original_name: str | None = None
    role: WorkspaceRole = WorkspaceRole.INVESTIGATOR


@dataclass(frozen=True)
class SeedWorkspaceMaterialsRequest:
    created_by: str = "local-ui"
    locale: str = "en"
    role: WorkspaceRole = WorkspaceRole.INVESTIGATOR


@dataclass(frozen=True)
class ModelArtifactIsolationRequest:
    created_by: str = "local-ui"
    role: WorkspaceRole = WorkspaceRole.ADMIN


@dataclass(frozen=True)
class ModelArtifactWriteRequest:
    artifact_type: str
    content: str
    created_by: str = "local-ui"
    content_type: str = "application/json"
    source: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)
    role: WorkspaceRole = WorkspaceRole.INVESTIGATOR


@dataclass(frozen=True)
class GroundedSuggestionDecisionRequest:
    decision: SuggestionStatus
    original_text: str
    final_text: str = ""
    suggestion_type: str = ""
    reason: str = ""
    linked_topics: list[str] = field(default_factory=list)
    linked_evidence: list[str] = field(default_factory=list)
    risk_flags: list[str] = field(default_factory=list)
    confidence: float | None = None
    model: str = ""
    prompt_version: str = ""
    prompt_hash: str = ""
    context_hash: str = ""
    output_hash: str = ""
    actor_id: str = "local-ui"
    case_id: str | None = None
    session_id: str | None = None
    question_id: str | None = None
    role: WorkspaceRole = WorkspaceRole.INVESTIGATOR


@dataclass(frozen=True)
class OperatorActionDecisionRequest:
    action_id: str
    action_kind: str
    action_title: str
    action_detail: str
    action_priority: str
    decision_type: str
    created_by: str = "local-ui"
    case_id: str | None = None
    session_id: str | None = None
    participant_id: str | None = None
    target_question_id: str | None = None
    target_tab: str | None = None
    source_object_ids: list[str] = field(default_factory=list)
    operator_note: str = ""
    before_state: dict[str, Any] = field(default_factory=dict)
    after_state: dict[str, Any] = field(default_factory=dict)
    model_id: str = ""
    prompt_version: str = ""
    prompt_hash: str = ""
    context_hash: str = ""
    output_hash: str = ""
    role: WorkspaceRole = WorkspaceRole.INVESTIGATOR


@dataclass(frozen=True)
class StopReviewDecisionRequest:
    gate_id: str = MODEL_EXPERIMENT_STOP_GATE_ID
    decision: str = "approved"
    created_by: str = "local-ui"
    rationale: str = ""
    checklist: list[str] = field(default_factory=list)
    role: WorkspaceRole = WorkspaceRole.ADMIN


@dataclass(frozen=True)
class CreateQuestionDraftRequest:
    material_id: str
    case_id: str | None = None
    session_id: str | None = None
    participant_id: str | None = None
    topic_id: str | None = None
    source_object_ids: list[str] = field(default_factory=list)
    action_id: str = ""
    locale: str = "en"
    created_by: str = "local-ui"
    role: WorkspaceRole = WorkspaceRole.INVESTIGATOR


@dataclass(frozen=True)
class ExportFileContent:
    path: str
    content: str


@dataclass(frozen=True)
class ExportIntegrityPreviewRequest:
    case_id: str
    created_by: str = "local-ui"
    files: list[ExportFileContent] = field(default_factory=list)
    include_model_artifacts: bool = True


@dataclass(frozen=True)
class ExportBundleRequest:
    case_id: str
    created_by: str = "local-ui"
    markdown: str = ""
    markdown_path: str = "session-report.md"
    json_export: str | None = None
    include_model_artifacts: bool = True


@dataclass(frozen=True)
class MaterialQuestionLinkDecisionRequest:
    decision: str
    case_id: str
    question_id: str
    topic_ids: list[str] = field(default_factory=list)
    matched_terms: list[str] = field(default_factory=list)
    confidence: float | None = None
    rationale: str = ""
    actor_id: str = "local-ui"
    session_id: str | None = None
    role: WorkspaceRole = WorkspaceRole.INVESTIGATOR


def create_app(
    store: SessionStore | None = None,
    workspace_manager: CaseWorkspaceManager | None = None,
    model_client: ModelClient | None = None,
    local_model_config: LocalModelRuntimeConfig | None = None,
) -> FastAPI:
    app = FastAPI(
        title="InterrogA(I)tion Local API",
        version="0.1.0",
        description="Local API for the AI-assisted investigative interviewing prototype.",
    )
    if CORSMiddleware is not None:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[
                "http://127.0.0.1:5500",
                "http://localhost:5500",
                "http://127.0.0.1:5173",
                "http://localhost:5173",
                "http://127.0.0.1:8000",
                "http://localhost:8000",
                "null",
            ],
            allow_credentials=False,
            allow_methods=["GET", "POST"],
            allow_headers=["*"],
        )

    @app.middleware("http")
    async def add_private_network_access_header(request: Any, call_next: Callable[[Any], Any]) -> Any:
        response = await call_next(request)
        response.headers["Access-Control-Allow-Private-Network"] = "true"
        return response

    store = store or SQLiteSessionStore.in_memory()
    workspace_manager = workspace_manager or CaseWorkspaceManager(DEFAULT_WORKSPACE_ROOT)
    grounded_model_client_override = model_client
    local_model_config = local_model_config or load_local_model_runtime_config()

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/environment/health")
    def get_environment_health() -> dict[str, Any]:
        return _to_jsonable(
            build_environment_health_report(
                synthetic_cases_root=SYNTHETIC_CASES_ROOT,
                workspace_root=workspace_manager.root_path,
                encryption_status=workspace_manager.encryption_status(),
                local_model_config=local_model_config,
            )
        )

    @app.get("/locales")
    def locales() -> dict[str, list[str]]:
        return {"locales": ["en", "pl"]}

    @app.get("/cases")
    def list_cases(locale: str = Query(default="en")) -> dict[str, Any]:
        return {
            "cases": [
                _case_catalog_item(case)
                for case in _list_synthetic_cases(locale=locale)
            ]
        }

    @app.get("/cases/{case_id}/starter-materials")
    def list_case_starter_materials(
        case_id: str,
        locale: str = Query(default="en"),
    ) -> dict[str, Any]:
        _load_synthetic_case(case_id, locale=locale)
        return {
            "case_id": case_id,
            "materials": _to_jsonable(_load_synthetic_starter_materials(case_id, locale=locale)),
        }

    @app.get("/security/encryption")
    def get_encryption_status() -> dict[str, Any]:
        return _to_jsonable(workspace_manager.encryption_status())

    @app.get("/ai/local-model/config")
    def get_local_model_config() -> dict[str, Any]:
        return {
            "provider": local_model_config.provider,
            "effective_provider": local_model_config.effective_provider,
            "configured_model": local_model_config.configured_model,
            "ollama_base_url": local_model_config.ollama_base_url,
            "timeout_seconds": local_model_config.timeout_seconds,
            "temperature": local_model_config.temperature,
            "real_model_enabled": local_model_config.real_model_enabled,
            "live_output_enabled": local_model_config.live_output_enabled,
            "restrictions": list(local_model_config.restrictions),
        }

    @app.post("/ai/local-model/smoke")
    def smoke_local_model(
        execute_real: bool = False,
        workspace_id: str | None = None,
    ) -> dict[str, Any]:
        effective_workspace_id = workspace_id.strip() if isinstance(workspace_id, str) and workspace_id.strip() else None
        workspace: CaseWorkspace | None = None
        if execute_real:
            try:
                if effective_workspace_id:
                    workspace = workspace_manager.open_workspace(effective_workspace_id)
                readiness = _assess_local_model_experiment_readiness(
                    workspace_manager=workspace_manager,
                    store=store,
                    config=local_model_config,
                    workspace_id=effective_workspace_id,
                )
            except WorkspaceError as exc:
                raise HTTPException(status_code=404, detail=str(exc)) from exc
            if not readiness.can_run_real_smoke:
                result = _blocked_local_model_smoke(local_model_config, readiness)
                if workspace is not None:
                    _append_local_model_smoke_audit_event(
                        store=store,
                        workspace=workspace,
                        action="local_model_smoke_blocked",
                        readiness=readiness,
                        result=result,
                    )
                return _to_jsonable(result)

        result = run_local_model_smoke(
            local_model_config,
            execute_real=execute_real,
            model_client=grounded_model_client_override if execute_real else None,
        )
        if execute_real and workspace is not None:
            _append_local_model_smoke_audit_event(
                store=store,
                workspace=workspace,
                action="local_model_smoke_completed" if result.ok else "local_model_smoke_failed",
                readiness=readiness,
                result=result,
            )
        return _to_jsonable(
            result
        )

    @app.get("/ai/local-model/experiment-readiness")
    def get_local_model_experiment_readiness(
        workspace_id: str | None = None,
    ) -> dict[str, Any]:
        try:
            return _to_jsonable(
                _assess_local_model_experiment_readiness(
                    workspace_manager=workspace_manager,
                    store=store,
                    config=local_model_config,
                    workspace_id=workspace_id,
                )
            )
        except WorkspaceError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @app.post("/workspaces")
    def create_workspace(request: CreateWorkspaceRequest) -> dict[str, Any]:
        try:
            workspace = workspace_manager.create_workspace(
                case_id=request.case_id,
                created_by=request.created_by,
                data_sensitivity=request.data_sensitivity,
                storage_mode=request.storage_mode,
                workspace_id=request.workspace_id,
            )
        except WorkspaceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        return _workspace_response(workspace)

    @app.get("/workspaces/{workspace_id}")
    def get_workspace(workspace_id: str) -> dict[str, Any]:
        try:
            workspace = workspace_manager.open_workspace(workspace_id)
        except WorkspaceError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

        return _workspace_response(workspace)

    @app.get("/workspaces/{workspace_id}/access")
    def get_workspace_access(
        workspace_id: str,
        role: WorkspaceRole,
        action: WorkspaceAction,
    ) -> dict[str, Any]:
        try:
            workspace = workspace_manager.open_workspace(workspace_id)
        except WorkspaceError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

        return _to_jsonable(
            decide_workspace_access(
                role=role,
                action=action,
                manifest=workspace.manifest,
            )
        )

    @app.get("/workspaces/{workspace_id}/security")
    def get_workspace_security(
        workspace_id: str,
        role: WorkspaceRole = WorkspaceRole.INVESTIGATOR,
    ) -> dict[str, Any]:
        try:
            workspace = workspace_manager.open_workspace(workspace_id)
        except WorkspaceError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

        decision = decide_workspace_access(
            role=role,
            action=WorkspaceAction.READ_CASE,
            manifest=workspace.manifest,
        )
        if not decision.allowed:
            raise HTTPException(status_code=403, detail=decision.reason)

        return _to_jsonable(
            assess_workspace_security(
                manifest=workspace.manifest,
                encryption_status=workspace_manager.encryption_status(),
            )
        )

    @app.get("/workspaces/{workspace_id}/demo-readiness")
    def get_workspace_demo_readiness(
        workspace_id: str,
        case_id: str | None = Query(default=None),
        session_id: str | None = Query(default=None),
        role: WorkspaceRole = WorkspaceRole.INVESTIGATOR,
    ) -> dict[str, Any]:
        try:
            workspace = workspace_manager.open_workspace(workspace_id)
        except WorkspaceError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

        decision = decide_workspace_access(
            role=role,
            action=WorkspaceAction.READ_CASE,
            manifest=workspace.manifest,
        )
        if not decision.allowed:
            raise HTTPException(status_code=403, detail=decision.reason)

        effective_case_id = case_id or workspace.manifest.case_id
        if effective_case_id != workspace.manifest.case_id:
            raise HTTPException(status_code=400, detail="case_id does not match workspace.")

        return _to_jsonable(
            _build_demo_readiness_report(
                workspace=workspace,
                case_id=effective_case_id,
                session_id=session_id,
                workspace_manager=workspace_manager,
                store=store,
                local_model_config=local_model_config,
            )
        )

    @app.get("/workspaces/{workspace_id}/case-quality")
    def get_workspace_case_quality(
        workspace_id: str,
        case_id: str | None = Query(default=None),
        session_id: str | None = Query(default=None),
        locale: str = Query(default="en"),
        role: WorkspaceRole = WorkspaceRole.INVESTIGATOR,
    ) -> dict[str, Any]:
        try:
            workspace = workspace_manager.open_workspace(workspace_id)
        except WorkspaceError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

        decision = decide_workspace_access(
            role=role,
            action=WorkspaceAction.READ_CASE,
            manifest=workspace.manifest,
        )
        if not decision.allowed:
            raise HTTPException(status_code=403, detail=decision.reason)

        effective_case_id = case_id or workspace.manifest.case_id
        if effective_case_id != workspace.manifest.case_id:
            raise HTTPException(status_code=400, detail="case_id does not match workspace.")
        session = store.get_session(session_id) if session_id else None
        if session is not None and session.case_id != effective_case_id:
            raise HTTPException(status_code=400, detail="session case_id does not match workspace.")

        try:
            registry = MaterialRegistry(workspace)
            material_texts = _read_workspace_material_texts(registry)
        except MaterialRegistryError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        return _to_jsonable(
            _build_case_quality_report(
                workspace=workspace,
                case_id=effective_case_id,
                session_id=session_id,
                locale=locale,
                workspace_manager=workspace_manager,
                store=store,
                material_texts=material_texts,
            )
        )

    @app.get("/workspaces/{workspace_id}/model-artifacts")
    def get_workspace_model_artifacts(
        workspace_id: str,
        role: WorkspaceRole = WorkspaceRole.INVESTIGATOR,
    ) -> dict[str, Any]:
        try:
            workspace = workspace_manager.open_workspace(workspace_id)
        except WorkspaceError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

        decision = decide_workspace_access(
            role=role,
            action=WorkspaceAction.READ_CASE,
            manifest=workspace.manifest,
        )
        if not decision.allowed:
            raise HTTPException(status_code=403, detail=decision.reason)

        try:
            return _to_jsonable(inspect_model_artifact_isolation(workspace))
        except WorkspaceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/workspaces/{workspace_id}/model-artifacts/isolation")
    def ensure_workspace_model_artifact_isolation(
        workspace_id: str,
        request: ModelArtifactIsolationRequest,
    ) -> dict[str, Any]:
        try:
            workspace = workspace_manager.open_workspace(workspace_id)
        except WorkspaceError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

        decision = decide_workspace_access(
            role=request.role,
            action=WorkspaceAction.MANAGE_WORKSPACE,
            manifest=workspace.manifest,
        )
        if not decision.allowed:
            raise HTTPException(status_code=403, detail=decision.reason)

        try:
            return _to_jsonable(
                ensure_model_artifact_isolation(
                    workspace,
                    created_by=request.created_by,
                )
            )
        except WorkspaceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.get("/workspaces/{workspace_id}/model-artifacts/manifest")
    def get_workspace_model_artifact_manifest(
        workspace_id: str,
        role: WorkspaceRole = WorkspaceRole.INVESTIGATOR,
    ) -> dict[str, Any]:
        try:
            workspace = workspace_manager.open_workspace(workspace_id)
        except WorkspaceError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

        decision = decide_workspace_access(
            role=role,
            action=WorkspaceAction.READ_CASE,
            manifest=workspace.manifest,
        )
        if not decision.allowed:
            raise HTTPException(status_code=403, detail=decision.reason)

        try:
            return _to_jsonable(list_model_artifact_manifest(workspace))
        except WorkspaceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/workspaces/{workspace_id}/model-artifacts/items")
    def write_workspace_model_artifact(
        workspace_id: str,
        request: ModelArtifactWriteRequest,
    ) -> dict[str, Any]:
        try:
            workspace = workspace_manager.open_workspace(workspace_id)
        except WorkspaceError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

        decision = decide_workspace_access(
            role=request.role,
            action=WorkspaceAction.RUN_REVIEW,
            manifest=workspace.manifest,
        )
        if not decision.allowed:
            raise HTTPException(status_code=403, detail=decision.reason)

        try:
            return _to_jsonable(
                write_model_artifact(
                    workspace,
                    artifact_type=request.artifact_type,
                    content=request.content,
                    created_by=request.created_by,
                    content_type=request.content_type,
                    source=request.source,
                    metadata=request.metadata,
                )
            )
        except WorkspaceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.get("/workspaces/{workspace_id}/materials")
    def list_workspace_materials(workspace_id: str) -> dict[str, Any]:
        try:
            workspace = workspace_manager.open_workspace(workspace_id)
            materials = MaterialRegistry(workspace).list_materials()
        except WorkspaceError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except MaterialRegistryError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        return {"materials": _to_jsonable(materials)}

    @app.post("/workspaces/{workspace_id}/materials/seed")
    def seed_workspace_materials(
        workspace_id: str,
        request: SeedWorkspaceMaterialsRequest,
    ) -> dict[str, Any]:
        try:
            workspace = workspace_manager.open_workspace(workspace_id)
            registry = MaterialRegistry(workspace)
        except WorkspaceError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

        decision = decide_workspace_access(
            role=request.role,
            action=WorkspaceAction.IMPORT_MATERIAL,
            manifest=workspace.manifest,
        )
        if not decision.allowed:
            raise HTTPException(status_code=403, detail=decision.reason)

        starter_materials = _load_synthetic_starter_materials(
            workspace.manifest.case_id,
            locale=request.locale,
        )
        try:
            existing_ids = {material.id for material in registry.list_materials()}
        except MaterialRegistryError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        imported_ids: list[str] = []
        skipped_ids: list[str] = []

        for material in starter_materials:
            if material.id in existing_ids:
                skipped_ids.append(material.id)
                continue
            try:
                registry.register_text_material(
                    material_id=material.id,
                    title=material.title,
                    content=material.content,
                    created_by=request.created_by,
                    source_type=material.source_type,
                    data_sensitivity=DataSensitivity.SYNTHETIC,
                    description=material.description,
                    tags=material.tags,
                )
            except MaterialRegistryError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc
            imported_ids.append(material.id)
            existing_ids.add(material.id)

        try:
            materials = registry.list_materials()
        except MaterialRegistryError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        return {
            "materials": _to_jsonable(materials),
            "imported_count": len(imported_ids),
            "skipped_count": len(skipped_ids),
            "imported_ids": imported_ids,
            "skipped_ids": skipped_ids,
        }

    @app.get("/workspaces/{workspace_id}/materials/{material_id}/preview")
    def get_workspace_material_preview(
        workspace_id: str,
        material_id: str,
        role: WorkspaceRole = WorkspaceRole.INVESTIGATOR,
    ) -> dict[str, Any]:
        try:
            workspace = workspace_manager.open_workspace(workspace_id)
            registry = MaterialRegistry(workspace)
            materials = registry.list_materials()
            record = next((item for item in materials if item.id == material_id), None)
            if record is None:
                raise MaterialRegistryError(f"Unknown material: {material_id}.")
        except WorkspaceError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except MaterialRegistryError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        decision = decide_workspace_access(
            role=role,
            action=WorkspaceAction.READ_CASE,
            manifest=workspace.manifest,
        )
        if not decision.allowed:
            raise HTTPException(status_code=403, detail=decision.reason)

        try:
            content = registry.read_material_text(material_id)
        except MaterialRegistryError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        preview_limit = 4000
        preview_text = content[:preview_limit]
        return {
            "material_id": record.id,
            "title": record.title,
            "mime_type": record.mime_type,
            "text_preview": preview_text,
            "truncated": len(content) > preview_limit,
            "line_count": len(content.splitlines()) or (1 if content else 0),
            "char_count": len(content),
        }

    @app.post("/workspaces/{workspace_id}/materials")
    def register_workspace_material(
        workspace_id: str,
        request: RegisterMaterialRequest,
    ) -> dict[str, Any]:
        try:
            workspace = workspace_manager.open_workspace(workspace_id)
        except WorkspaceError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

        decision = decide_workspace_access(
            role=request.role,
            action=WorkspaceAction.IMPORT_MATERIAL,
            manifest=workspace.manifest,
        )
        if not decision.allowed:
            raise HTTPException(status_code=403, detail=decision.reason)

        try:
            record = MaterialRegistry(workspace).register_text_material(
                material_id=request.id,
                title=request.title,
                content=request.content,
                created_by=request.created_by,
                source_type=request.source_type,
                data_sensitivity=request.data_sensitivity,
                description=request.description,
                tags=tuple(request.tags),
                mime_type=request.mime_type,
                original_name=request.original_name,
            )
        except MaterialRegistryError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        return _to_jsonable(record)

    @app.get("/workspaces/{workspace_id}/materials/links")
    def link_workspace_materials_to_questions(
        workspace_id: str,
        case_id: str,
        locale: str = Query(default="en"),
    ) -> dict[str, Any]:
        try:
            workspace = workspace_manager.open_workspace(workspace_id)
            registry = MaterialRegistry(workspace)
            material_texts = _read_workspace_material_texts(registry)
        except WorkspaceError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except MaterialRegistryError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        case = _load_synthetic_case(case_id, locale=locale)
        links = link_materials_to_questions(case, material_texts)
        return {"links": _to_jsonable(links)}

    @app.post("/workspaces/{workspace_id}/materials/{material_id}/questions/{question_id}/decision")
    def record_material_question_link_decision(
        workspace_id: str,
        material_id: str,
        question_id: str,
        request: MaterialQuestionLinkDecisionRequest,
    ) -> dict[str, Any]:
        try:
            workspace = workspace_manager.open_workspace(workspace_id)
            registry = MaterialRegistry(workspace)
            material_ids = {material.id for material in registry.list_materials()}
        except WorkspaceError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except MaterialRegistryError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        decision = decide_workspace_access(
            role=request.role,
            action=WorkspaceAction.WRITE_INTERVIEW,
            manifest=workspace.manifest,
        )
        if not decision.allowed:
            raise HTTPException(status_code=403, detail=decision.reason)

        case_id = request.case_id or workspace.manifest.case_id
        if case_id != workspace.manifest.case_id:
            raise HTTPException(status_code=400, detail="case_id does not match workspace.")
        case = _load_synthetic_case(case_id, locale="en")
        _validate_material_question_link_decision(
            material_id=material_id,
            question_id=question_id,
            request=request,
            material_ids=material_ids,
            question_ids={question.id for question in case.questions},
            topic_ids={topic.id for topic in case.topics},
        )

        audit_event = store.append_audit_event(
            actor=Actor.HUMAN,
            action=f"material_question_link_{request.decision}",
            object_type="material_question_link",
            object_id=f"{material_id}:{question_id}",
            details={
                "workspace_id": workspace_id,
                "case_id": case_id,
                "session_id": request.session_id,
                "material_id": material_id,
                "question_id": question_id,
                "decision": request.decision,
                "actor_id": request.actor_id,
                "topic_ids": list(request.topic_ids),
                "matched_terms": list(request.matched_terms),
                "confidence": request.confidence,
                "rationale": request.rationale,
            },
        )
        return {
            "decision": request.decision,
            "audit_event": _to_jsonable(audit_event),
            "chain_valid": store.verify_audit_chain(),
        }

    @app.get("/workspaces/{workspace_id}/question-drafts")
    def list_workspace_question_drafts(
        workspace_id: str,
        case_id: str | None = Query(default=None),
        session_id: str | None = Query(default=None),
        role: WorkspaceRole = WorkspaceRole.INVESTIGATOR,
    ) -> dict[str, Any]:
        try:
            workspace = workspace_manager.open_workspace(workspace_id)
        except WorkspaceError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

        decision = decide_workspace_access(
            role=role,
            action=WorkspaceAction.READ_CASE,
            manifest=workspace.manifest,
        )
        if not decision.allowed:
            raise HTTPException(status_code=403, detail=decision.reason)

        effective_case_id = case_id or workspace.manifest.case_id
        if effective_case_id != workspace.manifest.case_id:
            raise HTTPException(status_code=400, detail="case_id does not match workspace.")

        events = _question_draft_events(
            _workspace_audit_events(store.list_audit_events(), workspace_id),
            case_id=effective_case_id,
            session_id=session_id,
        )
        return {
            "workspace_id": workspace_id,
            "case_id": effective_case_id,
            "session_id": session_id,
            "drafts": [_question_draft_from_event(event) for event in events],
            "chain_valid": store.verify_audit_chain(),
        }

    @app.post("/workspaces/{workspace_id}/question-drafts")
    def create_workspace_question_draft(
        workspace_id: str,
        request: CreateQuestionDraftRequest,
    ) -> dict[str, Any]:
        try:
            workspace = workspace_manager.open_workspace(workspace_id)
            registry = MaterialRegistry(workspace)
            material = next(
                (item for item in registry.list_materials() if item.id == request.material_id),
                None,
            )
            if material is None:
                raise MaterialRegistryError(f"Unknown material: {request.material_id}.")
            material_text = registry.read_material_text(request.material_id)
        except WorkspaceError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except MaterialRegistryError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        decision = decide_workspace_access(
            role=request.role,
            action=WorkspaceAction.WRITE_INTERVIEW,
            manifest=workspace.manifest,
        )
        if not decision.allowed:
            raise HTTPException(status_code=403, detail=decision.reason)

        case_id = request.case_id or workspace.manifest.case_id
        if case_id != workspace.manifest.case_id:
            raise HTTPException(status_code=400, detail="case_id does not match workspace.")
        case = _load_synthetic_case(case_id, locale=request.locale)
        topic = None
        if request.topic_id:
            topic = next((item for item in case.topics if item.id == request.topic_id), None)
            if topic is None:
                raise HTTPException(status_code=400, detail=f"Unknown topic_id: {request.topic_id}.")

        draft = _build_material_question_draft(
            workspace_id=workspace_id,
            case_id=case_id,
            session_id=request.session_id,
            participant_id=request.participant_id,
            material_id=request.material_id,
            material_title=material.title,
            material_text=material_text,
            topic_id=request.topic_id,
            topic_label=topic.label if topic is not None else "",
            source_object_ids=request.source_object_ids,
            action_id=request.action_id,
            locale=request.locale,
            created_by=request.created_by,
        )
        audit_event = store.append_audit_event(
            actor=Actor.AI,
            action="question_draft_created",
            object_type="question_draft",
            object_id=draft["id"],
            details={
                "workspace_id": workspace_id,
                "case_id": case_id,
                "session_id": request.session_id,
                "participant_id": request.participant_id,
                "created_by": request.created_by,
                "material_id": request.material_id,
                "topic_id": request.topic_id,
                "action_id": request.action_id,
                "source_object_ids": draft["source_object_ids"],
                "draft": draft,
            },
        )
        return {
            "draft": _question_draft_from_event(audit_event),
            "audit_event": _to_jsonable(audit_event),
            "chain_valid": store.verify_audit_chain(),
        }

    @app.get("/workspaces/{workspace_id}/evidence-map")
    def get_workspace_evidence_map(
        workspace_id: str,
        case_id: str,
        session_id: str | None = Query(default=None),
        locale: str = Query(default="en"),
    ) -> dict[str, Any]:
        try:
            workspace = workspace_manager.open_workspace(workspace_id)
            registry = MaterialRegistry(workspace)
            material_texts = _read_workspace_material_texts(registry)
        except WorkspaceError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except MaterialRegistryError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        decisions = derive_material_link_decisions(
            _workspace_audit_events(store.list_audit_events(), workspace_id)
        )
        question_drafts = _question_draft_questions(
            _workspace_audit_events(store.list_audit_events(), workspace_id),
            case_id=case_id,
            session_id=session_id,
        )
        context = _build_evidence_context(
            case_id=case_id,
            locale=locale,
            session_id=session_id,
            store=store,
            material_texts=material_texts,
            material_link_decisions=decisions,
            question_drafts=question_drafts,
        )
        return {
            "evidence_map": _to_jsonable(context["evidence_map"]),
            "evidence_alignment": _to_jsonable(context["evidence_alignment"]),
        }

    @app.get("/workspaces/{workspace_id}/grounding-pack")
    def get_workspace_grounding_pack(
        workspace_id: str,
        case_id: str,
        session_id: str | None = Query(default=None),
        question_id: str | None = Query(default=None),
        locale: str = Query(default="en"),
    ) -> dict[str, Any]:
        try:
            workspace = workspace_manager.open_workspace(workspace_id)
            registry = MaterialRegistry(workspace)
            material_texts = _read_workspace_material_texts(registry)
        except WorkspaceError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except MaterialRegistryError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        question_drafts = _question_draft_questions(
            _workspace_audit_events(store.list_audit_events(), workspace_id),
            case_id=case_id,
            session_id=session_id,
        )
        context = _build_evidence_context(
            case_id=case_id,
            locale=locale,
            session_id=session_id,
            store=store,
            material_texts=material_texts,
            question_drafts=question_drafts,
        )
        case_view = context["case"]
        if question_id:
            _require_known_id(
                "question_id",
                question_id,
                {question.id for question in case_view.questions},
            )
        grounding_pack = build_grounding_context_pack(
            case=case_view,
            evidence_map=context["evidence_map"],
            materials=context["materials"],
            material_links=context["material_links"],
            focus_question_id=question_id,
        )
        return {"grounding_pack": _to_jsonable(grounding_pack)}

    @app.post("/workspaces/{workspace_id}/grounded-suggestions")
    def generate_workspace_grounded_suggestions(
        workspace_id: str,
        case_id: str,
        session_id: str | None = Query(default=None),
        question_id: str | None = Query(default=None),
        locale: str = Query(default="en"),
    ) -> dict[str, Any]:
        try:
            workspace = workspace_manager.open_workspace(workspace_id)
            registry = MaterialRegistry(workspace)
            material_texts = _read_workspace_material_texts(registry)
        except WorkspaceError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except MaterialRegistryError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        question_drafts = _question_draft_questions(
            _workspace_audit_events(store.list_audit_events(), workspace_id),
            case_id=case_id,
            session_id=session_id,
        )
        context = _build_evidence_context(
            case_id=case_id,
            locale=locale,
            session_id=session_id,
            store=store,
            material_texts=material_texts,
            question_drafts=question_drafts,
        )
        case_view = context["case"]
        if question_id:
            _require_known_id(
                "question_id",
                question_id,
                {question.id for question in case_view.questions},
            )
        grounding_pack = build_grounding_context_pack(
            case=case_view,
            evidence_map=context["evidence_map"],
            materials=context["materials"],
            material_links=context["material_links"],
            focus_question_id=question_id,
        )
        active_model_client = resolve_grounded_model_client(
            local_model_config,
            override=grounded_model_client_override,
        )
        try:
            result = generate_grounded_suggestions(
                grounding_pack=grounding_pack,
                model_client=active_model_client,
                locale=locale,
                citation_policy="warn",
            )
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Grounded suggestion generation failed: {exc}",
            ) from exc
        prompt_artifact, context_artifact, output_artifact, artifact_warning = _capture_grounded_suggestion_artifacts(
            workspace=workspace,
            grounding_pack=grounding_pack,
            result=result,
            case_id=case_id,
            session_id=session_id,
            question_id=question_id,
        )
        audit_details = {
            "case_id": case_id,
            "session_id": session_id,
            "question_id": question_id,
            "model": result.batch.model,
            "prompt_version": result.prompt_version,
            "prompt_hash": result.prompt_hash,
            "context_hash": result.context_hash,
            "output_hash": result.output_hash,
            "suggestion_count": len(result.batch.suggestions),
            "warning_count": len(result.warnings),
        }
        if prompt_artifact is not None:
            audit_details["prompt_artifact_id"] = prompt_artifact["artifact_id"]
            audit_details["prompt_artifact_sha256"] = prompt_artifact["sha256"]
            audit_details["prompt_artifact_deduplicated"] = prompt_artifact["deduplicated"]
        if context_artifact is not None:
            audit_details["context_artifact_id"] = context_artifact["artifact_id"]
            audit_details["context_artifact_sha256"] = context_artifact["sha256"]
            audit_details["context_artifact_deduplicated"] = context_artifact["deduplicated"]
        if output_artifact is not None:
            audit_details["output_artifact_id"] = output_artifact["artifact_id"]
            audit_details["output_artifact_sha256"] = output_artifact["sha256"]
            audit_details["output_artifact_deduplicated"] = output_artifact["deduplicated"]
        if artifact_warning:
            audit_details["artifact_warning"] = artifact_warning
        store.append_audit_event(
            actor=Actor.AI,
            action="grounded_suggestions_generated",
            object_type="workspace",
            object_id=workspace_id,
            details=audit_details,
        )
        return {
            "grounding_pack": _to_jsonable(grounding_pack),
            "suggestions": _to_jsonable(result.batch.suggestions),
            "model": result.batch.model,
            "prompt_version": result.prompt_version,
            "prompt_hash": result.prompt_hash,
            "context_hash": result.context_hash,
            "output_hash": result.output_hash,
            "warnings": _to_jsonable(result.warnings),
            "prompt_artifact": prompt_artifact,
            "context_artifact": context_artifact,
            "output_artifact": output_artifact,
            "artifact_warning": artifact_warning,
        }

    @app.post("/workspaces/{workspace_id}/grounded-suggestions/{suggestion_id}/decision")
    def record_workspace_grounded_suggestion_decision(
        workspace_id: str,
        suggestion_id: str,
        request: GroundedSuggestionDecisionRequest,
    ) -> dict[str, Any]:
        try:
            workspace = workspace_manager.open_workspace(workspace_id)
        except WorkspaceError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

        decision = decide_workspace_access(
            role=request.role,
            action=WorkspaceAction.WRITE_INTERVIEW,
            manifest=workspace.manifest,
        )
        if not decision.allowed:
            raise HTTPException(status_code=403, detail=decision.reason)

        _validate_grounded_suggestion_decision(suggestion_id, request)
        final_text = request.final_text.strip() or request.original_text.strip()
        audit_event = store.append_audit_event(
            actor=Actor.HUMAN,
            action=f"grounded_suggestion_{request.decision.value}",
            object_type="ai_suggestion",
            object_id=suggestion_id,
            details={
                "workspace_id": workspace_id,
                "case_id": request.case_id,
                "session_id": request.session_id,
                "question_id": request.question_id,
                "suggestion_id": suggestion_id,
                "decision": request.decision.value,
                "actor_id": request.actor_id,
                "suggestion_type": request.suggestion_type,
                "original_text": request.original_text.strip(),
                "final_text": final_text,
                "edited": request.decision == SuggestionStatus.EDITED
                or final_text != request.original_text.strip(),
                "reason": request.reason,
                "linked_topics": list(request.linked_topics),
                "linked_evidence": list(request.linked_evidence),
                "risk_flags": list(request.risk_flags),
                "confidence": request.confidence,
                "model": request.model,
                "prompt_version": request.prompt_version,
                "prompt_hash": request.prompt_hash,
                "context_hash": request.context_hash,
                "output_hash": request.output_hash,
            },
        )
        return {
            "decision": request.decision.value,
            "audit_event": _to_jsonable(audit_event),
            "chain_valid": store.verify_audit_chain(),
        }

    @app.post("/workspaces/{workspace_id}/operator-actions/decisions")
    def record_workspace_operator_action_decision(
        workspace_id: str,
        request: OperatorActionDecisionRequest,
    ) -> dict[str, Any]:
        try:
            workspace = workspace_manager.open_workspace(workspace_id)
        except WorkspaceError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

        decision = decide_workspace_access(
            role=request.role,
            action=WorkspaceAction.WRITE_INTERVIEW,
            manifest=workspace.manifest,
        )
        if not decision.allowed:
            raise HTTPException(status_code=403, detail=decision.reason)

        case_id = request.case_id or workspace.manifest.case_id
        if case_id != workspace.manifest.case_id:
            raise HTTPException(status_code=400, detail="case_id does not match workspace.")
        case = _load_synthetic_case(case_id, locale="en")
        _validate_operator_action_decision(request, question_ids={question.id for question in case.questions})

        audit_event = store.append_audit_event(
            actor=Actor.HUMAN,
            action=f"operator_action_{request.decision_type}",
            object_type="operator_action",
            object_id=request.action_id,
            details={
                "workspace_id": workspace_id,
                "case_id": case_id,
                "session_id": request.session_id,
                "participant_id": request.participant_id,
                "created_by": request.created_by,
                "action_id": request.action_id,
                "action_kind": request.action_kind,
                "action_title": request.action_title.strip(),
                "action_detail": request.action_detail.strip(),
                "action_priority": request.action_priority,
                "target_question_id": request.target_question_id,
                "target_tab": request.target_tab,
                "source_object_ids": list(request.source_object_ids),
                "decision_type": request.decision_type,
                "operator_note": request.operator_note.strip(),
                "before_state": dict(request.before_state),
                "after_state": dict(request.after_state),
                "model_id": request.model_id,
                "prompt_version": request.prompt_version,
                "prompt_hash": request.prompt_hash,
                "context_hash": request.context_hash,
                "output_hash": request.output_hash,
            },
        )
        return {
            "decision": _operator_action_decision_from_event(audit_event),
            "audit_event": _to_jsonable(audit_event),
            "chain_valid": store.verify_audit_chain(),
        }

    @app.get("/workspaces/{workspace_id}/operator-actions/decisions")
    def list_workspace_operator_action_decisions(
        workspace_id: str,
        case_id: str | None = Query(default=None),
        session_id: str | None = Query(default=None),
    ) -> dict[str, Any]:
        try:
            workspace = workspace_manager.open_workspace(workspace_id)
        except WorkspaceError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

        if case_id and case_id != workspace.manifest.case_id:
            raise HTTPException(status_code=400, detail="case_id does not match workspace.")
        events = _operator_action_decision_events(
            _workspace_audit_events(store.list_audit_events(), workspace_id),
            case_id=case_id or workspace.manifest.case_id,
            session_id=session_id,
        )
        return {
            "workspace_id": workspace_id,
            "case_id": case_id or workspace.manifest.case_id,
            "session_id": session_id,
            "decisions": [_operator_action_decision_from_event(event) for event in reversed(events)],
            "chain_valid": store.verify_audit_chain(),
        }

    @app.post("/workspaces/{workspace_id}/stop-reviews")
    def record_workspace_stop_review(
        workspace_id: str,
        request: StopReviewDecisionRequest,
    ) -> dict[str, Any]:
        try:
            workspace = workspace_manager.open_workspace(workspace_id)
        except WorkspaceError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

        decision = decide_workspace_access(
            role=request.role,
            action=WorkspaceAction.MANAGE_WORKSPACE,
            manifest=workspace.manifest,
        )
        if not decision.allowed:
            raise HTTPException(status_code=403, detail=decision.reason)

        _validate_stop_review_decision(request)
        normalized_decision = request.decision.strip().lower()
        audit_event = store.append_audit_event(
            actor=Actor.HUMAN,
            action=f"stop_review_{normalized_decision}",
            object_type="stop_review",
            object_id=request.gate_id,
            details={
                "workspace_id": workspace_id,
                "case_id": workspace.manifest.case_id,
                "gate_id": request.gate_id,
                "decision": normalized_decision,
                "created_by": request.created_by.strip(),
                "rationale": request.rationale.strip(),
                "checklist": [item.strip() for item in request.checklist if item.strip()],
            },
        )
        return {
            "decision": _stop_review_decision_from_event(audit_event),
            "audit_event": _to_jsonable(audit_event),
            "chain_valid": store.verify_audit_chain(),
        }

    @app.get("/workspaces/{workspace_id}/stop-reviews")
    def list_workspace_stop_reviews(
        workspace_id: str,
        gate_id: str | None = Query(default=None),
        role: WorkspaceRole = WorkspaceRole.INVESTIGATOR,
    ) -> dict[str, Any]:
        try:
            workspace = workspace_manager.open_workspace(workspace_id)
        except WorkspaceError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

        decision = decide_workspace_access(
            role=role,
            action=WorkspaceAction.READ_CASE,
            manifest=workspace.manifest,
        )
        if not decision.allowed:
            raise HTTPException(status_code=403, detail=decision.reason)

        events = _stop_review_events(
            _workspace_audit_events(store.list_audit_events(), workspace_id),
            gate_id=gate_id,
        )
        decisions = [_stop_review_decision_from_event(event) for event in reversed(events)]
        return {
            "workspace_id": workspace_id,
            "case_id": workspace.manifest.case_id,
            "gate_id": gate_id,
            "latest": decisions[0] if decisions else None,
            "decisions": decisions,
            "chain_valid": store.verify_audit_chain(),
        }

    @app.post("/workspaces/{workspace_id}/exports/integrity-preview")
    def preview_workspace_export_integrity(
        workspace_id: str,
        request: ExportIntegrityPreviewRequest,
    ) -> dict[str, Any]:
        try:
            workspace = workspace_manager.open_workspace(workspace_id)
        except WorkspaceError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

        if request.case_id != workspace.manifest.case_id:
            raise HTTPException(status_code=400, detail="case_id does not match workspace.")

        if not request.files:
            raise HTTPException(status_code=400, detail="At least one export file is required.")

        model_artifacts = None
        if request.include_model_artifacts:
            try:
                model_artifacts = create_model_artifact_manifest_reference(workspace)
            except Exception:
                model_artifacts = None

        try:
            manifest = create_export_manifest_from_contents(
                case_id=request.case_id,
                created_by=request.created_by,
                files=[(item.path, item.content) for item in request.files],
                model_artifacts=model_artifacts,
            )
            verification = verify_export_manifest_contents(
                manifest,
                files=[(item.path, item.content) for item in request.files],
            )
        except ExportIntegrityError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        return {
            "manifest": export_manifest_to_dict(manifest),
            "verification": _to_jsonable(verification),
        }

    @app.post("/workspaces/{workspace_id}/exports/bundle")
    def create_workspace_export_bundle(
        workspace_id: str,
        request: ExportBundleRequest,
    ) -> dict[str, Any]:
        try:
            workspace = workspace_manager.open_workspace(workspace_id)
        except WorkspaceError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

        if request.case_id != workspace.manifest.case_id:
            raise HTTPException(status_code=400, detail="case_id does not match workspace.")

        if not request.markdown.strip():
            raise HTTPException(status_code=400, detail="Export markdown is required.")

        model_artifacts = None
        if request.include_model_artifacts:
            try:
                model_artifacts = create_model_artifact_manifest_reference(workspace)
            except Exception:
                model_artifacts = None

        try:
            manifest = create_export_manifest_from_contents(
                case_id=request.case_id,
                created_by=request.created_by,
                files=[(request.markdown_path, request.markdown)],
                model_artifacts=model_artifacts,
            )
            verification = verify_export_manifest_contents(
                manifest,
                files=[(request.markdown_path, request.markdown)],
            )
            bundle_base64 = create_export_bundle_base64(
                markdown_path=request.markdown_path,
                markdown_content=request.markdown,
                manifest=manifest,
                json_content=request.json_export,
            )
            bundle_bytes = base64.b64decode(bundle_base64.encode("ascii"))
        except ExportIntegrityError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        filename = f"interrogaition-{request.case_id}-export.zip"
        audit_event = store.append_audit_event(
            actor=Actor.HUMAN,
            action="export_bundle_created",
            object_type="export_bundle",
            object_id=manifest.export_id,
            details=_export_bundle_audit_details(
                workspace=workspace,
                request=request,
                filename=filename,
                manifest=manifest,
                verification=verification,
                bundle_bytes=bundle_bytes,
            ),
        )

        return {
            "filename": filename,
            "content_type": "application/zip",
            "content_base64": bundle_base64,
            "manifest": export_manifest_to_dict(manifest),
            "verification": _to_jsonable(verification),
            "audit_event": _to_jsonable(audit_event),
            "chain_valid": store.verify_audit_chain(),
        }

    @app.get("/workspaces/{workspace_id}/audit")
    def get_workspace_audit(workspace_id: str) -> dict[str, Any]:
        try:
            workspace_manager.open_workspace(workspace_id)
        except WorkspaceError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

        events = _workspace_audit_events(store.list_audit_events(), workspace_id)
        return {
            "workspace_id": workspace_id,
            "chain_valid": store.verify_audit_chain(),
            "events": _to_jsonable(events),
        }

    @app.get("/workspaces/{workspace_id}/materials/{material_id}/verification")
    def verify_workspace_material(workspace_id: str, material_id: str) -> dict[str, Any]:
        try:
            workspace = workspace_manager.open_workspace(workspace_id)
            verification = MaterialRegistry(workspace).verify_material(material_id)
        except WorkspaceError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except MaterialRegistryError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        return _to_jsonable(verification)

    @app.get("/cases/{case_id}")
    def get_case(case_id: str, locale: str = Query(default="en")) -> dict[str, Any]:
        case = _load_synthetic_case(case_id, locale=locale)
        return _to_jsonable(case)

    @app.get("/cases/{case_id}/review")
    def review_case_endpoint(case_id: str, locale: str = Query(default="en")) -> dict[str, Any]:
        case = _load_synthetic_case(case_id, locale=locale)
        review = review_case(case)
        indicators = generate_indicators(case, review)
        return {
            "case": _to_jsonable(case),
            "review": _to_jsonable(review),
            "indicators": _to_jsonable(indicators),
            "report_markdown": render_review_markdown(
                case,
                review,
                locale=locale,
                indicators=indicators,
            ),
        }

    @app.post("/sessions")
    def start_session(request: StartSessionRequest) -> dict[str, Any]:
        _require_non_empty("session_id", request.session_id)
        _require_non_empty("case_id", request.case_id)
        _require_non_empty("participant_id", request.participant_id)
        if store.get_session(request.session_id) is not None:
            raise HTTPException(status_code=409, detail="Session already exists.")

        _load_synthetic_case(request.case_id, locale="en")
        session = start_interview_session(
            session_id=request.session_id,
            case_id=request.case_id,
            participant_id=request.participant_id,
            initial_role=request.initial_role,
            event_id=f"event-{request.session_id}-session-started",
        )
        try:
            store.create_session(session)
        except sqlite3.IntegrityError as exc:
            raise HTTPException(status_code=409, detail="Session already exists.") from exc
        store.append_audit_event(
            actor=Actor.SYSTEM,
            action="session_started",
            object_type="session",
            object_id=session.id,
            details={
                "case_id": session.case_id,
                "participant_id": session.participant_id,
                "initial_role": session.current_role.value,
            },
        )
        return _to_jsonable(session)

    @app.post("/sessions/{session_id}/answers")
    def add_session_answer(session_id: str, request: AddAnswerRequest) -> dict[str, Any]:
        session = store.get_session(session_id)
        if session is None:
            raise HTTPException(status_code=404, detail="Session not found.")

        case = _load_synthetic_case(session.case_id, locale="en")
        if request.workspace_id:
            workspace = _open_session_workspace(
                workspace_manager=workspace_manager,
                workspace_id=request.workspace_id,
                case_id=session.case_id,
            )
            case = _case_with_question_drafts(
                case,
                _question_draft_questions(
                    _workspace_audit_events(store.list_audit_events(), workspace.manifest.workspace_id),
                    case_id=session.case_id,
                    session_id=session_id,
                ),
            )
        _validate_answer_request(case, request)

        supplied_claims = tuple(
            Claim(
                id=raw["id"],
                subject=raw["subject"],
                attribute=raw["attribute"],
                value=raw["value"],
                source_text=raw.get("source_text", ""),
                review_status=ClaimReviewStatus(raw.get("review_status", ClaimReviewStatus.ACCEPTED.value)),
                extraction_rule=raw.get("extraction_rule", ""),
                extraction_hash=raw.get("extraction_hash", ""),
                confidence=raw.get("confidence"),
                source_start=raw.get("source_start"),
                source_end=raw.get("source_end"),
            )
            for raw in request.claims
        )
        answer = answer_with_extracted_claims(
            case,
            Answer(
                id=request.id,
                question_id=request.question_id,
                text=request.text,
                topic_ids=tuple(request.topic_ids),
                claims=supplied_claims,
            ),
        )
        updated = add_answer(session, answer=answer, event_id=request.event_id)
        store.save_session(updated)
        store.append_audit_event(
            actor=Actor.HUMAN,
            action="answer_added",
            object_type="answer",
            object_id=answer.id,
            details={
                "session_id": session_id,
                "case_id": session.case_id,
                "question_id": answer.question_id,
                "topic_ids": list(answer.topic_ids),
                "claim_count": len(answer.claims),
                "claims_extracted": not bool(request.claims) and bool(answer.claims),
                "extraction_trace": (
                    [_claim_audit_snapshot(claim) for claim in answer.claims]
                    if not request.claims
                    else []
                ),
            },
        )
        return _to_jsonable(updated)

    @app.post("/sessions/{session_id}/answers/{answer_id}/claims/{claim_id}/review")
    def review_session_claim(
        session_id: str,
        answer_id: str,
        claim_id: str,
        request: ClaimReviewDecisionRequest,
    ) -> dict[str, Any]:
        session = store.get_session(session_id)
        if session is None:
            raise HTTPException(status_code=404, detail="Session not found.")

        answer = next((item for item in session.answers if item.id == answer_id), None)
        if answer is None:
            raise HTTPException(status_code=404, detail="Answer not found.")

        claim = next((item for item in answer.claims if item.id == claim_id), None)
        if claim is None:
            raise HTTPException(status_code=404, detail="Claim not found.")

        _validate_claim_review_decision(request)
        updated_claim = _reviewed_claim(claim, request)
        updated_answer = replace(
            answer,
            claims=tuple(updated_claim if item.id == claim_id else item for item in answer.claims),
        )
        updated_session = replace(
            session,
            answers=tuple(updated_answer if item.id == answer_id else item for item in session.answers),
        )
        store.save_session(updated_session)
        audit_event = store.append_audit_event(
            actor=Actor.HUMAN,
            action=f"claim_{request.decision.value}",
            object_type="claim",
            object_id=claim_id,
            details={
                "session_id": session_id,
                "case_id": session.case_id,
                "answer_id": answer_id,
                "question_id": answer.question_id,
                "decision": request.decision.value,
                "actor_id": request.actor_id,
                "operator_note": request.operator_note,
                "before": _claim_audit_snapshot(claim),
                "after": _claim_audit_snapshot(updated_claim),
            },
        )
        return {
            "session": _to_jsonable(updated_session),
            "audit_event": _to_jsonable(audit_event),
            "chain_valid": store.verify_audit_chain(),
        }

    @app.get("/sessions/{session_id}/review")
    def review_session_endpoint(
        session_id: str,
        locale: str = Query(default="en"),
        workspace_id: str | None = Query(default=None),
    ) -> dict[str, Any]:
        session = store.get_session(session_id)
        if session is None:
            raise HTTPException(status_code=404, detail="Session not found.")

        case = _load_synthetic_case(session.case_id, locale=locale)
        effective_workspace_id = workspace_id if isinstance(workspace_id, str) and workspace_id else None
        if effective_workspace_id:
            workspace = _open_session_workspace(
                workspace_manager=workspace_manager,
                workspace_id=effective_workspace_id,
                case_id=session.case_id,
            )
            case = _case_with_question_drafts(
                case,
                _question_draft_questions(
                    _workspace_audit_events(store.list_audit_events(), workspace.manifest.workspace_id),
                    case_id=session.case_id,
                    session_id=session_id,
                ),
            )
        snapshot = review_live_session(case, session)
        case_view = merge_session_answers(case, session)
        indicators = generate_indicators(case_view, snapshot.review)
        store.append_audit_event(
            actor=Actor.SYSTEM,
            action="review_refreshed",
            object_type="session",
            object_id=session.id,
            details={
                "case_id": session.case_id,
                "sequence_no": snapshot.sequence_no,
                "finding_count": len(snapshot.review.findings),
                "indicator_count": len(indicators),
            },
        )

        return {
            "session": _to_jsonable(session),
            "snapshot": _to_jsonable(snapshot),
            "indicators": _to_jsonable(indicators),
            "report_markdown": render_review_markdown(
                case_view,
                snapshot.review,
                locale=locale,
                indicators=indicators,
            ),
        }

    @app.get("/sessions/{session_id}/audit")
    def get_session_audit(session_id: str) -> dict[str, Any]:
        session = store.get_session(session_id)
        if session is None:
            raise HTTPException(status_code=404, detail="Session not found.")

        events = _session_audit_events(store.list_audit_events(), session_id)
        return {
            "session_id": session_id,
            "chain_valid": store.verify_audit_chain(),
            "events": _to_jsonable(events),
        }

    @app.get("/sessions/{session_id}/claim-provenance")
    def get_session_claim_provenance(session_id: str) -> dict[str, Any]:
        session = store.get_session(session_id)
        if session is None:
            raise HTTPException(status_code=404, detail="Session not found.")

        events = _session_audit_events(store.list_audit_events(), session_id)
        return _to_jsonable(
            verify_session_claim_provenance(
                session=session,
                audit_events=events,
                chain_valid=store.verify_audit_chain(),
            )
        )

    return app


app = create_app(
    store=SQLiteSessionStore(DEFAULT_DATABASE_PATH),
    workspace_manager=CaseWorkspaceManager(DEFAULT_WORKSPACE_ROOT),
)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        description="Run the InterrogA(I)tion local API prototype.",
    )
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Bind host for the local API server.",
    )
    parser.add_argument(
        "--port",
        default=8000,
        type=int,
        help="Bind port for the local API server.",
    )
    parser.add_argument(
        "--reload",
        action="store_true",
        help="Enable Uvicorn reload for local development.",
    )
    args = parser.parse_args(argv)

    import uvicorn

    uvicorn.run(
        "interrogaition.api.app:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
    )


def _load_synthetic_case(case_id: str, locale: str) -> Case:
    path = SYNTHETIC_CASES_ROOT / case_id / "case.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Synthetic case not found.")

    return load_case_from_json(path, locale=locale)


def _load_synthetic_starter_materials(case_id: str, locale: str) -> tuple[SyntheticMaterial, ...]:
    path = SYNTHETIC_CASES_ROOT / case_id / "materials.json"
    return load_synthetic_materials(path, locale=locale)


def _list_synthetic_cases(locale: str) -> tuple[Case, ...]:
    return tuple(
        load_case_from_json(path, locale=locale)
        for path in sorted(SYNTHETIC_CASES_ROOT.glob("*/case.json"))
    )


def _case_catalog_item(case: Case) -> dict[str, Any]:
    answered_question_ids = {answer.question_id for answer in case.answers}
    high_priority_topics = tuple(topic for topic in case.topics if topic.priority == Priority.HIGH)
    return {
        "id": case.id,
        "title": case.title,
        "description": case.description,
        "created_at": case.created_at.isoformat(),
        "topic_count": len(case.topics),
        "high_priority_topic_count": len(high_priority_topics),
        "question_count": len(case.questions),
        "answer_count": len(case.answers),
        "answered_question_count": len(answered_question_ids),
    }


def _assess_local_model_experiment_readiness(
    *,
    workspace_manager: CaseWorkspaceManager,
    store: SessionStore,
    config: LocalModelRuntimeConfig,
    workspace_id: str | None,
) -> ModelExperimentReadinessReport:
    effective_workspace_id = workspace_id.strip() if isinstance(workspace_id, str) and workspace_id.strip() else None
    workspace_security_state: str | None = None
    artifact_isolation_state: str | None = None
    stop_review_approved = False
    if effective_workspace_id:
        workspace = workspace_manager.open_workspace(effective_workspace_id)
        workspace_security = assess_workspace_security(
            manifest=workspace.manifest,
            encryption_status=workspace_manager.encryption_status(),
        )
        artifact_isolation = inspect_model_artifact_isolation(workspace)
        workspace_security_state = workspace_security.state
        artifact_isolation_state = artifact_isolation.state
        stop_review_approved = _is_stop_review_approved(
            _workspace_audit_events(store.list_audit_events(), effective_workspace_id),
            gate_id=MODEL_EXPERIMENT_STOP_GATE_ID,
        )

    return assess_model_experiment_readiness(
        config=config,
        stop_review_approved=stop_review_approved,
        workspace_id=effective_workspace_id,
        workspace_security_state=workspace_security_state,
        artifact_isolation_state=artifact_isolation_state,
    )


def _build_demo_readiness_report(
    *,
    workspace: CaseWorkspace,
    case_id: str,
    session_id: str | None,
    workspace_manager: CaseWorkspaceManager,
    store: SessionStore,
    local_model_config: LocalModelRuntimeConfig,
) -> dict[str, Any]:
    workspace_events = _workspace_audit_events(store.list_audit_events(), workspace.manifest.workspace_id)
    session_events = _session_audit_events(store.list_audit_events(), session_id) if session_id else ()
    workspace_security = assess_workspace_security(
        manifest=workspace.manifest,
        encryption_status=workspace_manager.encryption_status(),
    )
    artifact_isolation = inspect_model_artifact_isolation(workspace)
    artifact_manifest = list_model_artifact_manifest(workspace)
    model_readiness = _assess_local_model_experiment_readiness(
        workspace_manager=workspace_manager,
        store=store,
        config=local_model_config,
        workspace_id=workspace.manifest.workspace_id,
    )
    session = store.get_session(session_id) if session_id else None
    export_events = tuple(event for event in workspace_events if event.action == "export_bundle_created")
    checks = [
        _demo_readiness_check(
            "workspace",
            "Case workspace",
            "ready",
            f"Workspace {workspace.manifest.workspace_id} is open for case {case_id}.",
            {"data_sensitivity": workspace.manifest.data_sensitivity.value},
            "",
        ),
        _demo_readiness_check(
            "workspace_security",
            "Workspace security",
            workspace_security.state,
            _first_issue_detail(workspace_security.issues) or "Workspace security posture is ready for synthetic demo data.",
            {"issue_count": workspace_security.issue_count},
            "Resolve workspace security findings before demo rehearsal.",
        ),
        _demo_readiness_check(
            "audit_chain",
            "Audit chain",
            "ready" if store.verify_audit_chain() else "blocked",
            f"{len(workspace_events)} workspace audit events and {len(session_events)} session audit events are available.",
            {
                "workspace_event_count": len(workspace_events),
                "session_event_count": len(session_events),
            },
            "Refresh the workspace and session audit views, then investigate any chain mismatch before continuing.",
        ),
        _demo_readiness_check(
            "session_capture",
            "Session capture",
            _session_capture_state(session_id=session_id, session=session),
            _session_capture_detail(session_id=session_id, session=session),
            {"answer_count": len(session.answers) if session is not None else 0},
            "Start the demo session and record at least one answer before the final walkthrough.",
        ),
        _demo_readiness_check(
            "model_artifacts",
            "Model artifact trace",
            _model_artifact_demo_state(artifact_isolation.state, artifact_manifest.record_count),
            _model_artifact_demo_detail(artifact_isolation.state, artifact_manifest.record_count),
            {
                "isolation_state": artifact_isolation.state,
                "record_count": artifact_manifest.record_count,
                "chain_valid": artifact_manifest.chain_valid,
            },
            "Initialize model artifact isolation and generate grounded AI once so prompt/context/output records exist.",
        ),
        _demo_readiness_check(
            "model_experiment_stop",
            "Real-model STOP gate",
            "ready" if model_readiness.can_run_real_smoke else "warning",
            (
                "Controlled real-model smoke is approved."
                if model_readiness.can_run_real_smoke
                else "Default demo remains deterministic; real-model smoke still needs its separate STOP gate."
            ),
            {
                "provider": model_readiness.provider,
                "effective_provider": model_readiness.effective_provider,
                "issue_count": model_readiness.issue_count,
            },
            "Keep the first demo deterministic unless you deliberately run the separate real-model STOP approval.",
        ),
        _demo_readiness_check(
            "export_bundle",
            "Export bundle",
            "ready" if export_events else "warning",
            (
                "A ZIP export bundle is recorded in the workspace audit chain."
                if export_events
                else "Download a ZIP export bundle from Review before the final demo rehearsal."
            ),
            _latest_export_bundle_evidence(export_events),
            "Download the ZIP export bundle and verify it offline with the generated SHA-256 command.",
        ),
    ]
    state = _demo_readiness_state(checks)
    return {
        "workspace_id": workspace.manifest.workspace_id,
        "case_id": case_id,
        "session_id": session_id,
        "state": state,
        "ready": state == "ready",
        "generated_at": datetime.now(UTC).isoformat(),
        "checks": checks,
        "recommended_actions": _demo_readiness_recommended_actions(checks),
        "summary": _demo_readiness_summary(checks),
    }


def _demo_readiness_check(
    check_id: str,
    label: str,
    state: str,
    detail: str,
    evidence: dict[str, Any] | None = None,
    next_action: str = "",
) -> dict[str, Any]:
    return {
        "id": check_id,
        "label": label,
        "state": state,
        "detail": detail,
        "evidence": evidence or {},
        "next_action": next_action if state != "ready" else "",
    }


def _demo_readiness_state(checks: list[dict[str, Any]]) -> str:
    states = {str(check["state"]) for check in checks}
    if "blocked" in states:
        return "blocked"
    if "warning" in states:
        return "warning"
    if "unknown" in states:
        return "unknown"
    return "ready"


def _demo_readiness_summary(checks: list[dict[str, Any]]) -> dict[str, int]:
    states = ("ready", "warning", "blocked", "unknown")
    return {state: sum(1 for check in checks if check["state"] == state) for state in states}


def _demo_readiness_recommended_actions(checks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "id": check["id"],
            "label": check["label"],
            "state": check["state"],
            "action": check["next_action"],
        }
        for check in checks
        if check["state"] != "ready" and check.get("next_action")
    ]


def _first_issue_detail(issues: tuple[Any, ...]) -> str | None:
    return str(issues[0].detail) if issues else None


def _session_capture_state(*, session_id: str | None, session: InterviewSession | None) -> str:
    if not session_id:
        return "unknown"
    if session is None:
        return "warning"
    return "ready" if session.answers else "warning"


def _session_capture_detail(*, session_id: str | None, session: InterviewSession | None) -> str:
    if not session_id:
        return "No session id was supplied for this demo readiness report."
    if session is None:
        return f"Session {session_id} has not been started through the API yet."
    if not session.answers:
        return f"Session {session_id} exists but has no recorded answers yet."
    return f"Session {session_id} has {len(session.answers)} recorded answers."


def _model_artifact_demo_state(isolation_state: str, record_count: int) -> str:
    if isolation_state == "blocked":
        return "blocked"
    if isolation_state != "ready" or record_count == 0:
        return "warning"
    return "ready"


def _model_artifact_demo_detail(isolation_state: str, record_count: int) -> str:
    if isolation_state != "ready":
        return "Model artifact isolation should be initialized before demonstrating grounded AI traceability."
    if record_count == 0:
        return "Model artifact isolation is ready, but no prompt/context/output artifacts are recorded yet."
    return f"Model artifact manifest contains {record_count} hash-chained records."


def _latest_export_bundle_evidence(export_events: tuple[AuditEvent, ...]) -> dict[str, Any]:
    if not export_events:
        return {"bundle_count": 0}
    latest = export_events[-1]
    return {
        "bundle_count": len(export_events),
        "filename": latest.details.get("filename"),
        "bundle_sha256": latest.details.get("bundle_sha256"),
        "manifest_hash": latest.details.get("manifest_hash"),
        "event_hash": latest.event_hash,
    }


def _build_case_quality_report(
    *,
    workspace: CaseWorkspace,
    case_id: str,
    session_id: str | None,
    locale: str,
    workspace_manager: CaseWorkspaceManager,
    store: SessionStore,
    material_texts: tuple[MaterialText, ...],
) -> dict[str, Any]:
    audit_events = store.list_audit_events()
    workspace_events = _workspace_audit_events(audit_events, workspace.manifest.workspace_id)
    session = store.get_session(session_id) if session_id else None
    session_events = _session_audit_events(audit_events, session_id) if session_id else ()
    chain_valid = store.verify_audit_chain()
    material_decisions = derive_material_link_decisions(workspace_events)
    question_drafts = _question_draft_questions(
        workspace_events,
        case_id=case_id,
        session_id=session_id,
    )
    context = _build_evidence_context(
        case_id=case_id,
        locale=locale,
        session_id=session_id,
        store=store,
        material_texts=material_texts,
        material_link_decisions=material_decisions,
        question_drafts=question_drafts,
    )
    workspace_security = assess_workspace_security(
        manifest=workspace.manifest,
        encryption_status=workspace_manager.encryption_status(),
    )
    artifact_manifest = list_model_artifact_manifest(workspace)
    provenance = (
        verify_session_claim_provenance(
            session=session,
            audit_events=session_events,
            chain_valid=chain_valid,
        )
        if session is not None
        else None
    )
    evidence_map = context["evidence_map"]
    evidence_alignment = context["evidence_alignment"]
    case_view = context["case"]
    review = context["review"]
    export_events = tuple(
        event
        for event in workspace_events
        if event.action == "export_bundle_created" and event.details.get("case_id") == case_id
    )
    grounded_generation_events = _case_quality_grounded_generation_events(
        workspace_events,
        case_id=case_id,
        session_id=session_id,
    )
    grounded_decision_events = _case_quality_grounded_decision_events(
        workspace_events,
        case_id=case_id,
        session_id=session_id,
    )
    operator_events = _operator_action_decision_events(
        workspace_events,
        case_id=case_id,
        session_id=session_id,
    )
    dimensions = [
        _case_quality_case_scope_dimension(case_view, workspace, material_texts),
        _case_quality_workspace_security_dimension(workspace_security),
        _case_quality_session_dimension(session_id=session_id, session=session),
        _case_quality_claim_review_dimension(session),
        _case_quality_claim_provenance_dimension(provenance),
        _case_quality_evidence_coverage_dimension(evidence_map),
        _case_quality_material_grounding_dimension(evidence_map, evidence_alignment),
        _case_quality_ai_trace_dimension(
            artifact_manifest=artifact_manifest,
            generation_events=grounded_generation_events,
            decision_events=grounded_decision_events,
        ),
        _case_quality_operator_dimension(operator_events),
        _case_quality_audit_export_dimension(
            chain_valid=chain_valid,
            workspace_events=workspace_events,
            session_events=session_events,
            export_events=export_events,
        ),
    ]
    return {
        "workspace_id": workspace.manifest.workspace_id,
        "case_id": case_id,
        "session_id": session_id,
        "state": _case_quality_state(dimensions),
        "ready": _case_quality_state(dimensions) == "ready",
        "quality_score": _case_quality_score(dimensions),
        "generated_at": datetime.now(UTC).isoformat(),
        "dimensions": dimensions,
        "recommended_actions": _case_quality_recommended_actions(dimensions),
        "summary": _case_quality_summary(dimensions),
        "metrics": {
            "topic_count": evidence_map.summary.total_topics,
            "missing_topic_count": evidence_map.summary.missing_topics,
            "contested_topic_count": evidence_map.summary.contested_topics,
            "answered_question_count": evidence_map.summary.answered_questions,
            "answer_count": evidence_map.summary.total_answers,
            "claim_count": evidence_map.summary.total_claims,
            "finding_count": evidence_map.summary.total_findings,
            "material_count": evidence_map.summary.total_materials,
            "material_link_count": evidence_map.summary.total_material_question_links,
            "material_link_reviewed_count": evidence_alignment.reviewed_links,
            "grounded_suggestion_batch_count": len(grounded_generation_events),
            "grounded_suggestion_decision_count": len(grounded_decision_events),
            "operator_decision_count": len(operator_events),
            "workspace_audit_event_count": len(workspace_events),
            "session_audit_event_count": len(session_events),
            "export_bundle_count": len(export_events),
            "model_artifact_record_count": artifact_manifest.record_count,
            "review_finding_count": len(review.findings),
        },
    }


def _case_quality_dimension(
    dimension_id: str,
    label: str,
    state: str,
    detail: str,
    metrics: dict[str, Any] | None = None,
    next_action: str = "",
) -> dict[str, Any]:
    return {
        "id": dimension_id,
        "label": label,
        "state": state,
        "detail": detail,
        "metrics": metrics or {},
        "next_action": next_action if state != "ready" else "",
    }


def _case_quality_case_scope_dimension(
    case: Case,
    workspace: CaseWorkspace,
    material_texts: tuple[MaterialText, ...],
) -> dict[str, Any]:
    return _case_quality_dimension(
        "case_scope",
        "Case scope",
        "ready",
        (
            f"Case {case.id} has {len(case.questions)} planned questions, "
            f"{len(case.topics)} topics and {len(material_texts)} registered materials."
        ),
        {
            "question_count": len(case.questions),
            "topic_count": len(case.topics),
            "material_count": len(material_texts),
            "data_sensitivity": workspace.manifest.data_sensitivity.value,
        },
    )


def _case_quality_workspace_security_dimension(workspace_security: Any) -> dict[str, Any]:
    return _case_quality_dimension(
        "workspace_security",
        "Workspace security",
        workspace_security.state,
        _first_issue_detail(workspace_security.issues)
        or "Workspace security posture is acceptable for the current case mode.",
        {"issue_count": workspace_security.issue_count},
        "Resolve workspace security findings before using non-synthetic or externally shared outputs.",
    )


def _case_quality_session_dimension(
    *,
    session_id: str | None,
    session: InterviewSession | None,
) -> dict[str, Any]:
    answer_count = len(session.answers) if session is not None else 0
    if not session_id:
        state = "unknown"
        detail = "No session id was supplied, so live interview quality cannot be assessed."
    elif session is None:
        state = "warning"
        detail = f"Session {session_id} has not been started through the API."
    elif answer_count == 0:
        state = "warning"
        detail = f"Session {session_id} exists, but no answers have been captured."
    else:
        state = "ready"
        detail = f"Session {session_id} has {answer_count} recorded answers."
    return _case_quality_dimension(
        "session_capture",
        "Session capture",
        state,
        detail,
        {"answer_count": answer_count},
        "Start the session and record answers before treating the case as review-ready.",
    )


def _case_quality_claim_review_dimension(session: InterviewSession | None) -> dict[str, Any]:
    counts = _claim_review_counts(session)
    total = sum(counts.values())
    pending = counts[ClaimReviewStatus.PENDING.value]
    if session is None:
        state = "unknown"
        detail = "Claim review cannot be assessed without a session."
    elif total == 0:
        state = "warning"
        detail = "No claims are available for operator review yet."
    elif pending:
        state = "warning"
        detail = f"{pending} extracted claims still need operator review."
    else:
        state = "ready"
        detail = f"All {total} claims have an operator review status."
    return _case_quality_dimension(
        "claim_review",
        "Claim review discipline",
        state,
        detail,
        counts,
        "Accept, edit or reject pending claims before relying on downstream indicators.",
    )


def _case_quality_claim_provenance_dimension(provenance: Any | None) -> dict[str, Any]:
    if provenance is None:
        return _case_quality_dimension(
            "claim_provenance",
            "Claim provenance",
            "unknown",
            "Claim provenance cannot be assessed without a session.",
            {},
            "Run a session with extracted claims so provenance can be verified.",
        )
    metrics = {
        "claim_count": provenance.claim_count,
        "extracted_claim_count": provenance.extracted_claim_count,
        "verified_claim_count": provenance.verified_claim_count,
        "issue_count": provenance.issue_count,
        "chain_valid": provenance.chain_valid,
    }
    if not provenance.chain_valid or provenance.issue_count:
        return _case_quality_dimension(
            "claim_provenance",
            "Claim provenance",
            "blocked",
            "Claim extraction provenance has audit-chain or trace issues.",
            metrics,
            "Inspect the session claim provenance report before continuing.",
        )
    if provenance.extracted_claim_count == 0:
        return _case_quality_dimension(
            "claim_provenance",
            "Claim provenance",
            "warning",
            "No extracted claims are available for provenance verification.",
            metrics,
            "Capture or extract claims so traceability can be demonstrated.",
        )
    return _case_quality_dimension(
        "claim_provenance",
        "Claim provenance",
        "ready",
        f"{provenance.verified_claim_count} extracted claims are verified against audit snapshots.",
        metrics,
    )


def _case_quality_evidence_coverage_dimension(evidence_map: Any) -> dict[str, Any]:
    summary = evidence_map.summary
    high_missing = tuple(
        node for node in evidence_map.topic_nodes if node.status.value == "missing" and node.priority == "high"
    )
    metrics = {
        "total_topics": summary.total_topics,
        "missing_topics": summary.missing_topics,
        "missing_high_priority_topics": len(high_missing),
        "contested_topics": summary.contested_topics,
        "answered_questions": summary.answered_questions,
        "total_questions": summary.total_questions,
        "total_answers": summary.total_answers,
    }
    if summary.total_answers == 0:
        state = "warning"
        detail = "No answers are captured, so topic coverage is not review-ready."
    elif high_missing:
        state = "warning"
        detail = f"{len(high_missing)} high-priority topics are still missing."
    elif summary.missing_topics or summary.contested_topics:
        state = "warning"
        detail = (
            f"{summary.missing_topics} topics are missing and "
            f"{summary.contested_topics} topics are contested."
        )
    else:
        state = "ready"
        detail = "All case topics have coverage without contested evidence-map topics."
    return _case_quality_dimension(
        "evidence_coverage",
        "Evidence coverage",
        state,
        detail,
        metrics,
        "Use the evidence map to resolve missing, material-only or contested topics.",
    )


def _case_quality_material_grounding_dimension(evidence_map: Any, evidence_alignment: Any) -> dict[str, Any]:
    summary = evidence_map.summary
    metrics = {
        "total_materials": summary.total_materials,
        "proposed_links": evidence_alignment.total_proposed_links,
        "reviewed_links": evidence_alignment.reviewed_links,
        "accepted_links": evidence_alignment.accepted_links,
        "rejected_links": evidence_alignment.rejected_links,
        "pending_links": evidence_alignment.pending_links,
        "alignment_band": evidence_alignment.band.value,
        "alignment_score": evidence_alignment.score,
    }
    if summary.total_materials == 0:
        state = "warning"
        detail = "No materials are registered for this case workspace."
    elif evidence_alignment.total_proposed_links == 0:
        state = "warning"
        detail = "Registered materials do not yet produce question-grounding links."
    elif evidence_alignment.pending_links:
        state = "warning"
        detail = f"{evidence_alignment.pending_links} material-question links still need review."
    elif evidence_alignment.accepted_links == 0:
        state = "warning"
        detail = "Material links were reviewed, but none are accepted as support."
    else:
        state = "ready"
        detail = f"{evidence_alignment.accepted_links} material-question links are accepted."
    return _case_quality_dimension(
        "material_grounding",
        "Material grounding",
        state,
        detail,
        metrics,
        "Review proposed material-question links and accept the sources that genuinely support the case.",
    )


def _case_quality_ai_trace_dimension(
    *,
    artifact_manifest: Any,
    generation_events: tuple[AuditEvent, ...],
    decision_events: tuple[AuditEvent, ...],
) -> dict[str, Any]:
    warning_count = sum(1 for event in generation_events if event.details.get("artifact_warning"))
    metrics = {
        "generation_count": len(generation_events),
        "decision_count": len(decision_events),
        "artifact_record_count": artifact_manifest.record_count,
        "artifact_chain_valid": artifact_manifest.chain_valid,
        "artifact_warning_count": warning_count,
    }
    if not artifact_manifest.chain_valid:
        state = "blocked"
        detail = "Model artifact manifest chain is invalid."
    elif not generation_events:
        state = "warning"
        detail = "No grounded AI suggestion batch is recorded for this case."
    elif warning_count:
        state = "warning"
        detail = "Grounded AI was generated without complete artifact capture."
    elif artifact_manifest.record_count == 0:
        state = "warning"
        detail = "Grounded AI is recorded, but no prompt/context/output artifacts are present."
    elif len(decision_events) < len(generation_events):
        state = "warning"
        detail = "Grounded AI suggestions need explicit accepted/edited/rejected operator decisions."
    else:
        state = "ready"
        detail = "Grounded AI generation, artifacts and operator decisions are auditable."
    return _case_quality_dimension(
        "ai_trace",
        "Grounded AI trace",
        state,
        detail,
        metrics,
        "Generate grounded suggestions with artifact isolation enabled, then record operator decisions.",
    )


def _case_quality_operator_dimension(operator_events: tuple[AuditEvent, ...]) -> dict[str, Any]:
    if operator_events:
        state = "ready"
        detail = f"{len(operator_events)} operator work-queue decisions are recorded."
    else:
        state = "warning"
        detail = "No operator work-queue decisions are recorded for this case/session."
    return _case_quality_dimension(
        "operator_decisions",
        "Operator decision trail",
        state,
        detail,
        {"decision_count": len(operator_events)},
        "Open, skip, dismiss or convert recommended operator actions so the workflow trail is explicit.",
    )


def _case_quality_audit_export_dimension(
    *,
    chain_valid: bool,
    workspace_events: tuple[AuditEvent, ...],
    session_events: tuple[AuditEvent, ...],
    export_events: tuple[AuditEvent, ...],
) -> dict[str, Any]:
    metrics = {
        "chain_valid": chain_valid,
        "workspace_event_count": len(workspace_events),
        "session_event_count": len(session_events),
        "export_bundle_count": len(export_events),
    }
    if not chain_valid:
        state = "blocked"
        detail = "Audit chain verification failed."
    elif not export_events:
        state = "warning"
        detail = "No export bundle is recorded for this case workspace."
    else:
        state = "ready"
        detail = "Audit chain is valid and at least one export bundle is recorded."
    return _case_quality_dimension(
        "audit_export",
        "Audit and export integrity",
        state,
        detail,
        metrics,
        "Create and verify a ZIP export bundle once the case is review-ready.",
    )


def _claim_review_counts(session: InterviewSession | None) -> dict[str, int]:
    counts = {status.value: 0 for status in ClaimReviewStatus}
    if session is None:
        return counts
    for answer in session.answers:
        for claim in answer.claims:
            counts[claim.review_status.value] = counts.get(claim.review_status.value, 0) + 1
    return counts


def _case_quality_grounded_generation_events(
    events: tuple[AuditEvent, ...],
    *,
    case_id: str,
    session_id: str | None,
) -> tuple[AuditEvent, ...]:
    return tuple(
        event
        for event in events
        if event.action == "grounded_suggestions_generated"
        and event.details.get("case_id") == case_id
        and (session_id is None or event.details.get("session_id") in {None, session_id})
    )


def _case_quality_grounded_decision_events(
    events: tuple[AuditEvent, ...],
    *,
    case_id: str,
    session_id: str | None,
) -> tuple[AuditEvent, ...]:
    return tuple(
        event
        for event in events
        if event.object_type == "ai_suggestion"
        and event.action.startswith("grounded_suggestion_")
        and event.details.get("case_id") == case_id
        and (session_id is None or event.details.get("session_id") in {None, session_id})
    )


def _case_quality_state(dimensions: list[dict[str, Any]]) -> str:
    states = {str(dimension["state"]) for dimension in dimensions}
    if "blocked" in states:
        return "blocked"
    if "warning" in states:
        return "warning"
    if "unknown" in states:
        return "unknown"
    return "ready"


def _case_quality_summary(dimensions: list[dict[str, Any]]) -> dict[str, int]:
    states = ("ready", "warning", "blocked", "unknown")
    return {state: sum(1 for dimension in dimensions if dimension["state"] == state) for state in states}


def _case_quality_score(dimensions: list[dict[str, Any]]) -> int:
    if not dimensions:
        return 0
    values = {"ready": 1.0, "warning": 0.5, "unknown": 0.0, "blocked": 0.0}
    score = sum(values.get(str(dimension["state"]), 0.0) for dimension in dimensions)
    return round((score / len(dimensions)) * 100)


def _case_quality_recommended_actions(dimensions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "id": dimension["id"],
            "label": dimension["label"],
            "state": dimension["state"],
            "action": dimension["next_action"],
        }
        for dimension in dimensions
        if dimension["state"] != "ready" and dimension.get("next_action")
    ]


def _blocked_local_model_smoke(
    config: LocalModelRuntimeConfig,
    readiness: ModelExperimentReadinessReport,
) -> LocalModelSmokeResult:
    issue_codes = ", ".join(issue.code for issue in readiness.issues) or readiness.state
    return LocalModelSmokeResult(
        ok=False,
        provider=config.provider,
        model=config.configured_model,
        real_model_invoked=False,
        detail=f"Real model smoke blocked by readiness gate: {issue_codes}.",
    )


def _append_local_model_smoke_audit_event(
    *,
    store: SessionStore,
    workspace: CaseWorkspace,
    action: str,
    readiness: ModelExperimentReadinessReport,
    result: LocalModelSmokeResult,
) -> AuditEvent:
    return store.append_audit_event(
        actor=Actor.SYSTEM,
        action=action,
        object_type="model_smoke",
        object_id=MODEL_EXPERIMENT_STOP_GATE_ID,
        details=_local_model_smoke_audit_details(
            workspace=workspace,
            readiness=readiness,
            result=result,
        ),
    )


def _local_model_smoke_audit_details(
    *,
    workspace: CaseWorkspace,
    readiness: ModelExperimentReadinessReport,
    result: LocalModelSmokeResult,
) -> dict[str, Any]:
    return {
        "workspace_id": workspace.manifest.workspace_id,
        "case_id": workspace.manifest.case_id,
        "gate_id": MODEL_EXPERIMENT_STOP_GATE_ID,
        "provider": readiness.provider,
        "effective_provider": readiness.effective_provider,
        "configured_model": readiness.configured_model,
        "readiness_state": readiness.state,
        "issue_codes": [issue.code for issue in readiness.issues],
        "stop_review_approved": readiness.stop_review_approved,
        "workspace_security_state": readiness.workspace_security_state,
        "artifact_isolation_state": readiness.artifact_isolation_state,
        "can_run_real_smoke": readiness.can_run_real_smoke,
        "ok": result.ok,
        "real_model_invoked": result.real_model_invoked,
        "result_model": result.model,
        "detail": result.detail,
        "response_preview_hash": _sha256_text(result.response_preview) if result.response_preview else "",
        "system_prompt_hash": _sha256_text(LOCAL_MODEL_SMOKE_SYSTEM_PROMPT),
        "user_prompt_hash": _sha256_text(LOCAL_MODEL_SMOKE_USER_PROMPT),
        "sensitive_data": False,
    }


def _sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _export_bundle_audit_details(
    *,
    workspace: CaseWorkspace,
    request: ExportBundleRequest,
    filename: str,
    manifest: Any,
    verification: Any,
    bundle_bytes: bytes,
) -> dict[str, Any]:
    model_artifacts = manifest.model_artifacts
    return {
        "workspace_id": workspace.manifest.workspace_id,
        "case_id": workspace.manifest.case_id,
        "export_id": manifest.export_id,
        "created_by": request.created_by,
        "filename": filename,
        "markdown_path": request.markdown_path,
        "file_paths": [record.path for record in manifest.files],
        "manifest_hash": manifest.manifest_hash,
        "bundle_sha256": _sha256_bytes(bundle_bytes),
        "bundle_size_bytes": len(bundle_bytes),
        "json_included": request.json_export is not None,
        "include_model_artifacts_requested": request.include_model_artifacts,
        "model_artifacts_included": model_artifacts is not None,
        "model_artifact_record_count": model_artifacts.record_count if model_artifacts is not None else 0,
        "model_artifact_chain_valid": verification.model_artifact_chain_valid,
        "manifest_hash_valid": verification.manifest_hash_valid,
        "verification_verified": verification.verified,
    }


def _session_audit_events(
    events: tuple[AuditEvent, ...],
    session_id: str,
) -> tuple[AuditEvent, ...]:
    return tuple(
        event
        for event in events
        if (
            event.object_type == "session"
            and event.object_id == session_id
        )
        or event.details.get("session_id") == session_id
    )


def _workspace_audit_events(
    events: tuple[AuditEvent, ...],
    workspace_id: str,
) -> tuple[AuditEvent, ...]:
    return tuple(
        event
        for event in events
        if (
            event.object_type == "workspace"
            and event.object_id == workspace_id
        )
        or event.details.get("workspace_id") == workspace_id
    )


def _question_draft_events(
    events: tuple[AuditEvent, ...],
    *,
    case_id: str | None,
    session_id: str | None,
) -> tuple[AuditEvent, ...]:
    return tuple(
        event
        for event in events
        if event.object_type == "question_draft"
        and event.action == "question_draft_created"
        and (case_id is None or event.details.get("case_id") == case_id)
        and (session_id is None or event.details.get("session_id") in {None, session_id})
    )


def _question_draft_from_event(event: AuditEvent) -> dict[str, Any]:
    details = event.details
    raw_draft = details.get("draft", {})
    draft = dict(raw_draft) if isinstance(raw_draft, dict) else {}
    draft.setdefault("id", event.object_id)
    draft.setdefault("workspace_id", details.get("workspace_id"))
    draft.setdefault("case_id", details.get("case_id"))
    draft.setdefault("session_id", details.get("session_id"))
    draft.setdefault("participant_id", details.get("participant_id"))
    draft.setdefault("created_by", details.get("created_by", ""))
    draft.setdefault("created_at", event.timestamp.isoformat())
    draft.setdefault("source_object_ids", list(details.get("source_object_ids", ())))
    draft["audit_event_id"] = event.id
    draft["event_hash"] = event.event_hash
    return draft


def _question_draft_questions(
    events: tuple[AuditEvent, ...],
    *,
    case_id: str | None,
    session_id: str | None,
) -> tuple[Question, ...]:
    drafts = (_question_draft_from_event(event) for event in _question_draft_events(
        events,
        case_id=case_id,
        session_id=session_id,
    ))
    questions: list[Question] = []
    for draft in drafts:
        question_id = str(draft.get("id", "")).strip()
        text = str(draft.get("text", "")).strip()
        if not question_id or not text:
            continue
        questions.append(
            Question(
                id=question_id,
                text=text,
                source=QuestionSource.AI,
                question_type=QuestionType.CLARIFYING,
                topic_ids=tuple(str(topic_id) for topic_id in draft.get("topic_ids", ())),
                rationale=str(draft.get("rationale", "")),
            )
        )
    return tuple(questions)


def _operator_action_decision_events(
    events: tuple[AuditEvent, ...],
    *,
    case_id: str | None,
    session_id: str | None,
) -> tuple[AuditEvent, ...]:
    return tuple(
        event
        for event in events
        if event.object_type == "operator_action"
        and event.action.startswith("operator_action_")
        and (case_id is None or event.details.get("case_id") == case_id)
        and (session_id is None or event.details.get("session_id") == session_id)
    )


def _operator_action_decision_from_event(event: AuditEvent) -> dict[str, Any]:
    details = event.details
    return {
        "decision_id": event.id,
        "audit_event_id": event.id,
        "event_hash": event.event_hash,
        "workspace_id": details.get("workspace_id"),
        "case_id": details.get("case_id"),
        "session_id": details.get("session_id"),
        "participant_id": details.get("participant_id"),
        "created_at": event.timestamp.isoformat(),
        "created_by": details.get("created_by"),
        "action_id": details.get("action_id", event.object_id),
        "action_kind": details.get("action_kind"),
        "action_title": details.get("action_title"),
        "action_detail": details.get("action_detail"),
        "action_priority": details.get("action_priority"),
        "target_question_id": details.get("target_question_id"),
        "target_tab": details.get("target_tab"),
        "source_object_ids": list(details.get("source_object_ids", ())),
        "decision_type": details.get("decision_type"),
        "operator_note": details.get("operator_note", ""),
        "before_state": dict(details.get("before_state", {})),
        "after_state": dict(details.get("after_state", {})),
        "model_id": details.get("model_id", ""),
        "prompt_version": details.get("prompt_version", ""),
        "prompt_hash": details.get("prompt_hash", ""),
        "context_hash": details.get("context_hash", ""),
        "output_hash": details.get("output_hash", ""),
    }


def _stop_review_events(
    events: tuple[AuditEvent, ...],
    *,
    gate_id: str | None,
) -> tuple[AuditEvent, ...]:
    return tuple(
        event
        for event in events
        if event.object_type == "stop_review"
        and event.action.startswith("stop_review_")
        and (gate_id is None or event.details.get("gate_id") == gate_id)
    )


def _is_stop_review_approved(
    events: tuple[AuditEvent, ...],
    *,
    gate_id: str,
) -> bool:
    matching_events = _stop_review_events(events, gate_id=gate_id)
    if not matching_events:
        return False
    return matching_events[-1].details.get("decision") == "approved"


def _stop_review_decision_from_event(event: AuditEvent) -> dict[str, Any]:
    details = event.details
    return {
        "decision_id": event.id,
        "audit_event_id": event.id,
        "event_hash": event.event_hash,
        "workspace_id": details.get("workspace_id"),
        "case_id": details.get("case_id"),
        "gate_id": details.get("gate_id", event.object_id),
        "decision": details.get("decision"),
        "created_at": event.timestamp.isoformat(),
        "created_by": details.get("created_by"),
        "rationale": details.get("rationale", ""),
        "checklist": list(details.get("checklist", ())),
    }


def _build_material_question_draft(
    *,
    workspace_id: str,
    case_id: str,
    session_id: str | None,
    participant_id: str | None,
    material_id: str,
    material_title: str,
    material_text: str,
    topic_id: str | None,
    topic_label: str,
    source_object_ids: list[str],
    action_id: str,
    locale: str,
    created_by: str,
) -> dict[str, Any]:
    focus = topic_label.strip() or _material_focus_phrase(material_title, material_text)
    normalized_locale = "pl" if locale == "pl" else "en"
    text = (
        f"Proszę opisać, co wie Pan/Pani o kwestii „{focus}” oraz jak odnosi się ona "
        f"do materiału „{material_title}”."
        if normalized_locale == "pl"
        else f'Please describe what you know about "{focus}" and how it relates to the material "{material_title}".'
    )
    rationale = (
        f"Szkic utworzony z materiału „{material_title}” w celu neutralnego wyjaśnienia tematu."
        if normalized_locale == "pl"
        else f'Draft created from material "{material_title}" to clarify the topic neutrally.'
    )
    topic_ids = [topic_id] if topic_id else []
    deduped_sources = _dedupe_preserving_order(
        [material_id, *(topic_ids or []), action_id, *source_object_ids]
    )
    return {
        "id": f"draft-{uuid.uuid4().hex[:12]}",
        "workspace_id": workspace_id,
        "case_id": case_id,
        "session_id": session_id,
        "participant_id": participant_id,
        "text": text,
        "source": QuestionSource.AI.value,
        "question_type": QuestionType.CLARIFYING.value,
        "topic_ids": topic_ids,
        "source_material_ids": [material_id],
        "source_object_ids": deduped_sources,
        "status": "proposed",
        "locale": normalized_locale,
        "rationale": rationale,
        "created_by": created_by,
    }


def _material_focus_phrase(material_title: str, material_text: str) -> str:
    candidates = [
        material_title.strip(),
        " ".join(material_text.strip().replace("\n", " ").split()[:8]),
    ]
    return next((candidate for candidate in candidates if candidate), "registered case material")


def _dedupe_preserving_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []
    for value in values:
        normalized = str(value).strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(normalized)
    return deduped


def _case_with_question_drafts(case: Case, question_drafts: tuple[Question, ...]) -> Case:
    existing_ids = {question.id for question in case.questions}
    additions = tuple(question for question in question_drafts if question.id not in existing_ids)
    if not additions:
        return case
    return replace(case, questions=(*case.questions, *additions))


def _open_session_workspace(
    *,
    workspace_manager: CaseWorkspaceManager,
    workspace_id: str,
    case_id: str,
) -> CaseWorkspace:
    try:
        workspace = workspace_manager.open_workspace(workspace_id)
    except WorkspaceError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if workspace.manifest.case_id != case_id:
        raise HTTPException(status_code=400, detail="workspace case_id does not match session.")
    return workspace


def _workspace_response(workspace: CaseWorkspace) -> dict[str, Any]:
    return {
        "root_path": str(workspace.root_path),
        "manifest": _to_jsonable(workspace.manifest),
    }


def _read_workspace_material_texts(registry: MaterialRegistry) -> tuple[MaterialText, ...]:
    return tuple(
        MaterialText(record=record, text=registry.read_material_text(record.id))
        for record in registry.list_materials()
    )


def _build_evidence_context(
    *,
    case_id: str,
    locale: str,
    session_id: str | None,
    store: SessionStore,
    material_texts: tuple[MaterialText, ...],
    material_link_decisions: MaterialLinkDecisionLog | None = None,
    question_drafts: tuple[Question, ...] = (),
) -> dict[str, Any]:
    case = _case_with_question_drafts(
        _load_synthetic_case(case_id, locale=locale),
        question_drafts,
    )
    session = store.get_session(session_id) if session_id else None
    case_view = merge_session_answers(case, session) if session else case
    review = review_case(case_view)
    indicators = generate_indicators(case_view, review)
    material_links = link_materials_to_questions(case_view, material_texts)
    material_topic_signals = tuple(
        signal
        for material_text in material_texts
        for signal in infer_material_topic_signals(case_view.topics, material_text)
    )
    materials = tuple(material_text.record for material_text in material_texts)
    evidence_map = build_evidence_map(
        case=case_view,
        review=review,
        indicators=indicators,
        materials=materials,
        material_links=material_links,
        material_topic_signals=material_topic_signals,
    )
    evidence_alignment = build_evidence_alignment(
        case=case_view,
        proposed_links=material_links,
        decisions=material_link_decisions or MaterialLinkDecisionLog(),
    )
    return {
        "case": case_view,
        "review": review,
        "indicators": indicators,
        "materials": materials,
        "material_links": material_links,
        "material_topic_signals": material_topic_signals,
        "evidence_map": evidence_map,
        "evidence_alignment": evidence_alignment,
    }


def _validate_answer_request(case: Case, request: AddAnswerRequest) -> None:
    _require_non_empty("id", request.id)
    _require_non_empty("question_id", request.question_id)
    _require_non_empty("text", request.text)
    _require_known_id(
        "question_id",
        request.question_id,
        {question.id for question in case.questions},
    )

    topic_ids = {topic.id for topic in case.topics}
    for topic_id in request.topic_ids:
        _require_known_id("topic_id", topic_id, topic_ids)

    for index, raw_claim in enumerate(request.claims):
        missing = tuple(
            field
            for field in REQUIRED_CLAIM_FIELDS
            if not str(raw_claim.get(field, "")).strip()
        )
        if missing:
            fields = ", ".join(missing)
            raise HTTPException(
                status_code=400,
                detail=f"Claim {index} is missing required field(s): {fields}.",
            )
        try:
            ClaimReviewStatus(raw_claim.get("review_status", ClaimReviewStatus.ACCEPTED.value))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=f"Claim {index} has unsupported review_status.") from exc


def _validate_claim_review_decision(request: ClaimReviewDecisionRequest) -> None:
    if request.decision not in {
        ClaimReviewStatus.ACCEPTED,
        ClaimReviewStatus.EDITED,
        ClaimReviewStatus.REJECTED,
    }:
        raise HTTPException(status_code=400, detail="Unsupported claim review decision.")

    if request.decision == ClaimReviewStatus.EDITED:
        for field_name in ("subject", "attribute", "value"):
            _require_non_empty(field_name, getattr(request, field_name))


def _reviewed_claim(claim: Claim, request: ClaimReviewDecisionRequest) -> Claim:
    if request.decision == ClaimReviewStatus.EDITED:
        return replace(
            claim,
            subject=request.subject.strip(),
            attribute=request.attribute.strip(),
            value=request.value.strip(),
            source_text=request.source_text.strip() or claim.source_text,
            review_status=ClaimReviewStatus.EDITED,
        )

    return replace(claim, review_status=request.decision)


def _claim_audit_snapshot(claim: Claim) -> dict[str, object]:
    return {
        "id": claim.id,
        "subject": claim.subject,
        "attribute": claim.attribute,
        "value": claim.value,
        "source_text": claim.source_text,
        "review_status": claim.review_status.value,
        "extraction_rule": claim.extraction_rule,
        "extraction_hash": claim.extraction_hash,
        "confidence": claim.confidence,
        "source_start": claim.source_start,
        "source_end": claim.source_end,
    }


def _validate_grounded_suggestion_decision(
    suggestion_id: str,
    request: GroundedSuggestionDecisionRequest,
) -> None:
    _require_non_empty("suggestion_id", suggestion_id)
    _require_non_empty("original_text", request.original_text)
    if request.decision not in {
        SuggestionStatus.ACCEPTED,
        SuggestionStatus.EDITED,
        SuggestionStatus.REJECTED,
    }:
        raise HTTPException(status_code=400, detail="Unsupported grounded suggestion decision.")
    if request.decision in {SuggestionStatus.ACCEPTED, SuggestionStatus.EDITED}:
        _require_non_empty("final_text", request.final_text or request.original_text)
    _validate_optional_sha256("prompt_hash", request.prompt_hash)
    _validate_optional_sha256("context_hash", request.context_hash)
    _validate_optional_sha256("output_hash", request.output_hash)


def _validate_operator_action_decision(
    request: OperatorActionDecisionRequest,
    *,
    question_ids: set[str],
) -> None:
    _require_non_empty("action_id", request.action_id)
    _require_non_empty("action_kind", request.action_kind)
    _require_non_empty("action_title", request.action_title)
    _require_non_empty("action_detail", request.action_detail)
    if request.action_kind not in {"ask", "materials", "review"}:
        raise HTTPException(status_code=400, detail="Unsupported operator action kind.")
    if request.action_priority not in {"high", "medium", "low"}:
        raise HTTPException(status_code=400, detail="Unsupported operator action priority.")
    if request.decision_type not in {
        "opened",
        "accepted",
        "edited",
        "rejected",
        "skipped",
        "dismissed",
        "converted_to_question",
    }:
        raise HTTPException(status_code=400, detail="Unsupported operator action decision type.")
    if request.target_question_id:
        _require_known_id("target_question_id", request.target_question_id, question_ids)
    if request.target_tab and request.target_tab not in {"monitor", "ai", "materials", "review"}:
        raise HTTPException(status_code=400, detail="Unsupported operator action target tab.")
    _validate_optional_sha256("prompt_hash", request.prompt_hash)
    _validate_optional_sha256("context_hash", request.context_hash)
    _validate_optional_sha256("output_hash", request.output_hash)


def _validate_stop_review_decision(request: StopReviewDecisionRequest) -> None:
    if request.gate_id != MODEL_EXPERIMENT_STOP_GATE_ID:
        raise HTTPException(status_code=400, detail="Unsupported STOP review gate.")
    normalized_decision = request.decision.strip().lower()
    if normalized_decision not in STOP_REVIEW_DECISIONS:
        raise HTTPException(status_code=400, detail="Unsupported STOP review decision.")
    _require_non_empty("created_by", request.created_by)
    _require_non_empty("rationale", request.rationale)
    if normalized_decision == "approved" and not any(item.strip() for item in request.checklist):
        raise HTTPException(status_code=400, detail="Approved STOP review requires checklist evidence.")


def _validate_material_question_link_decision(
    *,
    material_id: str,
    question_id: str,
    request: MaterialQuestionLinkDecisionRequest,
    material_ids: set[str],
    question_ids: set[str],
    topic_ids: set[str],
) -> None:
    _require_non_empty("material_id", material_id)
    _require_non_empty("question_id", question_id)
    if request.question_id and request.question_id != question_id:
        raise HTTPException(status_code=400, detail="question_id does not match path.")
    _require_known_id("material_id", material_id, material_ids)
    _require_known_id("question_id", question_id, question_ids)
    if request.decision not in {"accepted", "rejected"}:
        raise HTTPException(status_code=400, detail="Unsupported material-question link decision.")
    for topic_id in request.topic_ids:
        _require_known_id("topic_id", topic_id, topic_ids)
    if request.confidence is not None and not 0 <= request.confidence <= 1:
        raise HTTPException(status_code=400, detail="confidence must be between 0 and 1.")


def _require_non_empty(field_name: str, value: str) -> None:
    if not str(value).strip():
        raise HTTPException(status_code=400, detail=f"{field_name} cannot be empty.")


def _require_known_id(field_name: str, value: str, allowed_values: set[str]) -> None:
    if value not in allowed_values:
        raise HTTPException(status_code=400, detail=f"Unknown {field_name}: {value}.")


def _validate_optional_sha256(field_name: str, value: str) -> None:
    if not value:
        return
    if len(value) != 64 or any(character not in "0123456789abcdef" for character in value):
        raise HTTPException(status_code=400, detail=f"{field_name} must be a lowercase SHA-256 hex digest.")


def _capture_grounded_suggestion_artifacts(
    *,
    workspace: CaseWorkspace,
    grounding_pack: Any,
    result: GroundedSuggestionResult,
    case_id: str,
    session_id: str | None,
    question_id: str | None,
) -> tuple[dict[str, Any] | None, dict[str, Any] | None, dict[str, Any] | None, str | None]:
    isolation_status = inspect_model_artifact_isolation(workspace)
    if isolation_status.state != "ready":
        return (
            None,
            None,
            None,
            "Model artifact isolation is not ready; grounded suggestion artifacts were not written.",
        )

    base_metadata: dict[str, Any] = {
        "case_id": case_id,
        "session_id": session_id,
        "question_id": question_id,
        "prompt_version": result.prompt_version,
    }
    try:
        prompt_write = write_model_artifact(
            workspace,
            artifact_type="prompt",
            content=result.prompt_text,
            content_type="application/json",
            source="grounded_suggestions.prompt",
            created_by="grounded-suggestions-service",
            metadata={
                **base_metadata,
                "prompt_hash": result.prompt_hash,
                "context_hash": result.context_hash,
            },
        )
        context_write = write_model_artifact(
            workspace,
            artifact_type="context",
            content=_json_artifact_content(_to_jsonable(grounding_pack)),
            content_type="application/json",
            source="grounded_suggestions.context",
            created_by="grounded-suggestions-service",
            metadata={
                **base_metadata,
                "prompt_hash": result.prompt_hash,
                "context_hash": result.context_hash,
            },
        )
        output_write = write_model_artifact(
            workspace,
            artifact_type="output",
            content=result.output_text,
            content_type="application/json",
            source="grounded_suggestions.output",
            created_by="grounded-suggestions-service",
            metadata={
                **base_metadata,
                "model": result.batch.model,
                "prompt_hash": result.prompt_hash,
                "output_hash": result.output_hash,
                "suggestion_count": len(result.batch.suggestions),
                "warning_count": len(result.warnings),
            },
        )
    except WorkspaceError as exc:
        return None, None, None, f"Grounded suggestion artifact write failed safely: {exc}"

    return (
        _artifact_summary(prompt_write),
        _artifact_summary(context_write),
        _artifact_summary(output_write),
        None,
    )


def _artifact_summary(write_result: ModelArtifactWriteResult) -> dict[str, Any]:
    record = write_result.record
    return {
        "artifact_id": record.artifact_id,
        "artifact_type": record.artifact_type,
        "relative_path": record.relative_path,
        "sha256": record.sha256,
        "deduplicated": write_result.deduplicated,
    }


def _json_artifact_content(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True)


def _to_jsonable(value: Any) -> Any:
    if is_dataclass(value):
        return {
            key: _to_jsonable(item)
            for key, item in asdict(value).items()
        }
    if isinstance(value, tuple):
        return [_to_jsonable(item) for item in value]
    if isinstance(value, list):
        return [_to_jsonable(item) for item in value]
    if isinstance(value, dict):
        return {str(key): _to_jsonable(item) for key, item in value.items()}
    if hasattr(value, "value"):
        return value.value
    if hasattr(value, "isoformat"):
        return value.isoformat()

    return value


if __name__ == "__main__":
    main()
