# Vision and Scope

## Problem

Investigative interviewing requires listening, note-taking, procedural discipline, topic tracking, and follow-up decisions at the same time. This creates cognitive load and increases the risk of missing relevant threads or asking poorly framed questions.

InterrogA(I)tion is a local-first support tool for preparing, conducting, and reviewing investigative interviews.

## Product Vision

The system combines three perspectives:

- forensic computing: local processing, integrity, auditability, workspace boundaries, and evidence-oriented data handling,
- AI assistance: grounded question suggestions, summarization, gap detection, and controlled model workflows,
- investigative interviewing methodology: neutrality, free recall, rapport-aware structure, non-coercive clarification, and avoidance of leading questions.

The first implementation is a research prototype. Its architecture should remain compatible with a future institutional deployment path, but it must not imply operational readiness before legal, security, and evaluation gates are satisfied.

## Product Goal

The application should help authorized users:

- prepare interview plans from case material,
- track questions, answers, notes, and topics in one workspace,
- monitor topic coverage,
- receive neutral follow-up and clarification suggestions,
- compare accounts for potential gaps or inconsistencies,
- preserve a traceable audit trail of human and AI-assisted work.

## Product Hypothesis

If an interviewer has a local tool that structures questions, answers, source material, and AI suggestions, the interview can be conducted more methodically and with a stronger audit trail.

The system improves process quality. It does not detect lies.

## Explicit Non-Goals

The system must not:

- determine whether a person is telling the truth,
- classify a person as credible or not credible,
- replace the interviewer,
- hide why a suggestion was produced,
- transmit sensitive case material to external services by default,
- make procedural or legal decisions.

## Users

Initial user groups:

- investigator or interviewer,
- prosecutor or case reviewer,
- forensic expert or analyst,
- security administrator,
- academic reviewer of the research prototype.

## Core Scenarios

1. Interview preparation:
   - import or register case material,
   - identify topics, risks, and planned questions,
   - review AI-generated suggestions before use.

2. Live interview support:
   - record notes and answers,
   - track topic coverage and evidence alignment,
   - receive neutral grounded follow-up suggestions.

3. Post-interview review:
   - review gaps, conflicts, and unsupported claims,
   - produce a working report,
   - verify audit and model-provenance records.

## MVP Boundary

The first complete prototype should include:

- local case workspace,
- question plan and note-taking workflow,
- synthetic data fixtures,
- grounded suggestions,
- topic and material coverage views,
- report export,
- audit and model artifact provenance.

## Success Criteria

The MVP is successful if a synthetic case can be used to:

- prepare an interview plan,
- conduct a simulated interview,
- receive source-linked follow-up suggestions,
- inspect topic coverage,
- review potential inconsistencies without automated verdicts,
- export a report with integrity and provenance metadata.
