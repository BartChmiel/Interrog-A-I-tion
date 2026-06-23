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

| Case | Scenario | Main purpose | Suggested use |
| --- | --- | --- | --- |
| `case-001` | Bicycle theft witness interview | Baseline flow with topic coverage, one leading question, one time inconsistency, route logs, owner report, and an open recording topic. | First onboarding / baseline workflow |
| `case-002` | Late-night pharmacy incident | Service-access contradiction, alarm chronology, mixed source-of-knowledge, roster, maintenance, access-card, and open recording leads. | Richer witness + materials workflow |
| `case-003` | Care facility medication discrepancy | Role-boundary awareness, documentation grounding, medication timeline conflicts, inventory reconciliation, and cabinet-access contradiction. | Default guided workflow and tutorial |

Each case directory includes a `README.md` with expected training signals and a suggested demo path.
