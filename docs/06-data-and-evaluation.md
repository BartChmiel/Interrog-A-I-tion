# Data and Evaluation

## Data Policy

Repository data must be synthetic. Real, sensitive, or legally restricted material must not be committed.

Non-synthetic material requires:

- formal approval,
- data-protection review,
- encryption-ready storage,
- access controls,
- documented retention rules,
- explicit import procedure.

## Synthetic Data

Synthetic cases should include:

- multiple participants,
- role changes,
- inconsistent statements,
- uncertain source-of-knowledge claims,
- timeline gaps,
- material/question links,
- expected evaluation notes.

## Evaluation Dimensions

- Topic coverage.
- Question neutrality.
- Source citation validity.
- Grounded suggestion usefulness.
- Human accept/edit/reject behavior.
- False positives for inconsistency indicators.
- Audit and provenance completeness.
- Usability of the live workflow.

## Metrics

Candidate metrics:

- percentage of covered priority topics,
- number of unsupported suggestions,
- citation warning count,
- operator edit rate,
- rejected suggestion rate,
- evidence alignment band,
- audit chain validity,
- model artifact manifest chain validity,
- export verification result.

## Evaluation Stages

1. Unit tests on deterministic fixtures.
2. Synthetic scenario walkthroughs.
3. Expert review of methodology and UI copy.
4. Controlled comparison with and without tool support.
5. Later review on approved anonymized or public data.
