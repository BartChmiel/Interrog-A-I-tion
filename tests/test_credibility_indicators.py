import unittest
from pathlib import Path

from interrogaition.analysis.credibility_indicators import generate_indicators
from interrogaition.analysis.interview_review import review_case
from interrogaition.domain.indicators import IndicatorCategory
from interrogaition.export.markdown_report import render_review_markdown
from interrogaition.storage.json_case_loader import load_case_from_json


ROOT = Path(__file__).resolve().parents[1]
CASE_PATH = ROOT / "data" / "synthetic" / "case-001" / "case.json"


class CredibilityIndicatorsTest(unittest.TestCase):
    def test_generates_expected_indicator_layers(self) -> None:
        case = load_case_from_json(CASE_PATH)
        review = review_case(case)
        indicators = generate_indicators(case, review)

        categories = {indicator.category for indicator in indicators}
        self.assertIn(IndicatorCategory.PROCESS, categories)
        self.assertIn(IndicatorCategory.CONSISTENCY, categories)
        self.assertIn(IndicatorCategory.EVIDENCE_ALIGNMENT, categories)
        self.assertIn(IndicatorCategory.CREDIBILITY_REVIEW, categories)

    def test_indicators_are_factorized_and_traceable(self) -> None:
        case = load_case_from_json(CASE_PATH)
        review = review_case(case)
        indicators = generate_indicators(case, review)
        summary = next(indicator for indicator in indicators if indicator.id == "indicator-credibility-review")

        self.assertIsNotNone(summary.score)
        self.assertGreater(len(summary.factors), 1)
        self.assertTrue(any(factor.linked_ids for factor in summary.factors))

    def test_indicators_do_not_issue_person_level_verdicts(self) -> None:
        case = load_case_from_json(CASE_PATH)
        review = review_case(case)
        indicators = generate_indicators(case, review)

        parts: list[str] = []
        for indicator in indicators:
            parts.extend(
                [
                    indicator.label,
                    indicator.description,
                    indicator.interpretation,
                    " ".join(indicator.limitations),
                ]
            )

        combined = " ".join(parts).lower()

        self.assertNotIn("the person is lying", combined)
        self.assertNotIn("the person is guilty", combined)
        self.assertNotIn("the person is unreliable", combined)

    def test_report_can_render_indicators(self) -> None:
        case = load_case_from_json(CASE_PATH)
        review = review_case(case)
        indicators = generate_indicators(case, review)
        report = render_review_markdown(case, review, indicators=indicators)

        self.assertIn("Decision-support indicators", report)
        self.assertIn("Credibility review summary", report)
        self.assertIn("Score bar", report)
        self.assertIn("[########--]", report)
        self.assertIn("Factors", report)


if __name__ == "__main__":
    unittest.main()
