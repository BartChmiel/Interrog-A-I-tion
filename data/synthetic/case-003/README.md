# Synthetic Case 003

Recommended first supervisor-demo scenario: care-facility medication discrepancy.

## Purpose

- demonstrate role-boundary awareness,
- test contradictions across time and access claims,
- include documentation-grounding questions,
- leave monitoring coverage open for follow-up,
- support the default guided demo and tutorial path.

## Scenario Summary

A care-facility worker is interviewed about a missing medication dose during an evening round.
The account contains conflicting discovery times and competing claims about who held the cabinet
key. Starter materials include medication logs, handover notes, and monitoring references.

## Expected Training Signals

| Signal | Where to look |
| --- | --- |
| Time inconsistency | answers with `18:40` vs `19:05` |
| Access contradiction | supervisor vs witness key claims |
| Leading role-boundary question | `q-306` |
| Uncovered monitoring topic | `topic-care-monitoring` |
| Material leads | `case-003-medication-log`, `case-003-key-handover` |

## Suggested Demo Path

Use the in-app tutorial (`&tutorial=1`) or the left-side demo path. This case is the default
supervisor walkthrough documented in `docs/24-first-supervisor-demo.md`.

## Run Analysis

From `backend/`:

```powershell
python -m interrogaition.cli review ..\data\synthetic\case-003\case.json
```
