# ADR 0004: Local model runtime strategy

## Status

Accepted.

## Context

The project should eventually feel like its own AI-assisted investigative system, not just a wrapper around an external model. At the same time, training or serving a full custom foundation model from scratch is unrealistic for the current thesis/product seed.

## Decision

Use Ollama as the first local model runtime, but keep it behind the project-owned `ModelClient` abstraction.

The project's own AI layer consists of:

- domain model,
- prompt strategy,
- output schemas,
- guardrails,
- credibility indicators,
- audit trail,
- local evaluation,
- future fine-tuning or LoRA path,
- runtime-independent adapters.

## Consequences

Positive:

- we can run local models quickly,
- no cloud dependency is required,
- the runtime can be replaced later,
- tests remain deterministic through `FakeModelClient`,
- the project keeps ownership of the high-risk logic.

Negative:

- Ollama is not a production certification story by itself,
- model selection and local performance still need evaluation,
- future institutional deployment may require llama.cpp, vLLM, or a controlled on-prem runtime.

## Future Path

The long-term "own AI" path is:

1. deterministic indicators and governance,
2. local model abstraction,
3. local runtime through Ollama,
4. curated synthetic and anonymized datasets,
5. evaluation harness,
6. fine-tuning or LoRA experiments if legally and scientifically justified,
7. deployment runtime chosen for the target institution.

