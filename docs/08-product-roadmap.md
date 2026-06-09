# Product Roadmap

## Product Direction

InterrogA(I)tion is an investigative interviewing assistant with local security, grounded AI suggestions, topic/evidence coverage, advisory consistency indicators, and strong provenance controls.

The target direction is a serious research prototype with a credible path toward institutional review. It should not be described as production-ready.

## Target Users

- Investigators and interviewers.
- Prosecutors and case reviewers.
- Forensic analysts.
- Security administrators.
- Academic evaluators.

## Supported Procedural Roles

The system should support role-aware workflows for:

- witness,
- suspect,
- injured party or victim,
- expert,
- other participant.

Role changes must be represented over time because procedural status may change as evidence develops.

## Deployment Horizon

Long-term deployment assumptions:

1. Poland,
2. European Union,
3. wider international adaptation.

The first implementation should therefore be local, jurisdiction-aware, and localization-ready.

## Stages

### Stage 0: Foundation

- Product strategy.
- Language policy.
- Synthetic cases.
- Deterministic review pipeline.
- Documentation and ADRs.
- First tests.

### Stage 1: Live Research Prototype

- Live interview session model.
- Case workspace model.
- Question and topic panels.
- Answer note-taking.
- Visual summaries.
- Deterministic analysis refresh.
- Localized working report.

### Stage 2: AI Assistant Layer

- Model client interface.
- Deterministic fake model client.
- Local model runtime gate.
- Prompt rendering.
- JSON output validation.
- Guardrails.
- Grounded follow-up suggestions.

### Stage 3: Advisory Indicators

- Topic coverage.
- Narrative consistency support.
- Source-of-knowledge quality.
- Evidence alignment.
- Uncertainty and confidence display.
- Factor-level breakdown.
- Audit record of indicator generation.

### Stage 4: Security and Provenance

- Per-case workspace.
- Encryption-at-rest path.
- Export integrity.
- Append-only audit log.
- Hash-chained model artifact manifests.
- Air-gapped mode.
- Role-based access.
- Local model configuration.

### Stage 5: Evaluation

- Synthetic benchmark cases.
- Expert review protocol.
- Comparison with and without tool support.
- False-positive and false-negative tracking.
- Question-quality analysis.
- AI governance assessment.

### Stage 6: Institutional Review Path

- Controlled private repository.
- Controlled demo.
- Legal review.
- Ethics review.
- Practitioner feedback.
- Pilot proposal.

## Non-Negotiable Boundaries

- No automated guilt decision.
- No automated procedural decision.
- No hidden influence on official records.
- No default cloud transmission of sensitive case material.
- No pressure-oriented question generation.
- No untraceable credibility output.
