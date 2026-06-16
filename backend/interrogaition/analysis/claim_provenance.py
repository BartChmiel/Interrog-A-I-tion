"""Verification helpers for auditable claim extraction provenance."""

from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Any

from interrogaition.domain.models import AuditEvent, Claim, ClaimReviewStatus
from interrogaition.domain.session import InterviewSession


_SHA256_RE = re.compile(r"^[0-9a-f]{64}$")


@dataclass(frozen=True)
class ClaimProvenanceIssue:
    answer_id: str
    claim_id: str
    code: str
    severity: str
    message: str
    audit_event_id: str = ""


@dataclass(frozen=True)
class ClaimProvenanceRecord:
    answer_id: str
    claim_id: str
    review_status: ClaimReviewStatus
    extraction_rule: str
    extraction_hash: str
    audit_event_id: str | None
    audit_event_hash: str | None
    valid: bool


@dataclass(frozen=True)
class ClaimProvenanceReport:
    session_id: str
    case_id: str
    claim_count: int
    extracted_claim_count: int
    verified_claim_count: int
    issue_count: int
    chain_valid: bool
    records: tuple[ClaimProvenanceRecord, ...]
    issues: tuple[ClaimProvenanceIssue, ...]


@dataclass(frozen=True)
class _TraceSnapshot:
    answer_id: str
    claim_id: str
    audit_event_id: str
    audit_event_hash: str | None
    snapshot: dict[str, Any]


def verify_session_claim_provenance(
    *,
    session: InterviewSession,
    audit_events: tuple[AuditEvent, ...],
    chain_valid: bool,
) -> ClaimProvenanceReport:
    """Compare extracted session claims with their answer audit trace snapshots."""

    trace_by_claim = _extraction_trace_by_claim(audit_events)
    records: list[ClaimProvenanceRecord] = []
    issues: list[ClaimProvenanceIssue] = []
    claim_count = 0
    extracted_claim_count = 0
    verified_claim_count = 0

    if not chain_valid:
        issues.append(
            ClaimProvenanceIssue(
                answer_id="",
                claim_id="",
                code="audit_chain_invalid",
                severity="error",
                message="Audit chain verification failed for the current store.",
            )
        )

    for answer in session.answers:
        claim_count += len(answer.claims)
        for claim in answer.claims:
            if not _has_extraction_trace(claim):
                continue

            extracted_claim_count += 1
            trace = trace_by_claim.get((answer.id, claim.id))
            claim_issues = _claim_provenance_issues(answer.id, claim, trace)
            issues.extend(claim_issues)
            valid = chain_valid and not claim_issues
            if valid:
                verified_claim_count += 1
            records.append(
                ClaimProvenanceRecord(
                    answer_id=answer.id,
                    claim_id=claim.id,
                    review_status=claim.review_status,
                    extraction_rule=claim.extraction_rule,
                    extraction_hash=claim.extraction_hash,
                    audit_event_id=trace.audit_event_id if trace else None,
                    audit_event_hash=trace.audit_event_hash if trace else None,
                    valid=valid,
                )
            )

    return ClaimProvenanceReport(
        session_id=session.id,
        case_id=session.case_id,
        claim_count=claim_count,
        extracted_claim_count=extracted_claim_count,
        verified_claim_count=verified_claim_count,
        issue_count=len(issues),
        chain_valid=chain_valid,
        records=tuple(records),
        issues=tuple(issues),
    )


def _has_extraction_trace(claim: Claim) -> bool:
    return bool(claim.extraction_hash or claim.extraction_rule)


def _extraction_trace_by_claim(
    audit_events: tuple[AuditEvent, ...],
) -> dict[tuple[str, str], _TraceSnapshot]:
    traces: dict[tuple[str, str], _TraceSnapshot] = {}
    for event in audit_events:
        if event.action != "answer_added":
            continue
        raw_trace = event.details.get("extraction_trace")
        if not isinstance(raw_trace, list):
            continue
        for raw_snapshot in raw_trace:
            if not isinstance(raw_snapshot, dict):
                continue
            claim_id = raw_snapshot.get("id")
            if not isinstance(claim_id, str) or not claim_id:
                continue
            traces[(event.object_id, claim_id)] = _TraceSnapshot(
                answer_id=event.object_id,
                claim_id=claim_id,
                audit_event_id=event.id,
                audit_event_hash=event.event_hash,
                snapshot=raw_snapshot,
            )
    return traces


def _claim_provenance_issues(
    answer_id: str,
    claim: Claim,
    trace: _TraceSnapshot | None,
) -> list[ClaimProvenanceIssue]:
    issues: list[ClaimProvenanceIssue] = []

    if not _SHA256_RE.fullmatch(claim.extraction_hash):
        issues.append(
            _issue(
                answer_id,
                claim.id,
                "invalid_extraction_hash",
                "Claim extraction_hash is not a lowercase SHA-256 hex digest.",
                trace,
            )
        )

    if trace is None:
        issues.append(
            _issue(
                answer_id,
                claim.id,
                "missing_audit_trace",
                "No answer_added extraction_trace snapshot was found for this extracted claim.",
                None,
            )
        )
        return issues

    _compare_snapshot_field(
        issues,
        answer_id,
        claim,
        trace,
        field_name="extraction_hash",
        current_value=claim.extraction_hash,
    )
    _compare_snapshot_field(
        issues,
        answer_id,
        claim,
        trace,
        field_name="extraction_rule",
        current_value=claim.extraction_rule,
    )
    _compare_snapshot_field(
        issues,
        answer_id,
        claim,
        trace,
        field_name="confidence",
        current_value=claim.confidence,
    )
    _compare_snapshot_field(
        issues,
        answer_id,
        claim,
        trace,
        field_name="source_start",
        current_value=claim.source_start,
    )
    _compare_snapshot_field(
        issues,
        answer_id,
        claim,
        trace,
        field_name="source_end",
        current_value=claim.source_end,
    )

    if claim.review_status != ClaimReviewStatus.EDITED:
        for field_name in ("subject", "attribute", "value", "source_text"):
            _compare_snapshot_field(
                issues,
                answer_id,
                claim,
                trace,
                field_name=field_name,
                current_value=getattr(claim, field_name),
                code="claim_content_mismatch",
            )

    return issues


def _compare_snapshot_field(
    issues: list[ClaimProvenanceIssue],
    answer_id: str,
    claim: Claim,
    trace: _TraceSnapshot,
    *,
    field_name: str,
    current_value: object,
    code: str | None = None,
) -> None:
    if trace.snapshot.get(field_name) == current_value:
        return
    issues.append(
        _issue(
            answer_id,
            claim.id,
            code or f"{field_name}_mismatch",
            f"Claim {field_name} does not match the answer_added audit snapshot.",
            trace,
        )
    )


def _issue(
    answer_id: str,
    claim_id: str,
    code: str,
    message: str,
    trace: _TraceSnapshot | None,
) -> ClaimProvenanceIssue:
    return ClaimProvenanceIssue(
        answer_id=answer_id,
        claim_id=claim_id,
        code=code,
        severity="error",
        message=message,
        audit_event_id=trace.audit_event_id if trace else "",
    )
