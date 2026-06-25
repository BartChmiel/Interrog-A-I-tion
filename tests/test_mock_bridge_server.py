import json
import threading
import unittest
import urllib.request

from interrogaition.ai.mock_bridge_server import MockBridgeServer


class MockBridgeServerTest(unittest.TestCase):
    def test_chat_completions_returns_grounded_suggestion_payload(self) -> None:
        server = MockBridgeServer(("127.0.0.1", 0), model="mock-model")
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            prompt = {
                "task": "suggest_grounded_followups",
                "locale": "en",
                "grounding_pack": {
                    "allowed_source_ids": ["q-001", "mat-001"],
                    "topic_contexts": [
                        {
                            "topic_id": "topic-001",
                            "label": "medication discrepancy",
                            "question_ids": ["q-001"],
                            "material_ids": ["mat-001"],
                        }
                    ],
                },
            }
            request = urllib.request.Request(
                url=f"http://127.0.0.1:{server.server_port}/v1/chat/completions",
                data=json.dumps(
                    {
                        "model": "mock-model",
                        "messages": [{"role": "user", "content": json.dumps(prompt)}],
                        "response_format": {"type": "json_object"},
                    }
                ).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )

            with urllib.request.urlopen(request, timeout=5) as response:
                payload = json.loads(response.read().decode("utf-8"))

            content = payload["choices"][0]["message"]["content"]
            suggestions = json.loads(content)["suggestions"]
            self.assertEqual(payload["model"], "mock-model")
            self.assertEqual(suggestions[0]["linked_topics"], ["topic-001"])
            self.assertEqual(suggestions[0]["linked_evidence"], ["q-001", "mat-001"])
        finally:
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    unittest.main()
