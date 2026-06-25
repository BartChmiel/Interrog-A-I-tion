import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from interrogaition.ai.bridge_client import BridgeModelClient
from interrogaition.ai.model_client import ModelRequest


class BridgeClientTest(unittest.TestCase):
    def test_complete_posts_openai_compatible_chat_request(self) -> None:
        captured: dict[str, object] = {}

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self) -> None:  # noqa: N802 - stdlib hook
                captured["path"] = self.path
                captured["authorization"] = self.headers.get("Authorization")
                length = int(self.headers.get("Content-Length", "0"))
                captured["payload"] = json.loads(self.rfile.read(length).decode("utf-8"))
                body = json.dumps(
                    {
                        "model": "bridge-test-model",
                        "choices": [{"message": {"content": '{"suggestions":[]}'}}],
                        "usage": {"prompt_tokens": 7, "completion_tokens": 3},
                    }
                ).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, format: str, *args: object) -> None:
                return

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            base_url = f"http://127.0.0.1:{server.server_port}/v1"
            client = BridgeModelClient(model="bridge-test-model", base_url=base_url, api_key="secret")

            response = client.complete(
                ModelRequest(
                    system_prompt="system",
                    user_prompt='{"task":"test"}',
                    temperature=0.1,
                )
            )
        finally:
            server.shutdown()
            thread.join(timeout=2)
            server.server_close()

        payload = captured["payload"]
        self.assertEqual(captured["path"], "/v1/chat/completions")
        self.assertEqual(captured["authorization"], "Bearer secret")
        self.assertIsInstance(payload, dict)
        self.assertEqual(payload["model"], "bridge-test-model")
        self.assertEqual(payload["response_format"], {"type": "json_object"})
        self.assertEqual(response.text, '{"suggestions":[]}')
        self.assertEqual(response.model, "bridge-test-model")
        self.assertEqual(response.prompt_tokens, 7)
        self.assertEqual(response.completion_tokens, 3)


if __name__ == "__main__":
    unittest.main()
