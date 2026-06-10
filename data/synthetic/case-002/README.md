# Synthetic Case 002

Synthetic late-night pharmacy incident scenario.

## Purpose

- demonstrate a richer employee-witness workflow,
- show a service-access contradiction,
- separate direct observation from panel-log knowledge,
- keep recording/access-log corroboration open,
- include one intentionally leading control question.

## Scenario Summary

A pharmacy employee describes a person near the service corridor around 22:15, later reports the
service door as locked, and references alarm-panel timing from a log. Materials include alarm,
door, camera, and access-card exports that have not yet been fully reconciled in the interview.

## Expected Training Signals

| Signal | Where to look |
| --- | --- |
| Door-status contradiction | answers `a-201` (`open`) vs `a-203` (`locked`) |
| Leading question | `q-205` |
| Mixed source of knowledge | answer `a-204` |
| Uncovered recording topic | `topic-pharmacy-recording` — reconcile PH-03 with access-card export |
| Material leads | `case-002-access-card-log`, `case-002-camera-layout` |

## Suggested Demo Path

1. Review dossier focus topics for access and alarm timing.
2. Inspect answers for the open vs locked door conflict.
3. Open Materials and compare alarm log, door note, and access-card export.
4. Use Grounded AI for a neutral clarification on corridor access or recordings.
5. Review the investigative board and export the session report.

## Run Analysis

From `backend/`:

```powershell
python -m interrogaition.cli review ..\data\synthetic\case-002\case.json
```
