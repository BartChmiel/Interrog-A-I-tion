# Synthetic Case 001

Baseline synthetic scenario for bicycle-theft witness interviewing.

## Purpose

- introduce the core interview workflow,
- test question planning and topic coverage,
- demonstrate one deliberate time inconsistency,
- leave the recording topic open for follow-up,
- show one leading question that needs human review.

## Scenario Summary

A student witness reports seeing a man at a library bicycle stand around 19:45, then gives a later
start-time estimate after leaving class. A campus camera note and patrol log exist, but the
recording topic has not yet been explored in the live interview.

## Expected Training Signals

| Signal | Where to look |
| --- | --- |
| Time inconsistency | answers `a-001` vs `a-002` (`19:45` vs `20:10`) |
| Leading question | `q-003` |
| Uncovered recording topic | `topic-recording` — ask a neutral follow-up about camera C-12 |
| Material leads | `case-001-security-camera-note`, `case-001-class-schedule` |
| Source-of-knowledge check | answer `a-003` |

## Suggested Demo Path

1. Open dossier and review priority gaps.
2. Record or inspect answers for chronology.
3. Open Materials and compare camera note with the witness schedule note.
4. Use Grounded AI for a neutral follow-up on time or recording coverage.
5. Review findings and export a research session report.

## Run Analysis

From `backend/`:

```powershell
python -m interrogaition.cli review ..\data\synthetic\case-001\case.json
```
