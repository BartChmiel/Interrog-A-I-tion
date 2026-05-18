"""Live interview review loop."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime

from interigaition.analysis.interview_review import InterviewReview, review_case
from interigaition.domain.models import Case
from interigaition.domain.session import InterviewSession, merge_session_answers


def utc_now() -> datetime:
    return datetime.now(UTC)


@dataclass(frozen=True)
class LiveReviewSnapshot:
    session_id: str
    case_id: str
    sequence_no: int
    review: InterviewReview
    generated_at: datetime = field(default_factory=utc_now)


def review_live_session(case: Case, session: InterviewSession) -> LiveReviewSnapshot:
    """Run deterministic review for current live-session state."""

    case_view = merge_session_answers(case, session)
    review = review_case(case_view)

    return LiveReviewSnapshot(
        session_id=session.id,
        case_id=case.id,
        sequence_no=len(session.events),
        review=review,
    )
