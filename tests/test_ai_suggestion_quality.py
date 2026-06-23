import unittest

from interrogaition.ai.model_client import DeterministicGroundedModelClient, FakeModelClient
from interrogaition.ai.grounded_suggestion_service import generate_grounded_suggestions

from tests.test_grounded_suggestion_service import _grounding_pack


class SuggestionQualityTest(unittest.TestCase):
    def test_deterministic_grounded_suggestions_are_quality_ready(self) -> None:
        result = generate_grounded_suggestions(
            grounding_pack=_grounding_pack(),
            model_client=DeterministicGroundedModelClient(),
            locale="en",
        )

        self.assertEqual(result.quality_report.state, "ready")
        self.assertEqual(result.quality_report.score, 100)
        self.assertEqual(result.quality_report.issue_count, 0)
        self.assertTrue(result.quality_report.records)
        self.assertTrue(all(record.state == "ready" for record in result.quality_report.records))

    def test_reports_warning_for_ungrounded_or_unreviewable_suggestion(self) -> None:
        model = FakeModelClient(
            response_text="""
            {
              "suggestions": [
                {
                  "id": "bad-suggestion-001",
                  "type": "follow_up_question",
                  "question": "Can you clarify the timeline?",
                  "reason": "The timeline needs clarification.",
                  "linked_topics": ["topic-chronology"],
                  "linked_evidence": ["not-in-pack"],
                  "risk_flags": [],
                  "confidence": 0.7
                }
              ]
            }
            """
        )

        result = generate_grounded_suggestions(
            grounding_pack=_grounding_pack(),
            model_client=model,
            locale="en",
        )
        codes = {issue.code for issue in result.quality_report.issues}

        self.assertEqual(result.quality_report.state, "warning")
        self.assertLess(result.quality_report.score, 100)
        self.assertIn("unknown_source_id", codes)
        self.assertIn("missing_operator_review_flag", codes)
        self.assertEqual(result.quality_report.records[0].state, "warning")


if __name__ == "__main__":
    unittest.main()
