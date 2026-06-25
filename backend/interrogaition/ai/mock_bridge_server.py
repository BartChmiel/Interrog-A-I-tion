"""Developer-only OpenAI-compatible bridge mock.

This server is intentionally small. It lets the backend exercise the same
HTTP bridge path as a real OpenAI-compatible runtime without requiring a local
model install during development.
"""

from __future__ import annotations

import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any


DEFAULT_MODEL = "interrogaition-bridge-mock"


class MockBridgeHandler(BaseHTTPRequestHandler):
    server: "MockBridgeServer"

    def do_GET(self) -> None:
        if self.path.rstrip("/") == "/health":
            self._write_json({"status": "ok", "model": self.server.model})
            return

        self._write_json({"error": "not_found"}, status=404)

    def do_POST(self) -> None:
        if self.path.rstrip("/") != "/v1/chat/completions":
            self._write_json({"error": "not_found"}, status=404)
            return

        try:
            payload = self._read_json()
            content = _mock_completion_content(payload)
            response = {
                "id": "chatcmpl-interrogaition-mock",
                "object": "chat.completion",
                "model": str(payload.get("model") or self.server.model),
                "choices": [
                    {
                        "index": 0,
                        "finish_reason": "stop",
                        "message": {
                            "role": "assistant",
                            "content": content,
                        },
                    }
                ],
                "usage": {
                    "prompt_tokens": _rough_token_count(json.dumps(payload, ensure_ascii=False)),
                    "completion_tokens": _rough_token_count(content),
                },
            }
        except Exception as exc:  # pragma: no cover - defensive server boundary
            self._write_json({"error": "bad_request", "detail": str(exc)}, status=400)
            return

        self._write_json(response)

    def log_message(self, format: str, *args: object) -> None:
        return

    def _read_json(self) -> dict[str, Any]:
        content_length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(content_length).decode("utf-8")
        payload = json.loads(raw) if raw else {}
        if not isinstance(payload, dict):
            raise ValueError("Request body must be a JSON object.")
        return payload

    def _write_json(self, payload: dict[str, Any], *, status: int = 200) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


class MockBridgeServer(ThreadingHTTPServer):
    def __init__(self, server_address: tuple[str, int], model: str) -> None:
        super().__init__(server_address, MockBridgeHandler)
        self.model = model


def _mock_completion_content(payload: dict[str, Any]) -> str:
    user_content = _latest_user_content(payload)
    prompt_payload = _parse_json_object(user_content)
    grounding_pack = prompt_payload.get("grounding_pack") if isinstance(prompt_payload, dict) else None
    if isinstance(grounding_pack, dict):
        return json.dumps(
            {"suggestions": [_grounded_suggestion(grounding_pack)]},
            ensure_ascii=False,
        )

    return json.dumps(
        {
            "status": "ok",
            "provider": "bridge-mock",
            "detail": "Mock bridge accepted the OpenAI-compatible chat completion request.",
        },
        ensure_ascii=False,
    )


def _latest_user_content(payload: dict[str, Any]) -> str:
    messages = payload.get("messages")
    if not isinstance(messages, list):
        return ""

    for message in reversed(messages):
        if isinstance(message, dict) and message.get("role") == "user":
            return str(message.get("content") or "")
    return ""


def _parse_json_object(text: str) -> dict[str, Any]:
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _grounded_suggestion(grounding_pack: dict[str, Any]) -> dict[str, Any]:
    topic = _first_topic(grounding_pack)
    topic_id = str(topic.get("topic_id") or "mock-topic")
    label = str(topic.get("label") or "current case thread")
    evidence = _evidence_for_topic(topic, grounding_pack)

    return {
        "id": "bridge-mock-suggestion-001",
        "type": "follow_up_question",
        "question": f"Please clarify the '{label}' thread using only the available source material.",
        "reason": "Developer mock bridge response generated through the OpenAI-compatible runtime path.",
        "linked_topics": [topic_id],
        "linked_evidence": evidence,
        "risk_flags": ["operator_review_required", "mock_bridge"],
        "confidence": 0.5,
    }


def _first_topic(grounding_pack: dict[str, Any]) -> dict[str, Any]:
    topics = grounding_pack.get("topic_contexts")
    if isinstance(topics, list):
        for topic in topics:
            if isinstance(topic, dict):
                return topic
    return {}


def _evidence_for_topic(topic: dict[str, Any], grounding_pack: dict[str, Any]) -> list[str]:
    allowed = {
        str(source_id)
        for source_id in grounding_pack.get("allowed_source_ids", [])
    }
    candidates = [
        str(source_id)
        for key in ("question_ids", "answer_ids", "claim_ids", "material_ids", "finding_ids")
        for source_id in topic.get(key, [])
    ]
    evidence = [source_id for source_id in candidates if not allowed or source_id in allowed]
    if evidence:
        return evidence[:4]
    if allowed:
        return sorted(allowed)[:1]
    return [str(topic.get("topic_id") or "mock-topic")]


def _rough_token_count(text: str) -> int:
    return max(1, len(text.split()))


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Run the InterrogA(I)tion bridge mock.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8080, type=int)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    args = parser.parse_args(argv)

    server = MockBridgeServer((args.host, args.port), model=args.model)
    print(
        f"Mock bridge listening on http://{args.host}:{args.port}/v1/chat/completions",
        flush=True,
    )
    server.serve_forever()


if __name__ == "__main__":  # pragma: no cover - CLI entrypoint
    main()
