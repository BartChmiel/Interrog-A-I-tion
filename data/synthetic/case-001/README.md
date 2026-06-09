# Synthetic Case 001

First synthetic scenario.

Purpose:

- test question planning,
- verify topic coverage,
- include one chronological gap,
- include one potential time or location inconsistency.

## Content

`case.json` describes a synthetic bicycle theft interview scenario.

The scenario intentionally includes:

- an uncovered potential recording topic,
- one potentially leading question,
- one potential time inconsistency: `19:45` vs `20:10`.

## Run Analysis

From `backend/`:

```powershell
python -m interrogaition.cli review ..\data\synthetic\case-001\case.json
```
