import unittest

from interrogaition.ai.local_model_runtime import (
    DEFAULT_DETERMINISTIC_MODEL,
    LocalModelRuntimeConfig,
    load_local_model_runtime_config,
    run_local_model_smoke,
)


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

    def test_deterministic_smoke_does_not_invoke_real_model(self) -> None:
        result = run_local_model_smoke(LocalModelRuntimeConfig())

        self.assertTrue(result.ok)
        self.assertEqual(result.model, "deterministic-smoke")
        self.assertFalse(result.real_model_invoked)
        self.assertIn("deterministic-smoke", result.response_preview)


if __name__ == "__main__":
    unittest.main()
