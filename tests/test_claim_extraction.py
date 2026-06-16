import unittest
from dataclasses import replace
from pathlib import Path

from interrogaition.analysis.claim_extraction import (
    answer_with_extracted_claims,
    calculate_claim_extraction_hash,
)
from interrogaition.analysis.interview_review import review_case
from interrogaition.domain.models import Answer, ClaimReviewStatus
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
        self.assertTrue(
            all(claim.review_status == ClaimReviewStatus.PENDING for claim in answer.claims)
        )
        time_claim = next(claim for claim in answer.claims if claim.value == "19:05")
        self.assertEqual(time_claim.extraction_rule, "time-expression.v1")
        self.assertEqual(len(time_claim.extraction_hash), 64)
        self.assertEqual(
            time_claim.extraction_hash,
            calculate_claim_extraction_hash(
                case_id=case.id,
                question_id=answer.question_id,
                answer_id=answer.id,
                answer_text=answer.text,
                extraction_rule=time_claim.extraction_rule,
                subject=time_claim.subject,
                attribute=time_claim.attribute,
                value=time_claim.value,
                source_text=time_claim.source_text,
                confidence=time_claim.confidence,
                source_start=time_claim.source_start,
                source_end=time_claim.source_end,
            ),
        )
        self.assertEqual(time_claim.confidence, 0.86)
        self.assertEqual(
            answer.text[time_claim.source_start:time_claim.source_end],
            "19:05",
        )
        key_claim = next(
            claim
            for claim in answer.claims
            if claim.attribute == "key_holder" and claim.value == "witness"
        )
        self.assertEqual(key_claim.extraction_rule, "medication-cabinet-key-holder.v1")
        self.assertEqual(key_claim.confidence, 0.78)
        self.assertEqual(
            answer.text[key_claim.source_start:key_claim.source_end],
            "own key",
        )

        repeated = answer_with_extracted_claims(
            case,
            replace(answer, claims=()),
        )
        self.assertEqual(
            [claim.extraction_hash for claim in answer.claims],
            [claim.extraction_hash for claim in repeated.claims],
        )

    def test_pending_live_claims_wait_for_operator_review(self) -> None:
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

        self.assertFalse(
            any(finding.metadata.get("attribute") == "discovery_time" for finding in conflicts)
        )

    def test_accepted_live_claims_feed_consistency_review(self) -> None:
        case = replace(load_case_from_json(CASE_003_PATH), answers=())
        first = _with_reviewed_claims(
            answer_with_extracted_claims(
                case,
                Answer(
                    id="live-answer-time-001",
                    question_id="q-302",
                    text="I first noticed the missing dose at 18:40.",
                    topic_ids=("topic-care-chronology",),
                ),
            )
        )
        second = _with_reviewed_claims(
            answer_with_extracted_claims(
                case,
                Answer(
                    id="live-answer-time-002",
                    question_id="q-302",
                    text="After checking the log, I think it was around 19:05.",
                    topic_ids=("topic-care-chronology",),
                ),
            )
        )

        review = review_case(replace(case, answers=(first, second)))
        conflicts = [finding for finding in review.findings if finding.category == "potential_inconsistency"]

        self.assertEqual(first.claims[0].value, "18:40")
        self.assertEqual(second.claims[0].value, "19:05")
        self.assertTrue(any(finding.metadata.get("attribute") == "discovery_time" for finding in conflicts))


def _with_reviewed_claims(answer: Answer) -> Answer:
    return replace(
        answer,
        claims=tuple(
            replace(claim, review_status=ClaimReviewStatus.ACCEPTED)
            for claim in answer.claims
        ),
    )


if __name__ == "__main__":
    unittest.main()
