# InterrogA(I)tion

![InterrogA(I)tion](assets/brand/header-banner.png)

InterrogA(I)tion is a local-first, auditable research prototype for AI-assisted investigative interviewing. It is designed for privacy-preserving interview preparation, live note-taking, grounded follow-up suggestions, topic coverage review, evidence alignment, and provenance tracking.

The system is a decision-support tool for authorized professionals. It does not determine whether a person is lying, guilty, credible, or procedurally reliable. It can surface observable properties of the available material, such as missing answers, timeline conflicts, uncovered topics, source-of-knowledge gaps, and questions that may need human review.

## Product Scope

The current product direction is an investigative interviewing assistant with strong local security and traceable AI support.

Core capabilities:

- interview planning from synthetic or approved case material,
- live interview notes and answer tracking,
- grounded follow-up and clarification suggestions,
- topic coverage and evidence-alignment views,
- advisory consistency and credibility-support indicators,
- human accept/edit/reject controls for AI suggestions,
- append-only audit records,
- workspace-local model artifacts,
- export integrity manifests with model provenance references.

## Non-Negotiable Boundaries

- No automated guilt decision.
- No automated truthfulness or lie-detection verdict.
- No hidden influence on official records.
- No default cloud transmission of sensitive case material.
- No pressure-oriented or manipulative question generation.
- No untraceable scoring.

Interpretation remains with the authorized human user.

## Language Policy

Engineering artifacts are English-first:

- code,
- comments,
- commit messages,
- technical documentation,
- schemas,
- prompts,
- architecture decisions.

User-facing content is localized through language packs. The first supported locales are:

- `en` - English,
- `pl` - Polish.

UI labels, report copy, and future installer/startup language selection should use the `locales/` structure or frontend i18n copy instead of hard-coded strings.

## Documentation

- [Vision and Scope](docs/00-vision-and-scope.md)
- [MVP Requirements](docs/01-mvp-requirements.md)
- [Local Architecture](docs/02-local-architecture.md)
- [Security and Privacy](docs/03-security-and-privacy.md)
- [Interview Methodology and AI](docs/04-interview-methodology-and-ai.md)
- [Thesis Plan](docs/05-thesis-plan.md)
- [Data and Evaluation](docs/06-data-and-evaluation.md)
- [Ethical and Legal Risks](docs/07-ethical-and-legal-risks.md)
- [Product Roadmap](docs/08-product-roadmap.md)
- [Investigative Interviewing Psychology](docs/09-investigative-interviewing-psychology.md)
- [AI Prompts and Guardrails](docs/10-ai-prompts-and-guardrails.md)
- [Repository Structure](docs/11-repository-structure.md)
- [Glossary](docs/12-glossary.md)
- [Initial Sources](docs/13-initial-sources.md)
- [Technology Stack](docs/14-technology-stack.md)
- [GitHub Publication](docs/15-github-publication.md)
- [Language and Localization](docs/16-language-and-localization.md)
- [Product Strategy](docs/17-product-strategy.md)
- [Credibility Indicators Governance](docs/18-credibility-indicators-governance.md)
- [Implementation Backlog](docs/19-implementation-backlog.md)
- [Milestone Gates](docs/20-milestone-gates.md)
- [Derived Assumptions and Work Packages](docs/21-derived-assumptions-and-work-packages.md)
- [Architecture Diagram](docs/22-architecture-diagram.md)
- [Brand](docs/23-brand.md)
- [First Supervisor Demo](docs/24-first-supervisor-demo.md)

## Development Stages

1. Define research, legal, and ethical boundaries.
2. Build and validate with synthetic data only.
3. Add local live-interview workflow and case workspaces.
4. Add grounded AI assistance with strict human control.
5. Add advisory topic coverage, consistency, and evidence-alignment indicators.
6. Harden security, audit, export integrity, and model provenance.
7. Evaluate on synthetic datasets, then on formally approved anonymized or public material.

## Repository Structure

- `backend/` - local API, domain logic, analysis, storage, AI, export.
- `frontend/` - static prototype and React/Vite application UI.
- `locales/` - user-facing language packs.
- `prompts/` - versioned model instructions and task prompts.
- `schemas/` - JSON Schema contracts.
- `research/` - research protocols, evaluation scenarios, notes.
- `data/synthetic/` - synthetic data allowed in the repository.
- `tests/` - unit, integration, and evaluation tests.
