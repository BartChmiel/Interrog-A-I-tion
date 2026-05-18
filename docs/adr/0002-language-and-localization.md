# ADR 0002: English-first repository and localized user content

## Status

Accepted.

## Context

The project may eventually target users in different jurisdictions and institutions. Engineering work should follow common software-development practice and remain accessible to international collaborators. At the same time, case work, UI, reports, and operational language must support local legal and procedural contexts.

## Decision

Use English for engineering artifacts and language packs for user-facing content.

Initial language packs:

- English: `locales/en`,
- Polish: `locales/pl`.

The first runtime selection mechanism is the CLI `--locale` option. The future desktop application should expose language selection during first launch and in settings.

## Consequences

Positive:

- easier international collaboration,
- cleaner codebase,
- less hard-coded UI text,
- easier future expansion to new jurisdictions,
- clearer separation between engineering and operational language.

Negative:

- more structure at the beginning,
- language-pack coverage must be maintained,
- early Polish planning documents need migration to English.

