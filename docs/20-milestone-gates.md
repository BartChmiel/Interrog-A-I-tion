# Milestone Gates

## Rule

When a milestone reaches a point that requires strategic evaluation, product direction, ethics, UX review, legal-risk review, or thesis-scope review, development should pause with a visible:

> STOP

The STOP should include:

- what was built,
- what changed strategically,
- what must be checked by the project owner,
- questions that need a decision,
- risks or trade-offs,
- recommended next step.

## When To Stop

Use a STOP gate before:

- introducing real AI model behavior,
- introducing credibility indicators or aggregate scores,
- changing the live-interview workflow,
- adding storage for sensitive data,
- adding encryption or audit assumptions,
- adding export formats intended to look official,
- adding real or anonymized non-synthetic data,
- changing target users or supported procedural roles,
- changing deployment assumptions,
- creating a public repository or release.

## When Not To Stop

No STOP is needed for small implementation steps that do not change product direction, such as:

- adding tests,
- refactoring internal code,
- improving deterministic analysis,
- adding synthetic data,
- fixing localization strings,
- improving developer documentation.

## Current STOP

Milestone 1: Live Session Core has reached its first review point.

The project owner should then evaluate:

- whether the modeled live session matches the intended interview workflow,
- whether participant role changes are represented correctly,
- whether the right-side live review concept is acceptable,
- whether the next milestone should be credibility indicators or model integration.

## Current STOP

Milestone 2: Credibility Indicator Model has reached its first review point.

The project owner should evaluate:

- whether the current indicator names are acceptable,
- whether the aggregate credibility review score should remain visible,
- whether scores should be shown as `0.80`, percentages, color bands, or labels,
- whether indicator confidence should be visible to end users,
- whether the next milestone should be model integration or FastAPI.

## Current STOP

Milestone 3: Local Model Abstraction has reached its first review point.

The project owner should evaluate:

- whether local LLM integration should use Ollama first,
- which model family should be used for the first experiment,
- whether model outputs should be allowed in live mode or only offline review at first,
- whether fake-model tests are sufficient before trying a real model,
- whether the next milestone should be FastAPI or UI.

## Current STOP

Milestone 4: FastAPI Prototype has reached its first review point.

The project owner should evaluate:

- whether the endpoint shape is sufficient for the first UI,
- whether session state can remain in memory for the prototype,
- whether the API should expose AI suggestions before the UI,
- whether the local environment should be standardized with `uv`, Conda, or another package manager,
- whether the next milestone should be first UI or dependency/environment cleanup.

## Current STOP

Milestone 5: First UI has reached its static prototype review point.

The project owner should evaluate:

- whether the live interview layout feels right,
- whether indicators on the right side are understandable,
- whether numeric values plus gradient bars are acceptable,
- whether the question list and answer stream match the intended workflow,
- whether the prototype should now move to React/Vite.

## Next Expected STOP

The next expected STOP is before migrating the static prototype to React/Vite or before connecting real local model output to live mode.

## Decision Note

Ollama is accepted as the first local model runtime, not as the full AI strategy. The project-owned AI layer remains the prompts, schemas, guardrails, indicators, audit, evaluation, and future fine-tuning path.
