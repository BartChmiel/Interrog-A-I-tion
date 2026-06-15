import unittest
import uuid
from pathlib import Path

from interrogaition.analysis.evidence_alignment import AlignmentBand, build_evidence_alignment
from interrogaition.analysis.material_grounding import MaterialText, link_materials_to_questions
from interrogaition.analysis.material_link_decisions import derive_material_link_decisions
from interrogaition.domain.models import Actor
from interrogaition.security.case_workspace import CaseWorkspaceManager
from interrogaition.storage.json_case_loader import load_case_from_json
from interrogaition.storage.material_registry import MaterialRegistry
from interrogaition.storage.session_store import SessionStore
from interrogaition.storage.sqlite_session_store import SQLiteSessionStore

ROOT = Path(__file__).resolve().parents[1]
CASE_PATH = ROOT / "data" / "synthetic" / "case-001" / "case.json"
TEST_OUTPUT_ROOT = ROOT / "backend" / "test-output" / "evidence-alignment"

# Material text that shares location, chronology, person, and source signals with
# the synthetic case questions, so several material-question links are proposed.
_MATERIAL_CONTENT = (
    "Swiadek widzial mezczyzne w ciemnej kurtce przy stojaku na rowery obok "
    "biblioteki o 19:45."
)


class EvidenceAlignmentTest(unittest.TestCase):
    def setUp(self) -> None:
        self.case = load_case_from_json(CASE_PATH, locale="en")
        workspace = CaseWorkspaceManager(_workspace_root("alignment")).create_workspace(
            case_id=self.case.id,
            created_by="investigator-001",
        )
        registry = MaterialRegistry(workspace)
        self.material = registry.register_text_material(
            material_id="alignment-material-001",
            title="Witness observation",
            content=_MATERIAL_CONTENT,
            created_by="investigator-001",
            tags=("witness", "location"),
        )
        material_texts = (
            MaterialText(record=self.material, text=registry.read_material_text(self.material.id)),
        )
        self.proposed_links = link_materials_to_questions(self.case, material_texts)
        self.assertTrue(self.proposed_links, "expected proposed material-question links")

    def test_no_reviewed_links_yields_insufficient_review(self) -> None:
        decisions = derive_material_link_decisions(())
        alignment = build_evidence_alignment(
            case=self.case,
            proposed_links=self.proposed_links,
            decisions=decisions,
        )

        self.assertEqual(alignment.band, AlignmentBand.INSUFFICIENT_REVIEW)
        self.assertIsNone(alignment.score)
        self.assertEqual(alignment.confidence, 0.0)
        self.assertEqual(alignment.reviewed_links, 0)
        self.assertGreater(alignment.total_proposed_links, 0)

    def test_accepted_links_increase_alignment(self) -> None:
        single_topic_link = self._link_for_unique_topic()
        store = self._new_store()

        self._record_decision(store, single_topic_link, "accepted")
        one_accepted = build_evidence_alignment(
            case=self.case,
            proposed_links=self.proposed_links,
            decisions=derive_material_link_decisions(store.list_audit_events()),
        )

        second_link = self._link_supporting_new_topic(one_accepted)
        self._record_decision(store, second_link, "accepted")
        two_accepted = build_evidence_alignment(
            case=self.case,
            proposed_links=self.proposed_links,
            decisions=derive_material_link_decisions(store.list_audit_events()),
        )

        self.assertIsNotNone(one_accepted.score)
        self.assertIsNotNone(two_accepted.score)
        self.assertGreater(two_accepted.supported_topics, one_accepted.supported_topics)
        self.assertGreater(two_accepted.score, one_accepted.score)
        self.assertTrue(store.verify_audit_chain())

    def test_rejected_links_do_not_count_as_support(self) -> None:
        link = self.proposed_links[0]
        store = self._new_store()

        self._record_decision(store, link, "rejected")
        rejected = build_evidence_alignment(
            case=self.case,
            proposed_links=self.proposed_links,
            decisions=derive_material_link_decisions(store.list_audit_events()),
        )

        self.assertEqual(rejected.accepted_links, 0)
        self.assertEqual(rejected.supported_topics, 0)
        self.assertEqual(rejected.score, 0.0)
        for node in rejected.topic_nodes:
            self.assertFalse(node.supported)
        # Rejections lower confidence relative to a full acceptance of the same link.
        accept_store = self._new_store()
        self._record_decision(accept_store, link, "accepted")
        accepted = build_evidence_alignment(
            case=self.case,
            proposed_links=self.proposed_links,
            decisions=derive_material_link_decisions(accept_store.list_audit_events()),
        )
        self.assertGreater(accepted.confidence, rejected.confidence)
        self.assertGreater(accepted.supported_topics, rejected.supported_topics)

    def test_latest_decision_wins_and_chain_stays_valid(self) -> None:
        link = self.proposed_links[0]
        store = self._new_store()

        self._record_decision(store, link, "accepted")
        self._record_decision(store, link, "rejected")
        decisions = derive_material_link_decisions(store.list_audit_events())

        latest = decisions.decision_for(link.material_id, link.question_id)
        self.assertIsNotNone(latest)
        self.assertTrue(latest.rejected)
        self.assertEqual(len(decisions.decisions), 1)
        self.assertTrue(store.verify_audit_chain())

    def _link_for_unique_topic(self):
        for link in self.proposed_links:
            if len(link.topic_ids) == 1:
                return link
        return self.proposed_links[0]

    def _link_supporting_new_topic(self, alignment):
        supported = {
            node.topic_id for node in alignment.topic_nodes if node.supported
        }
        for link in self.proposed_links:
            if any(topic_id not in supported for topic_id in link.topic_ids):
                return link
        return self.proposed_links[-1]

    def _record_decision(self, store: SessionStore, link, decision: str) -> None:
        store.append_audit_event(
            actor=Actor.HUMAN,
            action=f"material_question_link_{decision}",
            object_type="material_question_link",
            object_id=f"{link.material_id}:{link.question_id}",
            details={
                "workspace_id": "workspace-alignment",
                "case_id": self.case.id,
                "material_id": link.material_id,
                "question_id": link.question_id,
                "decision": decision,
                "actor_id": "investigator-001",
                "topic_ids": list(link.topic_ids),
                "matched_terms": list(link.matched_terms),
                "confidence": link.confidence,
                "rationale": link.rationale,
            },
        )

    def _new_store(self) -> SQLiteSessionStore:
        return SQLiteSessionStore(_database_path())


def _workspace_root(name: str) -> Path:
    root = TEST_OUTPUT_ROOT / f"{name}-{uuid.uuid4()}"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _database_path() -> Path:
    TEST_OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    return TEST_OUTPUT_ROOT / f"audit-{uuid.uuid4()}.sqlite3"


if __name__ == "__main__":
    unittest.main()
