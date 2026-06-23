# ADR 0019: Environment Health Check

## Status

Accepted.

## Context

The prototype now has several local readiness gates: synthetic fixtures, workspace
storage, SQLCipher availability, local model runtime configuration, audit paths, and
frontend/API connectivity. These checks were visible separately, which made it hard
to know whether the current machine is ready for a thesis demo or safe prototype run.

## Decision

Add a deterministic environment health report.

Backend:

- `security/environment_health.py` builds a structured report.
- `GET /environment/health` returns an overall state, per-check states, details,
  remediation text, and summary counts.
- Checks currently cover local API, synthetic case fixtures, workspace root,
  encrypted-storage readiness, and local model runtime gating.
- The endpoint does not run a real model, does not create encrypted workspaces, and
  does not import sensitive data.

Frontend:

- The security rail renders the health report above lower-level security details.
- Each check is expandable so technical remediation remains available without
  overwhelming the operator.

## Consequences

- Workflow readiness is visible in one place.
- Missing synthetic fixtures or local-data problems become obvious early.
- SQLCipher absence remains a warning for synthetic prototype work, not a blocker.
- Real-model live output remains separately blocked by the local model runtime gate.
- Future checks can add installer, artifact cache, signed-export, and offline-mode
  readiness without changing the rest of the workflow.
