# Synthetic Case 002

Synthetic late-night pharmacy incident scenario.

Purpose:

- demonstrate a richer witness workflow,
- show a service-access contradiction,
- keep the recording topic uncovered,
- include one intentionally leading control question.

## Content

`case.json` describes an employee witness account after a late-night alarm in a pharmacy.

The scenario intentionally includes:

- an uncovered potential recording/access-log topic,
- one potentially leading question: `q-205`,
- one potential inconsistency: service door status `open` vs `locked`.

## Run Analysis

From `backend/`:

```powershell
python -m interrogaition.cli review ..\data\synthetic\case-002\case.json
```
