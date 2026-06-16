import unittest
from datetime import UTC, datetime

from interrogaition.analysis.claim_provenance import verify_session_claim_provenance
from interrogaition.domain.models import Actor, Answer, AuditEvent, Claim, ClaimReviewStatus
from interrogaition.domain.session import InterviewSession, ParticipantRole, RoleAssignment


class ClaimProvenanceTest(unittest.TestCase):
    def test_flags_missing_trace_and_hash_mismatch(self) -> None:
        traced_claim = _claim(claim_id="claim-traced", extraction_hash="a" * 64)
        missing_claim = _claim(claim_id="claim-missing", extraction_hash="c" * 64)
        session = _session_with_claims(traced_claim, missing_claim)
        event = _answer_added_event(
            {
                **_snapshot_for_claim(traced_claim),
                "extraction_hash": "b" * 64,
            }
        )

        report = verify_session_claim_provenance(
            session=session,
            audit_events=(event,),
            chain_valid=True,
        )

        self.assertEqual(report.extracted_claim_count, 2)
        self.assertEqual(report.verified_claim_count, 0)
        self.assertEqual(report.issue_count, 2)
        self.assertEqual(
            {issue.code for issue in report.issues},
            {"extraction_hash_mismatch", "missing_audit_trace"},
        )

    def test_allows_edited_claim_content_to_preserve_original_trace(self) -> None:
        edited_claim = _claim(
            claim_id="claim-edited",
            value="19:50",
            extraction_hash="d" * 64,
            review_status=ClaimReviewStatus.EDITED,
        )
        session = _session_with_claims(edited_claim)
        event = _answer_added_event(
            {
                **_snapshot_for_claim(edited_claim),
                "value": "19:45",
                "source_text": "At 19:45 I saw the person near the stand.",
            }
        )

        report = verify_session_claim_provenance(
            session=session,
            audit_events=(event,),
            chain_valid=True,
        )

        self.assertEqual(report.extracted_claim_count, 1)
        self.assertEqual(report.verified_claim_count, 1)
        self.assertEqual(report.issue_count, 0)
        self.assertTrue(report.records[0].valid)


def _session_with_claims(*claims: Claim) -> InterviewSession:
    return InterviewSession(
        id="session-001",
        case_id="case-001",
        participant_id="person-001",
        role_history=(
            RoleAssignment(
                participant_id="person-001",
                role=ParticipantRole.WITNESS,
            ),
        ),
        answers=(
            Answer(
                id="answer-001",
                question_id="q-001",
                text="At 19:45 I saw the person near the stand.",
                claims=claims,
            ),
        ),
    )


def _claim(
    *,
    claim_id: str,
    extraction_hash: str,
    value: str = "19:45",
    review_status: ClaimReviewStatus = ClaimReviewStatus.PENDING,
) -> Claim:
    return Claim(
        id=claim_id,
        subject="event",
        attribute="time",
        value=value,
        source_text="At 19:45 I saw the person near the stand.",
        review_status=review_status,
        extraction_rule="time-expression.v1",
        extraction_hash=extraction_hash,
        confidence=0.86,
        source_start=3,
        source_end=8,
    )


def _snapshot_for_claim(claim: Claim) -> dict[str, object]:
    return {
        "id": claim.id,
        "subject": claim.subject,
        "attribute": claim.attribute,
        "value": claim.value,
        "source_text": claim.source_text,
        "review_status": claim.review_status.value,
        "extraction_rule": claim.extraction_rule,
        "extraction_hash": claim.extraction_hash,
        "confidence": claim.confidence,
        "source_start": claim.source_start,
        "source_end": claim.source_end,
    }


def _answer_added_event(*snapshots: dict[str, object]) -> AuditEvent:
    return AuditEvent(
        id="audit-001",
        timestamp=datetime(2026, 1, 1, tzinfo=UTC),
        actor=Actor.HUMAN,
        action="answer_added",
        object_type="answer",
        object_id="answer-001",
        details={"extraction_trace": list(snapshots)},
        event_hash="e" * 64,
    )
