# Prompts

Wersjonowane szablony promptow.

Zasady:

- prompty nie moga prosic modelu o ocene prawdomownosci osoby,
- odpowiedzi modelu powinny miec format strukturalny,
- kazdy prompt powinien miec opis celu i oczekiwanego wyjscia,
- prompty musza wspierac neutralne pytania i human-in-the-loop.

Current prompt files:

- `interview_plan.system.md`
- `followup_questions.system.md`
- `consistency_review.system.md`
- `grounded_followup_questions.system.md`

Grounded prompts should receive a `GroundingContextPack`, not raw unrestricted case notes.
