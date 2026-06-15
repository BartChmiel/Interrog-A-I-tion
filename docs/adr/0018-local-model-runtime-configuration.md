# ADR 0018: Local Model Runtime Configuration

## Status

Accepted.

## Context

The project has a `ModelClient` abstraction, a deterministic grounded fake model,
and an Ollama adapter. The next step is to make local model readiness visible and
testable without accidentally allowing real model output into institutional live
interview workflows.

## Decision

Add a local model runtime configuration and smoke-check layer.

Backend:

- `ai/local_model_runtime.py` reads model runtime settings from environment
  variables.
- Default provider is `deterministic`.
- Ollama can be selected with `INTERROGAITION_MODEL_PROVIDER=ollama`, but real
  model execution remains disabled unless `INTERROGAITION_ENABLE_REAL_MODEL=1`.
- `live_output_enabled` defaults to `false` and is enabled only with
  `INTERROGAITION_ENABLE_LIVE_MODEL_OUTPUT=1`.
- When provider, real-model, and live-output gates are all enabled, grounded
  suggestions resolve to `OllamaClient`; otherwise they use
  `DeterministicGroundedModelClient`.
- `POST /ai/local-model/smoke` runs a deterministic smoke check by default.
- Real Ollama smoke requires both `execute_real=true` and explicit runtime enablement.

Frontend:

- The security rail shows local model runtime state, configured model, effective
  provider, restrictions, and the latest smoke result.
- The smoke button calls the safe deterministic smoke endpoint; it does not send
  case data or interview notes.

## Consequences

- Operators and developers can see whether the project is in deterministic or
  Ollama-ready mode.
- Tests remain deterministic and do not require Ollama.
- Real model output cannot enter live suggestions by environment configuration alone.
- A STOP review remains required before real local model output is trusted in live
  institutional use.
