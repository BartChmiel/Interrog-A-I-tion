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

## Current STOP

Milestone 5: React/Vite frontend foundation has reached its first review point.

The project owner should evaluate:

- whether the React app preserves the intended live interview layout,
- whether the componentized UI should now become the main frontend target,
- whether the static prototype should remain maintained or become archival,
- whether the next milestone should be API persistence, frontend state hardening, or local model output in live mode.

## Current STOP

Milestone 6: Audited grounded suggestion decisions has reached its first review point.

The project owner should evaluate:

- whether `accepted`, `edited`, and `rejected` are sufficient decision states for operator handling of AI suggestions,
- whether edited suggestion text should be stored exactly as typed or additionally normalized,
- whether suggestion decision audit events should remain workspace-level records or also attach to session audit views,
- whether model id, prompt version, context hash, output hash, source ids, and final text are sufficient audit metadata,
- whether offline/local-demo decisions should remain non-audited,
- whether these records can be used in thesis evaluation before they are treated as official procedural records.

## Current STOP

Milestone 6: Live-visible grounded suggestions has reached its first review point.

The project owner should evaluate:

- whether the right-rail AI panel is acceptable during a live interview workflow,
- whether suggestion types `follow_up_question`, `gap`, `potential_inconsistency`, and `summary` match the intended operator support model,
- whether the UI should continue showing model id, prompt version, source ids, and citation warnings to the operator,
- whether invalid or missing citations should remain warnings in prototype mode or become hard rejections before real model trials,
- whether firm clarification wording for potential inconsistencies remains ethically and procedurally acceptable,
- whether `use`, `edit`, and `reject` should become audited backend decisions in the next iteration.

## Current STOP

Milestone 6: Grounding context pack has reached its first review point.

The project owner should evaluate:

- whether every future model suggestion must cite `allowed_source_ids`,
- whether the current grounding rules are strict enough,
- whether `material_only` leads should be shown to AI before an operator accepts them,
- whether the first grounded model endpoint should be offline review only,
- whether audit metadata should include prompt version, model id, context hash, and output hash.

## Current STOP

Milestone 6: Case evidence map has reached its first review point.

The project owner should evaluate:

- whether topic-level grouping is enough before adding a full evidence graph,
- whether statuses `covered`, `grounded`, `material_only`, `contested`, and `missing` are acceptable,
- whether the UI should show only counts or also linked ids and matched terms,
- whether the map can become grounding context for local AI prompts,
- whether the next step should be human accept/reject controls, evidence graph expansion, or local model prompts grounded in the map.

## Current STOP

Milestone 6: Material-question grounding links have reached their first review point.

The project owner should evaluate:

- whether deterministic topic-based links are acceptable as the first grounding layer,
- whether link confidence should remain visible to operators,
- whether matched terms should be shown in the UI now or kept for audit/debug views,
- whether future AI suggestions must cite material ids and question ids,
- whether the next step should be human accept/reject controls for links or AI prompts grounded in these links.

## Current STOP

Milestone 6: Workspace material register has reached its first review point.

The project owner should evaluate:

- whether the initial material metadata is sufficient for thesis and product needs,
- whether text-only registration is enough for the next prototype step,
- whether material ids should be human-authored, generated, or both,
- whether non-synthetic material should remain blocked until encrypted storage is actually active,
- whether the next step should be a UI import screen, material-to-question linking, or local model prompts grounded in registered material.

## Current STOP

Milestone 6: Export integrity manifests have reached their first review point.

The project owner should evaluate:

- whether SHA-256 file hashes plus a manifest hash are sufficient for the thesis prototype,
- whether export manifests should be shown in the UI or remain a backend/CLI artifact for now,
- whether future official-looking exports must be blocked until legal/UX wording is reviewed,
- whether the next security step should be UI workspace integration or a concrete SQLCipher installation route.

## Current STOP

Milestone 6: SQLCipher runtime readiness has reached its first review point.

The project owner should evaluate:

- whether encrypted workspace creation should remain blocked until SQLCipher is actually installed,
- which SQLCipher packaging route should be used for Windows development and future institutional deployment,
- whether the UI should display the encryption readiness status before allowing non-synthetic imports,
- whether the next step should be installing SQLCipher locally, implementing export hashing, or wiring workspace screens into the UI.

## Current STOP

Milestone 6: Case workspace and access policy boundary has reached its first review point.

The project owner should evaluate:

- whether the initial workspace directories match the expected case lifecycle,
- whether the prototype roles are sufficient for police/prosecution-oriented workflow testing,
- whether anonymized imports should remain blocked until encrypted storage is implemented,
- whether the next security step should be SQLCipher research, export hashing, or UI integration for workspace creation,
- whether access-policy decisions should be visible in the UI or only enforced by backend/API.

## Current STOP

Milestone 6: SQLite persistence and audit chain has reached its first review point.

The project owner should evaluate:

- whether plain SQLite is acceptable for the prototype-only storage layer,
- whether the audit actions are sufficient for the first thesis demo,
- whether review refreshes should always create audit records,
- whether the next storage step should be per-case workspaces, export integrity, or SQLCipher research,
- whether real or anonymized data must remain blocked until encryption and access controls are designed.

## Next Expected STOP

The next expected STOP is before adding encrypted storage, before connecting real local model output to live mode, before importing real or anonymized case data, before treating audited suggestion decisions as official procedural records, or before introducing export formats intended to look official.

## Decision Note

Ollama is accepted as the first local model runtime, not as the full AI strategy. The project-owned AI layer remains the prompts, schemas, guardrails, indicators, audit, evaluation, and future fine-tuning path.
