# Config

Local project configuration.

Expected future content:

- local model profiles,
- security mode settings,
- context limits,
- logging rules,
- export policies.

Do not store secrets in this directory.

Developer startup scripts live in `scripts/`:

- `scripts/start-dev.ps1` starts backend, frontend, and optional AI bridge/mock processes.
- `scripts/check-ai-runtime.ps1` checks the active backend model runtime.

Use `bridged-ai-developer.ps1.example` and `local-ai-developer.ps1.example` only as shell profile
examples. Do not place real API keys in committed config files.
