"""Deterministic narrative consistency checks.

The first version works on structured claims attached to synthetic answers.
In later versions, local AI can extract these claims from natural language.
"""

from __future__ import annotations

from dataclasses import dataclass

from interigaition.domain.models import Answer, Claim


@dataclass(frozen=True)
class ClaimConflict:
    subject: str
    attribute: str
    claims: tuple[Claim, ...]
    answer_ids: tuple[str, ...]


def find_claim_conflicts(answers: list[Answer]) -> list[ClaimConflict]:
    """Find conflicting values for the same subject and attribute."""

    grouped: dict[tuple[str, str], list[tuple[str, Claim]]] = {}

    for answer in answers:
        for claim in answer.claims:
            key = (_normalize(claim.subject), _normalize(claim.attribute))
            grouped.setdefault(key, []).append((answer.id, claim))

    conflicts: list[ClaimConflict] = []

    for (subject, attribute), answer_claims in grouped.items():
        values = {_normalize(claim.value) for _, claim in answer_claims if claim.value.strip()}
        if len(values) <= 1:
            continue

        conflicts.append(
            ClaimConflict(
                subject=subject,
                attribute=attribute,
                claims=tuple(claim for _, claim in answer_claims),
                answer_ids=tuple(answer_id for answer_id, _ in answer_claims),
            )
        )

    return conflicts


def _normalize(value: str) -> str:
    return " ".join(value.strip().lower().split())
