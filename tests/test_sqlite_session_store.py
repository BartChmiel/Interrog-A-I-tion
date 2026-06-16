import sqlite3
import unittest
import uuid
from pathlib import Path

from interrogaition.domain.models import Actor, Answer, Claim
from interrogaition.domain.session import ParticipantRole, add_answer, start_interview_session
from interrogaition.storage.sqlite_session_store import SQLiteSessionStore


TEST_OUTPUT_ROOT = Path(__file__).resolve().parents[1] / "backend" / "test-output" / "sqlite"


class SQLiteSessionStoreTest(unittest.TestCase):
    def test_persists_session_answers_and_audit_chain(self) -> None:
        database_path = _database_path("sessions")
        store = SQLiteSessionStore(database_path)
        session = start_interview_session(
            session_id="sqlite-session-001",
            case_id="case-001",
            participant_id="person-001",
            initial_role=ParticipantRole.WITNESS,
        )
        store.create_session(session)
        store.append_audit_event(
            actor=Actor.SYSTEM,
            action="session_started",
            object_type="session",
            object_id=session.id,
            details={"case_id": session.case_id},
        )

        updated = add_answer(
            session,
            answer=Answer(
                id="sqlite-answer-001",
                question_id="q-001",
                text="I saw a person near the bicycle stand.",
                topic_ids=("topic-location",),
                claims=(
                    Claim(
                        id="sqlite-claim-001",
                        subject="event",
                        attribute="location",
                        value="bicycle stand",
                        source_text="I saw a person near the bicycle stand.",
                        extraction_rule="manual-test-rule.v1",
                        extraction_hash="a" * 64,
                        confidence=0.91,
                        source_start=20,
                        source_end=33,
                    ),
                ),
            ),
            event_id="sqlite-event-answer-001",
        )
        store.save_session(updated)
        store.append_audit_event(
            actor=Actor.HUMAN,
            action="answer_added",
            object_type="answer",
            object_id="sqlite-answer-001",
            details={"session_id": session.id},
        )

        self.assertTrue(store.verify_audit_chain())
        store.close()

        reopened = SQLiteSessionStore(database_path)
        loaded = reopened.get_session("sqlite-session-001")
        self.assertIsNotNone(loaded)
        assert loaded is not None
        self.assertEqual(loaded.id, "sqlite-session-001")
        self.assertEqual(len(loaded.answers), 1)
        loaded_claim = loaded.answers[0].claims[0]
        self.assertEqual(loaded_claim.value, "bicycle stand")
        self.assertEqual(loaded_claim.extraction_rule, "manual-test-rule.v1")
        self.assertEqual(loaded_claim.extraction_hash, "a" * 64)
        self.assertEqual(loaded_claim.confidence, 0.91)
        self.assertEqual(loaded_claim.source_start, 20)
        self.assertEqual(loaded_claim.source_end, 33)
        self.assertEqual(len(loaded.events), 2)

        audit_events = reopened.list_audit_events()
        self.assertEqual(len(audit_events), 2)
        self.assertIsNone(audit_events[0].previous_hash)
        self.assertEqual(audit_events[1].previous_hash, audit_events[0].event_hash)
        self.assertTrue(reopened.verify_audit_chain())
        reopened.close()

    def test_audit_log_is_append_only(self) -> None:
        database_path = _database_path("audit")
        store = SQLiteSessionStore(database_path)
        store.append_audit_event(
            actor=Actor.SYSTEM,
            action="session_started",
            object_type="session",
            object_id="session-001",
        )
        store.close()

        connection = sqlite3.connect(database_path)
        with connection:
            with self.assertRaises(sqlite3.IntegrityError):
                connection.execute(
                    "UPDATE audit_events SET action = ? WHERE sequence = 1",
                    ("tampered",),
                )
            with self.assertRaises(sqlite3.IntegrityError):
                connection.execute("DELETE FROM audit_events WHERE sequence = 1")
        connection.close()


def _database_path(name: str) -> Path:
    TEST_OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    return TEST_OUTPUT_ROOT / f"{name}-{uuid.uuid4()}.sqlite3"


if __name__ == "__main__":
    unittest.main()
