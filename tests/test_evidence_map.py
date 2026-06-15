import unittest
import uuid
from pathlib import Path

from interrogaition.analysis.credibility_indicators import generate_indicators
from interrogaition.analysis.evidence_map import TopicEvidenceStatus, build_evidence_map
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
TEST_OUTPUT_ROOT = ROOT / "backend" / "test-output" / "evidence-map"


class EvidenceMapTest(unittest.TestCase):
    def test_builds_topic_level_evidence_map(self) -> None:
        case = load_case_from_json(CASE_PATH, locale="en")
        registry = MaterialRegistry(
            CaseWorkspaceManager(_workspace_root("topic-map")).create_workspace(
                case_id=case.id,
                created_by="investigator-001",
            )
        )
        record = registry.register_text_material(
            material_id="recording-note-001",
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
        nodes = {node.topic_id: node for node in evidence_map.topic_nodes}

        self.assertEqual(evidence_map.summary.total_topics, 5)
        self.assertEqual(evidence_map.summary.total_materials, 1)
        self.assertEqual(nodes["topic-chronology"].status, TopicEvidenceStatus.CONTESTED)
        self.assertEqual(nodes["topic-location"].status, TopicEvidenceStatus.GROUNDED)
        self.assertEqual(nodes["topic-recording"].status, TopicEvidenceStatus.MATERIAL_ONLY)
        self.assertIn("recording-note-001", nodes["topic-recording"].material_ids)
        self.assertIn("q-001", nodes["topic-chronology"].question_ids)
        self.assertIn("a-001", nodes["topic-chronology"].answer_ids)
        self.assertIn("c-001", nodes["topic-chronology"].claim_ids)
        self.assertTrue(nodes["topic-chronology"].finding_ids)
        self.assertTrue(nodes["topic-chronology"].indicator_ids)


def _workspace_root(name: str) -> Path:
    root = TEST_OUTPUT_ROOT / f"{name}-{uuid.uuid4()}"
    root.mkdir(parents=True, exist_ok=True)
    return root


if __name__ == "__main__":
    unittest.main()
