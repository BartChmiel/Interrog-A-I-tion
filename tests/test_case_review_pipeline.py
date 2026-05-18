import unittest
from pathlib import Path

from interigaition.analysis.interview_review import review_case
from interigaition.export.markdown_report import render_review_markdown
from interigaition.storage.json_case_loader import load_case_from_json


ROOT = Path(__file__).resolve().parents[1]
CASE_PATH = ROOT / "data" / "synthetic" / "case-001" / "case.json"


class CaseReviewPipelineTest(unittest.TestCase):
    def test_loads_synthetic_case(self) -> None:
        case = load_case_from_json(CASE_PATH)

        self.assertEqual(case.id, "case-001")
        self.assertEqual(len(case.topics), 5)
        self.assertEqual(len(case.questions), 4)
        self.assertEqual(len(case.answers), 3)

    def test_loads_localized_case_labels(self) -> None:
        case = load_case_from_json(CASE_PATH, locale="pl")

        self.assertIn("kradzieży roweru", case.title)
        self.assertEqual(case.topics[-1].label, "Potencjalne nagranie")

    def test_review_detects_missing_topic_neutrality_and_inconsistency(self) -> None:
        case = load_case_from_json(CASE_PATH)
        review = review_case(case)

        categories = {finding.category for finding in review.findings}
        self.assertIn("missing_topic", categories)
        self.assertIn("question_neutrality", categories)
        self.assertIn("potential_inconsistency", categories)
        self.assertIn("topic-recording", review.missing_topic_ids)

    def test_markdown_report_keeps_core_safety_boundary(self) -> None:
        case = load_case_from_json(CASE_PATH)
        review = review_case(case)
        report = render_review_markdown(case, review)

        self.assertIn("does not determine whether a person is lying", report)
        self.assertIn("Potential inconsistency", report)
        self.assertIn("Missing topic", report)

    def test_markdown_report_supports_polish_language_pack(self) -> None:
        case = load_case_from_json(CASE_PATH, locale="pl")
        review = review_case(case)
        report = render_review_markdown(case, review, locale="pl")

        self.assertIn("Raport analizy", report)
        self.assertIn("Niepokryty temat", report)
        self.assertIn("Potencjalne nagranie", report)
        self.assertIn("nie werdyktu o prawdomówności", report)


if __name__ == "__main__":
    unittest.main()
