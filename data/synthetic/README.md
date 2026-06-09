# Synthetic Data

Synthetic data for tests and evaluation.

Each scenario should include:

- case description,
- expected topics,
- reference question plan,
- simulated answers,
- expected gaps,
- expected potential inconsistencies.

Only synthetic data may be committed to this directory.

## Current Scenarios

| Case | Scenario | Main purpose |
| --- | --- | --- |
| `case-001` | Bicycle theft witness interview | Baseline flow with topic coverage, one leading question, and one time inconsistency. |
| `case-002` | Late-night pharmacy incident | Service-access contradiction, alarm chronology, source-of-knowledge checks, and uncovered recording/access-log topic. |
| `case-003` | Care facility medication discrepancy | Role-boundary awareness, documentation grounding, medication timeline conflicts, and cabinet-access contradiction. |
