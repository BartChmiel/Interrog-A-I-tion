import unittest

from interrogaition.ai.guardrails import find_forbidden_claims, is_ai_output_allowed


class GuardrailsTest(unittest.TestCase):
    def test_allows_material_description(self) -> None:
        text = "Ten fragment wymaga doprecyzowania w zakresie chronologii."

        self.assertTrue(is_ai_output_allowed(text))

    def test_blocks_truthfulness_verdict(self) -> None:
        text = "Osoba klamie i jest winna."

        self.assertFalse(is_ai_output_allowed(text))
        self.assertIn("klamie", find_forbidden_claims(text))


if __name__ == "__main__":
    unittest.main()

