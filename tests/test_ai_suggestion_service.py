import unittest
from pathlib import Path

from interrogaition.ai.model_client import FakeModelClient
from interrogaition.ai.response_parser import ModelResponseError, parse_suggestion_response
from interrogaition.ai.suggestion_service import generate_followup_suggestions
from interrogaition.storage.json_case_loader import load_case_from_json


ROOT = Path(__file__).resolve().parents[1]
CASE_PATH = ROOT / "data" / "synthetic" / "case-001" / "case.json"


VALID_RESPONSE = """
{
  "suggestions": [
    {
      "type": "follow_up_question",
      "question": "Can you clarify the time difference between 19:45 and 20:10?",
      "reason": "The recorded answers contain two different times for the same event.",
      "linked_topics": ["topic-chronology"],
      "linked_evidence": ["a-001", "a-002"],
      "risk_flags": [],
      "confidence": 0.81
    }
  ]
}
"""


class AISuggestionServiceTest(unittest.TestCase):
    def test_generates_suggestions_with_fake_model(self) -> None:
        case = load_case_from_json(CASE_PATH)
        model = FakeModelClient(response_text=VALID_RESPONSE)

        batch = generate_followup_suggestions(case, model)

        self.assertEqual(len(batch.suggestions), 1)
        self.assertEqual(batch.suggestions[0].suggestion_type, "follow_up_question")
        self.assertEqual(batch.suggestions[0].linked_topics, ("topic-chronology",))
        self.assertEqual(batch.suggestions[0].confidence, 0.81)
        self.assertIsNotNone(model.requests)
        self.assertIn("suggest_followup_questions", model.requests[0].user_prompt)

    def test_rejects_invalid_json(self) -> None:
        with self.assertRaises(ModelResponseError):
            parse_suggestion_response("not json")

    def test_rejects_forbidden_truthfulness_verdict(self) -> None:
        response = """
        {
          "suggestions": [
            {
              "type": "follow_up_question",
              "question": "Why is the person lying?",
              "reason": "The model says the person is lying.",
              "confidence": 0.9
            }
          ]
        }
        """

        with self.assertRaises(ModelResponseError):
            parse_suggestion_response(response)


if __name__ == "__main__":
    unittest.main()

