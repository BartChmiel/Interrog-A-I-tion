# Variant 2 Roadmap

## Product Decision

The selected direction is variant 2: an investigative interviewing assistant with narrative consistency and credibility-indicator support.

The primary target users are police and prosecution professionals. The thesis work should be developed as a real product seed, not only as a disposable academic prototype.

## Product Scope

The system should support:

- live interview preparation and conduct,
- active assistance during the interview,
- visual bullet summaries while the interview progresses,
- topic coverage tracking,
- internal question classification for visualization,
- narrative consistency analysis during and after the interview,
- credibility and reliability indicators,
- report generation aligned with institutional standards,
- full auditability and human authority over decisions.

## Main Interview Roles

The system must support multiple procedural roles:

- witness,
- suspect,
- injured party or victim,
- expert,
- other participant.

The design must allow role changes over time. In real investigations, a witness may become a suspect, an injured party may become a perpetrator, and role boundaries may shift as evidence develops.

## Strategic Direction

The deployment horizon is:

1. Poland,
2. European Union,
3. wider international use.

The first implementation should therefore be local and Polish-ready, while the engineering and documentation remain English-first and jurisdiction-aware.

## Thesis/Product Balance

The project should satisfy both:

- a computer science thesis in ML/cybersecurity,
- a serious path toward a real investigative technology product.

This means that each feature should be:

- researchable,
- testable,
- auditable,
- defensible under legal and ethical constraints,
- designed with future institutional deployment in mind.

## Stages

### Stage 0: Foundation

- product strategy,
- language policy,
- initial synthetic cases,
- deterministic review pipeline,
- documentation and architecture decisions,
- first tests.

### Stage 1: Live Research Prototype

- live interview session model,
- case workspace model,
- topic and question panels,
- answer note-taking,
- visual bullet-point summary,
- deterministic analysis refresh after each answer,
- localized working report.

### Stage 2: AI Assistant Layer

- model client interface,
- fake model client for tests,
- Ollama adapter,
- prompt rendering,
- JSON output validation,
- guardrails,
- AI-generated follow-up suggestions,
- AI-generated summaries.

### Stage 3: Credibility and Reliability Indicators

- topic coverage score,
- narrative consistency score,
- source-of-knowledge quality indicators,
- evidence alignment indicators,
- contradiction density,
- uncertainty and confidence display,
- factor-level breakdown,
- audit record of indicator generation.

### Stage 4: Security and Institutional Readiness

- per-case workspace,
- encryption-at-rest path,
- export hashes,
- append-only audit log,
- air-gapped mode,
- role-based access,
- local model configuration,
- offline installation path.

### Stage 5: Evaluation

- synthetic benchmark cases,
- expert review protocol,
- comparison with and without tool support,
- false-positive/false-negative tracking,
- question-quality analysis,
- AI governance assessment.

### Stage 6: Pilot Path

- private repository,
- controlled demo,
- legal review,
- ethics review,
- field-practitioner feedback,
- institutional pilot proposal.

## Non-Negotiable Boundaries

- no automated guilt decision,
- no automated procedural decision,
- no hidden influence on official records,
- no cloud transmission of sensitive case material by default,
- no pressure/manipulation-oriented question generation,
- no untraceable credibility output.

Credibility indicators may exist, but they must be decision-support indicators with traceable factors, auditability, and human authority.
