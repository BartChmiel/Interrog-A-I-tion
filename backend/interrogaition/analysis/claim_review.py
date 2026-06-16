"""Claim review status helpers for analysis code."""

from __future__ import annotations

from interrogaition.domain.models import Claim, ClaimReviewStatus


ANALYSIS_READY_CLAIM_STATUSES = {
    ClaimReviewStatus.ACCEPTED,
    ClaimReviewStatus.EDITED,
}


def is_claim_analysis_ready(claim: Claim) -> bool:
    """Return whether a structured claim may influence deterministic analysis."""

    return claim.review_status in ANALYSIS_READY_CLAIM_STATUSES
