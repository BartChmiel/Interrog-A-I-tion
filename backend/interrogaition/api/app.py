"""FastAPI application for the local prototype."""

from __future__ import annotations

import argparse
import json
import sqlite3
from dataclasses import asdict, dataclass, field, is_dataclass
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
    LocalModelRuntimeConfig,
    load_local_model_runtime_config,
    resolve_grounded_model_client,
    run_local_model_smoke,
)
from interrogaition.ai.model_client import ModelClient
from interrogaition.domain.models import Actor, Answer, AuditEvent, Claim, Case, Priority, SuggestionStatus
from interrogaition.domain.session import (
    InterviewSession,
    ParticipantRole,
    add_answer,
    merge_session_answers,
    start_interview_session,
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
    claims: list[dict[str, str]] = field(default_factory=list)


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
    def smoke_local_model(execute_real: bool = Query(default=False)) -> dict[str, Any]:
        return _to_jsonable(
            run_local_model_smoke(
                local_model_config,
                execute_real=execute_real,
            )
        )

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
        context = _build_evidence_context(
            case_id=case_id,
            locale=locale,
            session_id=session_id,
            store=store,
            material_texts=material_texts,
            material_link_decisions=decisions,
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

        context = _build_evidence_context(
            case_id=case_id,
            locale=locale,
            session_id=session_id,
            store=store,
            material_texts=material_texts,
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

        context = _build_evidence_context(
            case_id=case_id,
            locale=locale,
            session_id=session_id,
            store=store,
            material_texts=material_texts,
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
        _validate_answer_request(case, request)

        answer = Answer(
            id=request.id,
            question_id=request.question_id,
            text=request.text,
            topic_ids=tuple(request.topic_ids),
            claims=tuple(
                Claim(
                    id=raw["id"],
                    subject=raw["subject"],
                    attribute=raw["attribute"],
                    value=raw["value"],
                    source_text=raw.get("source_text", ""),
                )
                for raw in request.claims
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
            },
        )
        return _to_jsonable(updated)

    @app.get("/sessions/{session_id}/review")
    def review_session_endpoint(
        session_id: str,
        locale: str = Query(default="en"),
    ) -> dict[str, Any]:
        session = store.get_session(session_id)
        if session is None:
            raise HTTPException(status_code=404, detail="Session not found.")

        case = _load_synthetic_case(session.case_id, locale=locale)
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
) -> dict[str, Any]:
    case = _load_synthetic_case(case_id, locale=locale)
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
