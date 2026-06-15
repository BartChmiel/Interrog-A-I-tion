# Prompts

Versioned prompt templates.

Rules:

- prompts must not ask the model to judge truthfulness,
- model responses should use structured output,
- each prompt should describe its task and expected output,
- prompts must support neutral questions and human-in-the-loop review.

Current prompt files:

- `interview_plan.system.md`
- `followup_questions.system.md`
- `consistency_review.system.md`
- `grounded_followup_questions.system.md`

Grounded prompts should receive a `GroundingContextPack`, not raw unrestricted case notes.
