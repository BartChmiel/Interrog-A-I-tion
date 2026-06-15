# AI Prompts and Guardrails

## Prompt Strategy

Prompts must be versioned, testable, and tied to explicit output schemas.

Prompt files live in `prompts/`. Structured response contracts live in `schemas/`.

## General Guardrails

AI outputs must:

- remain advisory,
- cite source ids where required,
- avoid truthfulness and guilt verdicts,
- avoid psychological diagnosis,
- avoid coercive or manipulative questions,
- expose uncertainty,
- remain reviewable by a human operator.

## Grounded Suggestions

Grounded suggestions use a bounded context pack. Suggestions are parsed, source-validated, and audited.

Each grounded suggestion call can produce:

- prompt artifact,
- context artifact,
- output artifact,
- prompt/context/output hashes,
- citation warnings,
- audit event.

## Output Validation

Structured AI outputs should be validated by:

- JSON parsing,
- schema or dataclass normalization,
- citation checks,
- suggestion-type checks,
- guardrail checks,
- confidence bounds.

## Runtime Policy

Real model execution must be gated. Deterministic fake-model behavior must remain available for tests.

External model bridges, if added later, must pass through:

- explicit runtime mode,
- anonymization or pseudonymization gateway,
- context minimization,
- provenance capture,
- response sanitization,
- operator approval.

## Prompt Versioning

Prompt versions should be included in:

- API responses,
- audit events,
- model artifact metadata,
- export provenance where relevant.
