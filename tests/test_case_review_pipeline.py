import unittest
from pathlib import Path

from interrogaition.analysis.interview_review import review_case
from interrogaition.export.markdown_report import render_review_markdown
from interrogaition.storage.json_case_loader import load_case_from_json
from interrogaition.storage.synthetic_material_loader import load_synthetic_materials


ROOT = Path(__file__).resolve().parents[1]
SYNTHETIC_ROOT = ROOT / "data" / "synthetic"
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

    def test_loads_all_synthetic_scenarios(self) -> None:
        case_paths = sorted(SYNTHETIC_ROOT.glob("case-*/case.json"))

        cases = [load_case_from_json(path, locale="en") for path in case_paths]

        self.assertGreaterEqual(len(cases), 3)
        self.assertEqual({case.id for case in cases}, {"case-001", "case-002", "case-003"})
        for case in cases:
            self.assertGreaterEqual(len(case.topics), 5)
            self.assertGreaterEqual(len(case.questions), 4)
            self.assertGreaterEqual(len(case.answers), 3)

    def test_localizes_question_answer_and_claim_text(self) -> None:
        case_path = SYNTHETIC_ROOT / "case-002" / "case.json"

        english_case = load_case_from_json(case_path, locale="en")
        polish_case = load_case_from_json(case_path, locale="pl")

        self.assertIn("late shift", english_case.questions[0].text)
        self.assertIn("Prosz", polish_case.questions[0].text)
        self.assertIn("service door", english_case.answers[0].claims[1].source_text)
        self.assertIn("Drzwi", polish_case.answers[0].claims[1].source_text)

    def test_loads_starter_materials_for_each_synthetic_case(self) -> None:
        expected_counts = {"case-001": 6, "case-002": 6, "case-003": 5}
        for case_id in ("case-001", "case-002", "case-003"):
            materials = load_synthetic_materials(
                SYNTHETIC_ROOT / case_id / "materials.json",
                locale="pl",
            )

            self.assertEqual(len(materials), expected_counts[case_id])
            self.assertTrue(all(material.id.startswith(case_id) for material in materials))
            self.assertTrue(all(material.content.strip() for material in materials))

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
