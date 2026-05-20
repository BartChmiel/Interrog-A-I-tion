import unittest

from interigaition.api.app import AddAnswerRequest, HTTPException, StartSessionRequest, create_app
from interigaition.domain.session import ParticipantRole


def endpoint(app, name: str):
    for route in app.routes:
        if getattr(route, "name", None) == name:
            return route.endpoint

    raise AssertionError(f"Endpoint not found: {name}")


class ApiAppTest(unittest.TestCase):
    def test_health_and_locales(self) -> None:
        app = create_app()

        self.assertEqual(endpoint(app, "health")(), {"status": "ok"})
        self.assertEqual(endpoint(app, "locales")(), {"locales": ["en", "pl"]})

    def test_case_review_endpoint_returns_indicators_and_report(self) -> None:
        app = create_app()
        response = endpoint(app, "review_case_endpoint")("case-001", locale="en")

        self.assertEqual(response["case"]["id"], "case-001")
        self.assertIn("review", response)
        self.assertIn("indicators", response)
        self.assertIn("Decision-support indicators", response["report_markdown"])

    def test_session_endpoint_flow(self) -> None:
        app = create_app()
        start = endpoint(app, "start_session")
        add_answer = endpoint(app, "add_session_answer")
        review_session = endpoint(app, "review_session_endpoint")

        session = start(
            StartSessionRequest(
                session_id="api-session-001",
                case_id="case-001",
                participant_id="person-001",
                initial_role=ParticipantRole.WITNESS,
            )
        )

        self.assertEqual(session["id"], "api-session-001")
        self.assertEqual(session["role_history"][0]["role"], "witness")

        updated = add_answer(
            "api-session-001",
            AddAnswerRequest(
                id="api-answer-001",
                question_id="q-001",
                text="I saw the person near the bicycle stand.",
                topic_ids=["topic-location"],
                event_id="api-event-answer-001",
            ),
        )

        self.assertEqual(len(updated["answers"]), 1)
        self.assertEqual(updated["events"][-1]["event_type"], "answer_added")

        review = review_session("api-session-001", locale="en")

        self.assertEqual(review["session"]["id"], "api-session-001")
        self.assertEqual(review["snapshot"]["session_id"], "api-session-001")
        self.assertEqual(review["snapshot"]["sequence_no"], 2)
        self.assertIn("review", review["snapshot"])
        self.assertIn("indicators", review)
        self.assertIn("Decision-support indicators", review["report_markdown"])

        audit = endpoint(app, "get_session_audit")("api-session-001")

        self.assertTrue(audit["chain_valid"])
        self.assertEqual(audit["session_id"], "api-session-001")
        self.assertEqual(
            [event["action"] for event in audit["events"]],
            ["session_started", "answer_added", "review_refreshed"],
        )

    def test_start_session_rejects_duplicate_session_id(self) -> None:
        app = create_app()
        start = endpoint(app, "start_session")
        request = StartSessionRequest(
            session_id="api-session-duplicate",
            case_id="case-001",
            participant_id="person-001",
            initial_role=ParticipantRole.WITNESS,
        )

        start(request)
        other = start(
            StartSessionRequest(
                session_id="api-session-other",
                case_id="case-001",
                participant_id="person-001",
                initial_role=ParticipantRole.WITNESS,
            )
        )

        self.assertEqual(other["id"], "api-session-other")

        with self.assertRaises(HTTPException) as caught:
            start(request)

        self.assertEqual(caught.exception.status_code, 409)

    def test_add_session_answer_validates_payload(self) -> None:
        app = create_app()
        start = endpoint(app, "start_session")
        add_answer = endpoint(app, "add_session_answer")
        start(
            StartSessionRequest(
                session_id="api-session-validation",
                case_id="case-001",
                participant_id="person-001",
                initial_role=ParticipantRole.WITNESS,
            )
        )

        cases = [
            AddAnswerRequest(
                id="api-answer-empty",
                question_id="q-001",
                text="   ",
                event_id="api-event-empty",
            ),
            AddAnswerRequest(
                id="api-answer-unknown-question",
                question_id="q-999",
                text="Answer text.",
                event_id="api-event-unknown-question",
            ),
            AddAnswerRequest(
                id="api-answer-unknown-topic",
                question_id="q-001",
                text="Answer text.",
                topic_ids=["topic-unknown"],
                event_id="api-event-unknown-topic",
            ),
            AddAnswerRequest(
                id="api-answer-bad-claim",
                question_id="q-001",
                text="Answer text.",
                event_id="api-event-bad-claim",
                claims=[{"id": "claim-001", "subject": "event"}],
            ),
        ]

        for request in cases:
            with self.subTest(request=request.id):
                with self.assertRaises(HTTPException) as caught:
                    add_answer("api-session-validation", request)

                self.assertEqual(caught.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
