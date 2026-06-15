# Thesis Plan

## Working Theme

Local, auditable AI assistance for investigative interviewing with a focus on forensic computing, cybersecurity, and machine learning governance.

## Research Objective

Design and evaluate a local prototype that supports interview planning, live note-taking, grounded follow-up suggestions, topic coverage analysis, and auditability without automated truthfulness or guilt decisions.

## Possible Research Questions

- Can a local AI-assisted workflow improve topic coverage in simulated investigative interviews?
- Can grounded suggestions remain source-linked and auditable enough for forensic computing requirements?
- How should credibility-support indicators be designed to avoid automated verdicts?
- What provenance records are necessary for defensible AI-assisted interview support?
- What security controls are required before moving from synthetic to anonymized data?

## Proposed Structure

1. Introduction and motivation.
2. Legal, ethical, and methodological background.
3. System requirements.
4. Architecture and security model.
5. AI workflow and guardrails.
6. Implementation.
7. Evaluation on synthetic cases.
8. Limitations and future work.

## Engineering Contribution

- Local API and frontend prototype.
- Case workspace boundary.
- Append-only audit chain.
- Hash-chained model artifact manifests.
- Grounded suggestion workflow.
- Export integrity with model provenance.
- Evaluation-ready synthetic scenarios.

## Evaluation Direction

Initial evaluation should use synthetic cases and compare:

- coverage with and without tool support,
- question quality,
- frequency of unsupported AI suggestions,
- operator edits and rejections,
- audit/provenance completeness.
