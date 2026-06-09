# Synthetic Case 003

Synthetic care facility medication discrepancy scenario.

Purpose:

- demonstrate role-boundary awareness,
- test contradictions across time and access claims,
- include documentation-grounding questions,
- leave potential monitoring uncovered for follow-up.

## Content

`case.json` describes a care facility worker interview about a missing medication dose.

The scenario intentionally includes:

- an uncovered potential monitoring topic,
- one potentially leading role-boundary question: `q-306`,
- one potential time inconsistency: `18:40` vs `19:05`,
- one access contradiction: key holder `supervisor` vs `witness`.

## Run Analysis

From `backend/`:

```powershell
python -m interrogaition.cli review ..\data\synthetic\case-003\case.json
```
