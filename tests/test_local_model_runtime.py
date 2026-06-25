import unittest

from interrogaition.ai.local_model_runtime import (
    DEFAULT_BRIDGE_BASE_URL,
    DEFAULT_BRIDGE_MODEL,
    DEFAULT_DETERMINISTIC_MODEL,
    LocalModelRuntimeConfig,
    load_local_model_runtime_config,
    resolve_grounded_model_client,
    run_local_model_smoke,
)
from interrogaition.ai.bridge_client import BridgeModelClient
from interrogaition.ai.model_client import DeterministicGroundedModelClient, FakeModelClient
from interrogaition.ai.ollama_client import OllamaClient


class LocalModelRuntimeTest(unittest.TestCase):
    def test_defaults_keep_runtime_deterministic(self) -> None:
        config = load_local_model_runtime_config({})

        self.assertEqual(config.provider, "deterministic")
        self.assertEqual(config.effective_provider, "deterministic")
        self.assertEqual(config.configured_model, DEFAULT_DETERMINISTIC_MODEL)
        self.assertFalse(config.real_model_enabled)
        self.assertFalse(config.live_output_enabled)

    def test_ollama_provider_stays_blocked_without_explicit_real_flag(self) -> None:
        config = load_local_model_runtime_config(
            {
                "INTERROGAITION_MODEL_PROVIDER": "ollama",
                "INTERROGAITION_OLLAMA_MODEL": "llama3.1:8b",
            }
        )

        result = run_local_model_smoke(config, execute_real=True)

        self.assertEqual(config.provider, "ollama")
        self.assertEqual(config.effective_provider, "deterministic")
        self.assertFalse(result.ok)
        self.assertFalse(result.real_model_invoked)
        self.assertIn("disabled", result.detail)

    def test_bridge_provider_loads_openai_compatible_runtime_settings(self) -> None:
        config = load_local_model_runtime_config(
            {
                "INTERROGAITION_MODEL_PROVIDER": "bridge",
                "INTERROGAITION_BRIDGE_MODEL": "bridge-model",
                "INTERROGAITION_BRIDGE_BASE_URL": "http://127.0.0.1:9999/v1",
                "INTERROGAITION_BRIDGE_API_KEY": "secret-token",
                "INTERROGAITION_ENABLE_REAL_MODEL": "1",
            }
        )

        self.assertEqual(config.provider, "bridge")
        self.assertEqual(config.effective_provider, "bridge")
        self.assertEqual(config.configured_model, "bridge-model")
        self.assertEqual(config.bridge_base_url, "http://127.0.0.1:9999/v1")
        self.assertTrue(config.bridge_api_key_configured)

    def test_bridge_defaults_are_stable(self) -> None:
        config = load_local_model_runtime_config({"INTERROGAITION_MODEL_PROVIDER": "bridge"})

        self.assertEqual(config.configured_model, DEFAULT_BRIDGE_MODEL)
        self.assertEqual(config.bridge_base_url, DEFAULT_BRIDGE_BASE_URL)

    def test_deterministic_smoke_does_not_invoke_real_model(self) -> None:
        result = run_local_model_smoke(LocalModelRuntimeConfig())

        self.assertTrue(result.ok)
        self.assertEqual(result.model, "deterministic-smoke")
        self.assertFalse(result.real_model_invoked)
        self.assertIn("deterministic-smoke", result.response_preview)

    def test_live_output_flag_is_loaded_from_environment(self) -> None:
        config = load_local_model_runtime_config(
            {
                "INTERROGAITION_ENABLE_LIVE_MODEL_OUTPUT": "1",
            }
        )

        self.assertTrue(config.live_output_enabled)

    def test_resolve_grounded_model_client_defaults_to_deterministic(self) -> None:
        client = resolve_grounded_model_client(LocalModelRuntimeConfig())

        self.assertIsInstance(client, DeterministicGroundedModelClient)

    def test_resolve_grounded_model_client_uses_ollama_when_live_enabled(self) -> None:
        config = LocalModelRuntimeConfig(
            provider="ollama",
            configured_model="llama3.1:8b",
            real_model_enabled=True,
            live_output_enabled=True,
        )

        client = resolve_grounded_model_client(config)

        self.assertIsInstance(client, OllamaClient)
        self.assertEqual(client.model, "llama3.1:8b")

    def test_resolve_grounded_model_client_uses_bridge_when_live_enabled(self) -> None:
        config = LocalModelRuntimeConfig(
            provider="bridge",
            configured_model="bridge-model",
            bridge_base_url="http://127.0.0.1:9999/v1",
            bridge_api_key="secret-token",
            real_model_enabled=True,
            live_output_enabled=True,
        )

        client = resolve_grounded_model_client(config)

        self.assertIsInstance(client, BridgeModelClient)
        self.assertEqual(client.model, "bridge-model")
        self.assertEqual(client.base_url, "http://127.0.0.1:9999/v1")

    def test_resolve_grounded_model_client_honors_override(self) -> None:
        override = FakeModelClient(response_text='{"suggestions":[]}', model="test-override")
        client = resolve_grounded_model_client(
            LocalModelRuntimeConfig(
                provider="ollama",
                configured_model="llama3.1:8b",
                real_model_enabled=True,
                live_output_enabled=True,
            ),
            override=override,
        )

        self.assertIs(client, override)


if __name__ == "__main__":
    unittest.main()
