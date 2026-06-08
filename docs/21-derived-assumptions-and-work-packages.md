# Derived Assumptions and Work Packages

This document expands the project assumptions into concrete engineering, research, legal, psychological, and product work packages.

## Core Assumptions

1. The tool supports authorized professionals during investigative interviews.
2. The system runs locally and must remain useful in air-gapped or high-security environments.
3. AI is an assistant, not a decision-maker, interrogator, psychologist, judge, or lie detector.
4. The first credible path is deterministic structure first, local AI second.
5. Every important AI output must be grounded in registered source ids and auditable context.
6. Credibility indicators are non-binding working indicators, not automated credibility verdicts.
7. Psychological interviewing methods must improve question quality and consistency checks without encouraging coercion or manipulation.
8. The thesis prototype and real product path should remain aligned, but the thesis scope must stay testable on synthetic data.

## Work Package A: Evidence Foundation

Goal: make every future AI suggestion traceable.

Implemented:

- workspace material register,
- material preview and matched-term audit view,
- material verification by hash and size,
- material-question grounding links,
- audited accepted/rejected material-question link decisions,
- topic-level case evidence map,
- grounding context pack.

Next:

- evidence graph nodes for materials, answers, claims, questions, and findings,
- stronger distinction between official evidence, working notes, and synthetic training material,
- import metadata for source, author, timestamp, chain-of-custody status, and legal sensitivity.

Strategic risk:

- if grounding is weak, AI suggestions may look more justified than they are.

Design rule:

- no AI suggestion should be displayed without linked source ids.

## Work Package B: Grounded Local AI

Goal: connect local model output only after deterministic context is reliable.

Implemented:

- `ModelClient` abstraction,
- fake model tests,
- Ollama adapter,
- guarded JSON parsing,
- forbidden truthfulness-verdict checks,
- grounded follow-up prompt draft,
- `GroundingContextPack` API contract,
- grounded prompt rendering from `GroundingContextPack`,
- local model runtime configuration,
- deterministic model smoke endpoint and UI control,
- workspace-local model artifact isolation,
- model artifact write manifests,
- live-visible grounded suggestions endpoint,
- citation validation against `allowed_source_ids`,
- audit metadata for prompt version, model id, context hash, and output hash,
- React right-rail display with source ids and `use`, `edit`, and `reject` controls,
- backend audit events for grounded suggestion `accepted`, `edited`, and `rejected` decisions.

Next:

- run a real Ollama smoke check in developer mode after STOP review,
- connect Ollama behind the same grounded service in controlled test mode after runtime approval,
- block institutional live use of real model output until a STOP review,
- add model selection persistence and runtime policy configuration.

Strategic risk:

- model output can create false confidence if users see polished language without provenance.

Design rule:

- the model may propose; the human decides.

## Work Package C: Psychology-Informed Interview Support

Goal: encode sound interviewing practices without turning them into pseudo-diagnostic scoring.

Needed capabilities:

- neutral question rewrite,
- open-question preference,
- source-of-knowledge checks,
- chronology reconstruction,
- cross-validation by topic, not by accusation,
- consistency prompts that ask for clarification rather than confrontation,
- stress-safe wording and avoidance of coercive tactics,
- role-aware handling for witness, suspect, injured party, expert, and mixed procedural status.

Future UI:

- show question type and risk tags,
- show why a suggested follow-up exists,
- provide alternative neutral phrasings,
- keep challenge-style questions visibly marked for human review.

Strategic risk:

- "psychological cross-validation" can be misunderstood as deception detection.

Design rule:

- the product language should say "clarification need", "potential inconsistency", or "coverage gap", not "lie detected".

## Work Package D: Credibility and Reliability Indicators

Goal: provide useful working indicators while preserving legal and ethical boundaries.

Implemented:

- topic coverage,
- question neutrality,
- narrative consistency from structured claims,
- source-of-knowledge coverage,
- aggregate credibility review summary with limitations.
- evidence alignment indicator using registered materials and human-reviewed links.

Next:

- explicit confidence and data-quality indicators,
- indicator provenance panel,
- separate "process quality" from "material reliability",
- add calibration tests on synthetic scenarios,
- add governance documentation for each indicator.

Strategic risk:

- aggregate scores can become de facto decisions even if labeled non-binding.

Design rule:

- every score must show factors, limitations, and linked ids.

## Work Package E: Security, Privacy, and Deployment

Goal: make local institutional deployment plausible.

Implemented:

- local workspace boundary,
- access-policy prototype,
- audit chain,
- export integrity manifest,
- SQLCipher readiness gate,
- environment health report,
- workspace-local model artifact isolation,
- synthetic-only safe prototype path.

Next:

- choose and document SQLCipher installation route,
- implement encrypted workspace creation once runtime support is verified,
- role-based UI affordances,
- signed export manifests,
- backup and archival policy,
- offline installer path,
- installer and deployment health checks.

Strategic risk:

- a "local" tool can still leak sensitive data through logs, model caches, exports, or developer telemetry.

Design rule:

- all sensitive-data paths must be explicit, local, auditable, and disable network assumptions.

## Work Package F: Evaluation and Thesis Evidence

Goal: make the thesis defensible without needing real case data early.

Needed evaluation tracks:

- deterministic unit tests,
- synthetic scenario tests,
- prompt-output validation tests,
- UI workflow tests,
- usability review with legal/forensic stakeholders,
- comparison of grounded vs ungrounded AI suggestions,
- error analysis for false links, missing topics, and overconfident suggestions.

Candidate thesis measurements:

- topic coverage improvement,
- number of neutral follow-up suggestions accepted by reviewers,
- reduction of unsupported AI suggestions,
- traceability of each suggestion to source ids,
- operator workload and clarity ratings,
- guardrail violation rate.

Strategic risk:

- real prosecutor or police data may arrive late, be limited, or be unusable for publication.

Design rule:

- synthetic data must be rich enough to test the architecture independently.

## Work Package G: Productization Path

Goal: keep the prototype aligned with future police/prosecution adoption.

Future product needs:

- installer or desktop wrapper,
- local model runtime management,
- case workspace browser,
- role-based access,
- import/export workflows,
- audit viewer,
- training/simulation mode,
- administrative policy configuration,
- localized UI packs,
- deployment documentation for PL, EU, and later global contexts.

Strategic risk:

- building too much product shell before validating core interview value.

Design rule:

- add product polish around validated workflows, not around speculative features.

## Recommended Next Implementation Order

1. STOP before running real Ollama smoke or trusting real model-generated suggestions in live mode.
2. Add SQLCipher installation route and encrypted workspace creation.
3. Add installer/deployment health checks and hash-chain coverage for model artifact manifests.
4. Add richer synthetic evaluation scenarios for thesis measurements.
5. Add audit viewer and exportable audit summaries after legal/UX wording review.
6. Add explicit confidence/data-quality indicators and indicator provenance panel.
7. Add evidence graph nodes for materials, answers, claims, questions, and findings.
8. Add model selection persistence and runtime policy configuration.

## STOP Questions Before Live AI Output

- Which local model family is acceptable for the first grounded experiment?
- Should grounded AI suggestions appear during live questioning or only after a review refresh?
- What exact wording should be used to avoid implying deception detection?
- Should every suggestion require accept/reject, or only high-risk suggestions?
- What audit metadata must be captured for model prompts and outputs?
- Should the thesis evaluation compare AI-assisted and non-AI workflows?
