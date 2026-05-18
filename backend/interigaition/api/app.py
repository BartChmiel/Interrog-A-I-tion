"""FastAPI application for the local prototype."""

from __future__ import annotations

import argparse
from dataclasses import asdict, dataclass, field, is_dataclass
from pathlib import Path
from typing import Any, Callable


PROJECT_ROOT = Path(__file__).resolve().parents[3]

try:
    from fastapi import FastAPI, HTTPException, Query  # type: ignore  # noqa: E402
except Exception:  # pragma: no cover - exercised in restricted local environments
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
from interigaition.analysis.interview_review import review_case
from interigaition.domain.models import Answer, Claim, Case
from interigaition.domain.session import (
    InterviewSession,
    ParticipantRole,
    add_answer,
    start_interview_session,
)
from interigaition.export.markdown_report import render_review_markdown
from interigaition.storage.json_case_loader import load_case_from_json


SYNTHETIC_CASES_ROOT = PROJECT_ROOT / "data" / "synthetic"


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


def create_app() -> FastAPI:
    app = FastAPI(
        title="InterigA(I)tion Local API",
        version="0.1.0",
        description="Local API for the AI-assisted investigative interviewing prototype.",
    )
    sessions: dict[str, InterviewSession] = {}

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/locales")
    def locales() -> dict[str, list[str]]:
        return {"locales": ["en", "pl"]}

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
        _load_synthetic_case(request.case_id, locale="en")
        session = start_interview_session(
            session_id=request.session_id,
            case_id=request.case_id,
            participant_id=request.participant_id,
            initial_role=request.initial_role,
        )
        sessions[session.id] = session
        return _to_jsonable(session)

    @app.post("/sessions/{session_id}/answers")
    def add_session_answer(session_id: str, request: AddAnswerRequest) -> dict[str, Any]:
        session = sessions.get(session_id)
        if session is None:
            raise HTTPException(status_code=404, detail="Session not found.")

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
        sessions[session_id] = updated
        return _to_jsonable(updated)

    return app


app = create_app()


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
