# ADR 0003: Product direction and credibility indicators

## Status

Accepted.

## Context

The project is intended to combine a master thesis with a real product direction for police and prosecution use. The tool should support live interviews, not only offline post-analysis. Credibility scoring is considered strategically important, but it is also legally, ethically, and socially high-risk.

## Decision

Build the product as a local, air-gapped, live investigative interviewing assistant for police and prosecution workflows.

Support credibility indicators, but only as governed decision-support outputs:

- no automated guilt decision,
- no automated truthfulness verdict,
- factor-level breakdown,
- evidence links,
- uncertainty display,
- auditability,
- human authority.

## Consequences

Positive:

- aligns the thesis with a serious product path,
- allows strong analytical features,
- keeps the human in control,
- creates a defensible high-risk AI governance story,
- supports future institutional deployment.

Negative:

- more complex than a simple note-taking tool,
- scoring requires careful evaluation,
- black-box outputs are not acceptable as final user-facing explanations,
- legal and psychological validation become central project work,
- UI must communicate uncertainty without confusing users.

## Implementation Direction

Implement deterministic indicators first. Add AI later through a controlled model interface. Treat every high-risk output as auditable from day one.

