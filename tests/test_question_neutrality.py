import unittest

from interrogaition.analysis.question_neutrality import is_neutral_enough, neutrality_flags


class QuestionNeutralityTest(unittest.TestCase):
    def test_open_question_is_allowed(self) -> None:
        self.assertTrue(is_neutral_enough("Co wydarzylo sie potem?"))

    def test_leading_question_is_flagged(self) -> None:
        flags = neutrality_flags("Przeciez byl Pan tam o 20:00, prawda?")

        self.assertIn("leading", flags)

    def test_accusatory_question_is_flagged(self) -> None:
        flags = neutrality_flags("Dlaczego Pan klamie?")

        self.assertIn("accusatory", flags)


if __name__ == "__main__":
    unittest.main()

