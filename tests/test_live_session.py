import unittest
from dataclasses import replace
from pathlib import Path

from interigaition.analysis.live_review import review_live_session
from interigaition.domain.models import Actor, Answer, Claim
from interigaition.domain.session import (
    LiveNote,
    ParticipantRole,
    add_answer,
    add_note,
    change_participant_role,
    select_question,
    start_interview_session,
)
from interigaition.storage.json_case_loader import load_case_from_json


ROOT = Path(__file__).resolve().parents[1]
CASE_PATH = ROOT / "data" / "synthetic" / "case-001" / "case.json"


class LiveSessionTest(unittest.TestCase):
    def test_role_changes_are_preserved(self) -> None:
        session = start_interview_session(
            session_id="session-001",
            case_id="case-001",
            participant_id="person-001",
            initial_role=ParticipantRole.WITNESS,
        )

        changed = change_participant_role(
            session,
            new_role=ParticipantRole.SUSPECT,
            event_id="event-role-change-001",
            reason="New evidence changed procedural status.",
        )

        self.assertEqual(session.current_role, ParticipantRole.WITNESS)
        self.assertEqual(changed.current_role, ParticipantRole.SUSPECT)
        self.assertEqual(
            [assignment.role for assignment in changed.role_history],
            [ParticipantRole.WITNESS, ParticipantRole.SUSPECT],
        )
        self.assertEqual(changed.events[-1].details["new_role"], "suspect")

    def test_live_notes_and_current_question_are_tracked(self) -> None:
        session = start_interview_session(
            session_id="session-001",
            case_id="case-001",
            participant_id="person-001",
            initial_role=ParticipantRole.WITNESS,
        )

        session = select_question(session, question_id="q-001", event_id="event-question-001")
        session = add_note(
            session,
            note=LiveNote(
                id="note-001",
                actor=Actor.HUMAN,
                text="Participant hesitated before answering the timeline question.",
                linked_question_id="q-001",
                topic_ids=("topic-chronology",),
            ),
            event_id="event-note-001",
        )

        self.assertEqual(session.current_question_id, "q-001")
        self.assertEqual(session.notes[0].linked_question_id, "q-001")
        self.assertEqual(session.events[-1].event_type, "note_added")

    def test_live_review_updates_after_new_answer(self) -> None:
        base_case = load_case_from_json(CASE_PATH)
        case_without_answers = replace(base_case, answers=())
        session = start_interview_session(
            session_id="session-001",
            case_id=case_without_answers.id,
            participant_id="person-001",
            initial_role=ParticipantRole.WITNESS,
        )

        first_review = review_live_session(case_without_answers, session)
        self.assertIn("topic-recording", first_review.review.missing_topic_ids)

        session = add_answer(
            session,
            answer=Answer(
                id="live-answer-001",
                question_id="q-live-recording",
                text="There may be a camera near the library entrance.",
                topic_ids=("topic-recording",),
                claims=(
                    Claim(
                        id="live-claim-001",
                        subject="case",
                        attribute="potential_recording",
                        value="library entrance camera",
                        source_text="There may be a camera near the library entrance.",
                    ),
                ),
            ),
            event_id="event-answer-001",
        )

        second_review = review_live_session(case_without_answers, session)
        self.assertNotIn("topic-recording", second_review.review.missing_topic_ids)
        self.assertGreater(second_review.sequence_no, first_review.sequence_no)


if __name__ == "__main__":
    unittest.main()
