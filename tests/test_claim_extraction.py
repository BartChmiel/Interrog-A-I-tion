import unittest
from dataclasses import replace
from pathlib import Path

from interrogaition.analysis.claim_extraction import answer_with_extracted_claims
from interrogaition.analysis.interview_review import review_case
from interrogaition.domain.models import Answer
from interrogaition.storage.json_case_loader import load_case_from_json


ROOT = Path(__file__).resolve().parents[1]
CASE_003_PATH = ROOT / "data" / "synthetic" / "case-003" / "case.json"


class ClaimExtractionTest(unittest.TestCase):
    def test_extracts_time_and_access_claims_from_live_answer(self) -> None:
        case = replace(load_case_from_json(CASE_003_PATH), answers=())
        answer = answer_with_extracted_claims(
            case,
            Answer(
                id="live-answer-access-001",
                question_id="q-303",
                text=(
                    "The backup key was with the supervisor. "
                    "I also used my own key at 19:05."
                ),
                topic_ids=("topic-care-access",),
            ),
        )

        claims = {(claim.subject, claim.attribute, claim.value) for claim in answer.claims}

        self.assertIn(("missing_dose", "discovery_time", "19:05"), claims)
        self.assertIn(("medication_cabinet", "key_holder", "supervisor"), claims)
        self.assertIn(("medication_cabinet", "key_holder", "witness"), claims)

    def test_extracted_live_claims_feed_consistency_review(self) -> None:
        case = replace(load_case_from_json(CASE_003_PATH), answers=())
        first = answer_with_extracted_claims(
            case,
            Answer(
                id="live-answer-time-001",
                question_id="q-302",
                text="I first noticed the missing dose at 18:40.",
                topic_ids=("topic-care-chronology",),
            ),
        )
        second = answer_with_extracted_claims(
            case,
            Answer(
                id="live-answer-time-002",
                question_id="q-302",
                text="After checking the log, I think it was around 19:05.",
                topic_ids=("topic-care-chronology",),
            ),
        )

        review = review_case(replace(case, answers=(first, second)))
        conflicts = [finding for finding in review.findings if finding.category == "potential_inconsistency"]

        self.assertEqual(first.claims[0].value, "18:40")
        self.assertEqual(second.claims[0].value, "19:05")
        self.assertTrue(any(finding.metadata.get("attribute") == "discovery_time" for finding in conflicts))


if __name__ == "__main__":
    unittest.main()
