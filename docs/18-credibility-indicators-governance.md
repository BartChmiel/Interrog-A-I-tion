# Credibility Indicators Governance

## Decision

Credibility scoring is strategically important, but it must be designed as a governed decision-support layer, not as an automated truthfulness or guilt decision.

The system may show strong indicators of credibility, consistency, and reliability, but the authorized human remains the final interpreter and decision-maker.

## Why This Is High Risk

In EU contexts, AI used in law enforcement can fall into high-risk categories, especially when it may interfere with fundamental rights or evaluate evidence reliability. Therefore, the project should treat credibility indicators as high-risk from the beginning, even during prototyping.

## Forbidden Outputs

The system must not output:

- "the person is lying",
- "the person is guilty",
- "the person is unreliable" as an automated conclusion,
- psychological diagnoses,
- hidden or unexplained person-level verdicts,
- procedural decisions.

## Allowed Outputs

The system may output:

- low narrative consistency,
- timeline conflict,
- source-of-knowledge weakness,
- missing corroboration,
- contradiction between answers,
- contradiction between answer and case material,
- high number of unresolved gaps,
- evidence-alignment concern,
- confidence or uncertainty for an analytical observation,
- factor-level credibility indicators.

## Indicator Layers

### Layer 1: Process Indicators

These describe interview process quality:

- topic coverage,
- unanswered required topics,
- question type distribution,
- open vs closed question ratio,
- unresolved follow-up count,
- missing source-of-knowledge checks.

### Layer 2: Narrative Consistency Indicators

These describe internal consistency of the interview material:

- timeline stability,
- location stability,
- participant consistency,
- sequence consistency,
- repeated claim changes,
- contradiction density.

### Layer 3: Evidence Alignment Indicators

These compare interview material with available case material:

- supported by source material,
- contradicted by source material,
- unsupported claim,
- requires external verification,
- potential camera/document/witness follow-up.

### Layer 4: Credibility Review Summary

This can aggregate lower-level indicators, but only with:

- visible factors,
- traceable evidence links,
- uncertainty,
- warnings,
- no automated legal conclusion.

## Black-Box Boundary

The model internals may be treated as implementation details, but user-facing outputs must not be opaque.

The system does not need to expose hidden chain-of-thought. It should expose:

- evidence links,
- detected factors,
- input fragments used,
- confidence/uncertainty,
- limitations,
- audit event identifiers.

## Human Authority

The human user may ignore AI warnings or indicators, but the system should record:

- what was shown,
- when it was shown,
- what the user did,
- whether the user accepted, ignored, edited, or overrode the output where relevant.

Not every suggestion needs a heavy accept/reject workflow during live interviewing. However, high-risk outputs should be auditable.

## UI Guidance

Credibility indicators should be shown as:

- factor cards,
- timelines,
- consistency heatmaps,
- topic coverage bars,
- numeric values plus color bars,
- evidence alignment markers,
- "requires clarification" items,
- not as a single magic percentage.

The aggregate credibility review score is visible to the interviewer, but it must be decomposable into factors. Confidence should also be visible.

## Research Questions

Potential thesis questions:

- Can local AI improve detection of unresolved narrative gaps during live interview support?
- Can credibility indicators be generated in a traceable and auditable way?
- How often do indicator warnings align with expert assessment?
- Which indicators create too many false positives?
- Can an air-gapped local system support high-risk AI governance requirements?

## Regulatory Anchors

Initial official sources:

- European Commission AI Act overview: https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai
- European Commission AI Act high-risk examples, including law enforcement use-cases and reliability of evidence: https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai
- EUR-Lex Regulation (EU) 2024/1689: https://eur-lex.europa.eu/eli/reg/2024/1689/
- NIST AI Risk Management Framework: https://www.nist.gov/itl/ai-risk-management-framework
