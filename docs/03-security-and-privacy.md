# Security and Privacy

## Security Position

The project is local-first. Sensitive case material must not leave the controlled local environment by default.

The prototype is not yet approved for operational or sensitive-data use. Repository fixtures must remain synthetic.

## Core Controls

- Per-case workspace boundaries.
- Synthetic-data-only repository fixtures.
- Explicit storage mode for workspaces.
- Encrypted-storage gate before non-synthetic material.
- Append-only audit chain.
- Hash-chained model artifact manifest.
- Export integrity manifest.
- Model runtime gating.
- Human approval for AI suggestions.

## Data Classification

Supported workspace sensitivity levels:

- `synthetic`,
- `anonymized`,
- `sensitive`.

Plain SQLite prototype storage is permitted only for synthetic material.

## External Processing

External model or service calls must remain disabled by default. Any future bridge to commercial models must pass through:

- explicit runtime mode,
- context minimization,
- anonymization or pseudonymization gateway,
- provenance capture,
- operator approval,
- legal and data-protection review.

## Auditability

The system should preserve:

- who initiated an action,
- what object was affected,
- model id and prompt version where applicable,
- prompt/context/output hashes,
- artifact ids and record hashes,
- human accept/edit/reject decisions.

## Privacy Boundary

The system should collect and expose the minimum information needed for the task. It should avoid hidden profiling, automated person-level verdicts, and unnecessary data replication.
