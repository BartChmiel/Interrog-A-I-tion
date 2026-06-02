"""FastAPI application for the local prototype."""

from __future__ import annotations

import argparse
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

from interigaition.analysis.credibility_indicators import generate_indicators
from interigaition.analysis.evidence_map import build_evidence_map
from interigaition.analysis.interview_review import review_case
from interigaition.analysis.live_review import review_live_session
from interigaition.analysis.material_grounding import (
    MaterialText,
    infer_material_topic_signals,
    link_materials_to_questions,
)
from interigaition.domain.models import Actor, Answer, AuditEvent, Claim, Case
from interigaition.domain.session import (
    InterviewSession,
    ParticipantRole,
    add_answer,
    merge_session_answers,
    start_interview_session,
)
from interigaition.export.markdown_report import render_review_markdown
from interigaition.security.access_policy import (
    WorkspaceAction,
    WorkspaceRole,
    decide_workspace_access,
)
from interigaition.security.case_workspace import (
    CaseWorkspace,
    CaseWorkspaceManager,
    DataSensitivity,
    StorageMode,
    WorkspaceError,
)
from interigaition.storage.json_case_loader import load_case_from_json
from interigaition.storage.material_registry import (
    MaterialRegistry,
    MaterialRegistryError,
    MaterialSourceType,
)
from interigaition.storage.session_store import SessionStore
from interigaition.storage.sqlite_session_store import SQLiteSessionStore


SYNTHETIC_CASES_ROOT = PROJECT_ROOT / "data" / "synthetic"
DEFAULT_DATABASE_PATH = BACKEND_ROOT / "local-data" / "interigaition.sqlite3"
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


def create_app(
    store: SessionStore | None = None,
    workspace_manager: CaseWorkspaceManager | None = None,
) -> FastAPI:
    app = FastAPI(
        title="InterigA(I)tion Local API",
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

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/locales")
    def locales() -> dict[str, list[str]]:
        return {"locales": ["en", "pl"]}

    @app.get("/security/encryption")
    def get_encryption_status() -> dict[str, Any]:
        return _to_jsonable(workspace_manager.encryption_status())

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
        evidence_map = build_evidence_map(
            case=case_view,
            review=review,
            indicators=indicators,
            materials=tuple(material_text.record for material_text in material_texts),
            material_links=material_links,
            material_topic_signals=material_topic_signals,
        )
        return {"evidence_map": _to_jsonable(evidence_map)}

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
        description="Run the InterigA(I)tion local API prototype.",
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
        "interigaition.api.app:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
    )


def _load_synthetic_case(case_id: str, locale: str) -> Case:
    path = SYNTHETIC_CASES_ROOT / case_id / "case.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Synthetic case not found.")

    return load_case_from_json(path, locale=locale)


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


def _require_non_empty(field_name: str, value: str) -> None:
    if not str(value).strip():
        raise HTTPException(status_code=400, detail=f"{field_name} cannot be empty.")


def _require_known_id(field_name: str, value: str, allowed_values: set[str]) -> None:
    if value not in allowed_values:
        raise HTTPException(status_code=400, detail=f"Unknown {field_name}: {value}.")


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
