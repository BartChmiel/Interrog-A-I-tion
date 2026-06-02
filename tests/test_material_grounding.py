import unittest
import uuid
from pathlib import Path

from interrogaition.analysis.material_grounding import (
    MaterialText,
    infer_material_topic_signals,
    link_materials_to_questions,
)
from interrogaition.security.case_workspace import CaseWorkspaceManager
from interrogaition.storage.json_case_loader import load_case_from_json
from interrogaition.storage.material_registry import MaterialRegistry, MaterialSourceType


ROOT = Path(__file__).resolve().parents[1]
CASE_PATH = ROOT / "data" / "synthetic" / "case-001" / "case.json"
TEST_OUTPUT_ROOT = ROOT / "backend" / "test-output" / "material-grounding"


class MaterialGroundingTest(unittest.TestCase):
    def test_links_registered_materials_to_questions_by_topic_signals(self) -> None:
        case = load_case_from_json(CASE_PATH, locale="en")
        registry = MaterialRegistry(
            CaseWorkspaceManager(_workspace_root("links")).create_workspace(
                case_id=case.id,
                created_by="investigator-001",
            )
        )
        record = registry.register_text_material(
            material_id="grounding-001",
            title="Witness note near library",
            content=(
                "Swiadek widzial osobe przy stojaku rowerowym przed biblioteka "
                "okolo 19:45. Opisuje, ze byla to ciemna kurtka."
            ),
            created_by="investigator-001",
            source_type=MaterialSourceType.CASE_PROTOCOL,
            tags=("witness", "library", "19:45"),
        )
        material_text = MaterialText(record=record, text=registry.read_material_text(record.id))

        links = link_materials_to_questions(case, (material_text,))
        linked_question_ids = {link.question_id for link in links}
        q001_link = next(link for link in links if link.question_id == "q-001")

        self.assertIn("q-001", linked_question_ids)
        self.assertIn("q-002", linked_question_ids)
        self.assertIn("q-003", linked_question_ids)
        self.assertIn("q-004", linked_question_ids)
        self.assertIn("topic-location", q001_link.topic_ids)
        self.assertIn("topic-person", q001_link.topic_ids)
        self.assertGreaterEqual(q001_link.confidence, 0.7)

    def test_infers_recording_topic_signal_without_question_link(self) -> None:
        case = load_case_from_json(CASE_PATH, locale="en")
        registry = MaterialRegistry(
            CaseWorkspaceManager(_workspace_root("recording")).create_workspace(
                case_id=case.id,
                created_by="investigator-001",
            )
        )
        record = registry.register_text_material(
            material_id="recording-001",
            title="Monitoring note",
            content="Biblioteka moze miec monitoring i nagranie z kamery przy wejsciu.",
            created_by="investigator-001",
        )
        material_text = MaterialText(record=record, text=registry.read_material_text(record.id))

        signals = infer_material_topic_signals(case.topics, material_text)
        links = link_materials_to_questions(case, (material_text,))

        self.assertIn("topic-recording", {signal.topic_id for signal in signals})
        self.assertNotIn("topic-recording", {topic_id for link in links for topic_id in link.topic_ids})


def _workspace_root(name: str) -> Path:
    root = TEST_OUTPUT_ROOT / f"{name}-{uuid.uuid4()}"
    root.mkdir(parents=True, exist_ok=True)
    return root


if __name__ == "__main__":
    unittest.main()
