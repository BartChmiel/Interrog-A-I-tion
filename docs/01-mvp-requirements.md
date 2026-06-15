# MVP Requirements

## Objective

Build a local research prototype that demonstrates AI-assisted investigative interviewing using synthetic data only.

The MVP must be testable, auditable, and clear enough to support academic evaluation and future product development.

## Functional Requirements

- Load a synthetic case.
- Display planned questions and topic structure.
- Start or resume a live interview session.
- Record answers and notes.
- Track topic coverage and evidence alignment.
- Register controlled source materials in a workspace.
- Link materials to interview questions.
- Generate grounded follow-up suggestions.
- Allow the operator to accept, edit, or reject AI suggestions.
- Export a working report.
- Preserve audit and model provenance records.

## AI Requirements

- Use a model-client abstraction.
- Keep deterministic fake-model behavior available for tests.
- Validate structured AI output.
- Validate source citations against the grounding context.
- Keep AI suggestions advisory and human-controlled.
- Avoid automated guilt, truthfulness, or legal reliability verdicts.

## Security Requirements

- Work locally by default.
- Use synthetic data for repository fixtures.
- Keep workspace files inside a case workspace boundary.
- Maintain append-only audit records.
- Maintain workspace-local model artifact manifests.
- Use export integrity manifests for report outputs.
- Block non-synthetic material unless encrypted storage is explicitly available.

## UI Requirements

- Support English and Polish user-facing copy.
- Keep engineering documentation and source code English-first.
- Show operational views directly; avoid marketing-style landing screens.
- Prefer dense, readable, professional interfaces for repeated investigative work.
- Keep AI provenance visible without overwhelming the operator.

## Out of Scope for MVP

- Real police or prosecution data.
- Cloud model use on sensitive case material.
- Official procedural report generation.
- Automated credibility verdicts.
- Desktop packaging.
- Production deployment.
