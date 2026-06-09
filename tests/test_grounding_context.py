import unittest
import uuid
from pathlib import Path

from interrogaition.analysis.credibility_indicators import generate_indicators
from interrogaition.analysis.evidence_map import build_evidence_map
from interrogaition.analysis.grounding_context import build_grounding_context_pack
from interrogaition.analysis.interview_review import review_case
from interrogaition.analysis.material_grounding import (
    MaterialText,
    infer_material_topic_signals,
    link_materials_to_questions,
)
from interrogaition.security.case_workspace import CaseWorkspaceManager
from interrogaition.storage.json_case_loader import load_case_from_json
from interrogaition.storage.material_registry import MaterialRegistry


ROOT = Path(__file__).resolve().parents[1]
CASE_PATH = ROOT / "data" / "synthetic" / "case-001" / "case.json"
TEST_OUTPUT_ROOT = ROOT / "backend" / "test-output" / "grounding-context"


class GroundingContextTest(unittest.TestCase):
    def test_builds_bounded_grounding_pack_for_focus_question(self) -> None:
        case = load_case_from_json(CASE_PATH, locale="en")
        registry = MaterialRegistry(
            CaseWorkspaceManager(_workspace_root("pack")).create_workspace(
                case_id=case.id,
                created_by="investigator-001",
            )
        )
        record = registry.register_text_material(
            material_id="recording-lead-001",
            title="Recording lead",
            content="Biblioteka moze miec monitoring i nagranie z kamery przy wejsciu.",
            created_by="investigator-001",
            tags=("camera", "recording"),
        )
        material_texts = (MaterialText(record=record, text=registry.read_material_text(record.id)),)
        review = review_case(case)
        indicators = generate_indicators(case, review)
        links = link_materials_to_questions(case, material_texts)
        signals = tuple(
            signal
            for material_text in material_texts
            for signal in infer_material_topic_signals(case.topics, material_text)
        )
        evidence_map = build_evidence_map(
            case=case,
            review=review,
            indicators=indicators,
            materials=(record,),
            material_links=links,
            material_topic_signals=signals,
        )

        pack = build_grounding_context_pack(
            case=case,
            evidence_map=evidence_map,
            materials=(record,),
            material_links=links,
            focus_question_id="q-001",
        )
        rule_ids = {rule.id for rule in pack.rules}
        topic_ids = {topic.topic_id for topic in pack.topic_contexts}
        material = next(reference for reference in pack.material_references if reference.material_id == record.id)

        self.assertEqual(pack.task, "suggest_grounded_followup_questions")
        self.assertEqual(pack.focus_question_id, "q-001")
        self.assertTrue(pack.operator_review_required)
        self.assertIn("no-truthfulness-verdict", rule_ids)
        self.assertIn("cite-source-ids", rule_ids)
        self.assertIn("q-001", pack.allowed_source_ids)
        self.assertIn("topic-recording", topic_ids)
        self.assertIn("topic-recording", material.topic_ids)


def _workspace_root(name: str) -> Path:
    root = TEST_OUTPUT_ROOT / f"{name}-{uuid.uuid4()}"
    root.mkdir(parents=True, exist_ok=True)
    return root


if __name__ == "__main__":
    unittest.main()
