import unittest
import uuid
from pathlib import Path

from interrogaition.ai.grounded_suggestion_service import generate_grounded_suggestions
from interrogaition.ai.model_client import DeterministicGroundedModelClient, FakeModelClient
from interrogaition.ai.response_parser import parse_suggestion_response
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
TEST_OUTPUT_ROOT = ROOT / "backend" / "test-output" / "grounded-suggestions"


class GroundedSuggestionServiceTest(unittest.TestCase):
    def test_generates_grounded_suggestions_with_hashes(self) -> None:
        pack = _grounding_pack()
        model = DeterministicGroundedModelClient()

        result = generate_grounded_suggestions(
            grounding_pack=pack,
            model_client=model,
            locale="en",
        )
        suggestion_types = {suggestion.suggestion_type for suggestion in result.batch.suggestions}

        self.assertIn("follow_up_question", suggestion_types)
        self.assertIn("potential_inconsistency", suggestion_types)
        self.assertIn("summary", suggestion_types)
        self.assertFalse(result.warnings)
        self.assertEqual(result.quality_report.state, "ready")
        self.assertEqual(result.quality_report.score, 100)
        self.assertEqual(len(result.context_hash), 64)
        self.assertEqual(len(result.output_hash), 64)
        self.assertIn("grounded_followup_questions", result.prompt_version)

    def test_warns_about_citations_outside_grounding_pack(self) -> None:
        pack = _grounding_pack()
        model = FakeModelClient(
            response_text="""
            {
              "suggestions": [
                {
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
            grounding_pack=pack,
            model_client=model,
            locale="en",
            citation_policy="warn",
        )

        self.assertEqual(len(result.warnings), 1)
        self.assertEqual(result.warnings[0].warning_type, "unknown_source_id")
        self.assertEqual(result.quality_report.state, "warning")
        self.assertIn("unknown_source_id", {issue.code for issue in result.quality_report.issues})


def _grounding_pack():
    case = load_case_from_json(CASE_PATH, locale="en")
    registry = MaterialRegistry(
        CaseWorkspaceManager(_workspace_root("pack")).create_workspace(
            case_id=case.id,
            created_by="investigator-001",
        )
    )
    record = registry.register_text_material(
        material_id="grounded-lead-001",
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
    return build_grounding_context_pack(
        case=case,
        evidence_map=evidence_map,
        materials=(record,),
        material_links=links,
        focus_question_id="q-001",
    )


def _workspace_root(name: str) -> Path:
    root = TEST_OUTPUT_ROOT / f"{name}-{uuid.uuid4()}"
    root.mkdir(parents=True, exist_ok=True)
    return root


if __name__ == "__main__":
    unittest.main()
