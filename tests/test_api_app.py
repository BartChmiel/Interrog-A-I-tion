import unittest

from interigaition.api.app import AddAnswerRequest, StartSessionRequest, create_app
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


if __name__ == "__main__":
    unittest.main()

