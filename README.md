# InterigA(I)tion

Local, air-gapped, auditable AI-assisted investigative interviewing prototype for police and prosecution workflows, focused on live interview support, narrative consistency, topic coverage, credibility indicators, question quality, and human oversight.

The system is designed as a support tool for authorized professionals. It must not automatically decide whether a person is lying, guilty, or procedurally reliable. AI can help with:

- preparing an interview plan from case material,
- organizing notes and answers,
- suggesting neutral follow-up and clarification questions,
- supporting methodical investigative interviewing techniques,
- identifying gaps, potential inconsistencies, and items requiring verification,
- producing non-binding working indicators for topic coverage, narrative consistency, evidence alignment, and credibility assessment.

## Core Boundary

The system does not make an automated legal, procedural, or truthfulness decision. It can describe observable properties of the material, such as missing answers, timeline conflicts, changed details, uncovered topics, source-of-knowledge weaknesses, corroboration gaps, or questions that may need review. Interpretation remains with the authorized human user.

## Selected Product Variant

We are building variant 2: an investigative interviewing assistant with narrative consistency support.

The thesis prototype should demonstrate:

- interview planning,
- interview notes and question tracking,
- active live-assistant suggestions,
- topic coverage analysis,
- potential narrative inconsistency detection,
- credibility and reliability indicators with audit controls,
- a working report with an audit trail.

The architecture should also leave a path toward future institutional deployment: local processing, encryption, roles, auditability, evaluation, and compliance with AI and law-enforcement data requirements.

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

Cases, UI labels, report templates, and future installer/startup language selection should use the `locales/` structure instead of hard-coded strings.

## Documentation

- [Vision and Scope](docs/00-wizja-i-zakres.md)
- [MVP Requirements](docs/01-wymagania-mvp.md)
- [Local Architecture](docs/02-architektura-lokalna.md)
- [Security and Privacy](docs/03-bezpieczenstwo-i-prywatnosc.md)
- [Interviewing Methodology and AI](docs/04-metodyka-przesluchania-i-ai.md)
- [Thesis Plan](docs/05-plan-pracy-magisterskiej.md)
- [Data and Evaluation](docs/06-dane-i-ewaluacja.md)
- [Ethical and Legal Risks](docs/07-ryzyka-etyczne-i-prawne.md)
- [Variant 2 Roadmap](docs/08-wariant-2-roadmapa.md)
- [Investigative Interviewing Psychology](docs/09-psychologia-przesluchaniowa.md)
- [AI Prompts and Guardrails](docs/10-ai-prompty-i-guardrails.md)
- [Repository Structure](docs/11-struktura-repozytorium.md)
- [Glossary](docs/12-slownik-pojec.md)
- [Initial Sources](docs/13-zrodla-startowe.md)
- [Technology Stack](docs/14-stos-technologiczny.md)
- [GitHub Publication](docs/15-publikacja-github.md)
- [Language and Localization](docs/16-language-and-localization.md)
- [Product Strategy](docs/17-product-strategy.md)
- [Credibility Indicators Governance](docs/18-credibility-indicators-governance.md)
- [Implementation Backlog](docs/19-implementation-backlog.md)
- [Milestone Gates](docs/20-milestone-gates.md)
- [Derived Assumptions and Work Packages](docs/21-derived-assumptions-and-work-packages.md)

Some early planning documents still have Polish filenames and Polish content. They should be migrated to English before the first public release.

## Suggested Stages

1. Define research, legal, and ethical scope.
2. Build an MVP using synthetic data only.
3. Add live-interview workflow and local case storage.
4. Add AI-assisted planning, live follow-up support, and visual bullet summaries.
5. Add topic coverage, narrative consistency, and credibility-indicator analysis.
6. Add air-gapped security, per-case workspaces, export integrity, and audit.
7. Evaluate on synthetic data first, then on formally approved anonymized or public data.

## Repository Structure

- `backend/` - local API, domain logic, analysis, storage, AI, export.
- `frontend/` - static prototype and React/Vite application UI.
- `locales/` - user-facing language packs.
- `prompts/` - versioned model instructions and task prompts.
- `schemas/` - JSON Schema contracts.
- `research/` - research protocols, evaluation scenarios, notes.
- `data/synthetic/` - synthetic data allowed in the repository.
- `tests/` - unit, integration, and evaluation tests.
