# Language and Localization

## Decision

The repository is English-first for engineering work.

This includes:

- code,
- comments,
- commit messages,
- schemas,
- prompts,
- tests,
- architecture decisions,
- technical documentation.

User-facing content is localized through language packs.

## Supported Locales

Initial locales:

- `en` - English,
- `pl` - Polish.

Future locales should be added as separate language packs, not by hard-coding strings in code.

## What Should Be Localized

Localized:

- UI labels,
- startup language selection,
- report templates,
- case template labels and descriptions,
- user-facing warnings,
- help text,
- export labels.

Not localized:

- internal module names,
- code comments,
- schema field names,
- prompt file names,
- test names,
- architecture records.

Actual evidence, notes, and interview answers should not be automatically translated by default. They should remain in the language in which they were collected, unless an explicit translation workflow is added and audited.

## Runtime Selection

For the CLI prototype, language is selected with:

```powershell
python -m interigaition.cli review ..\data\synthetic\case-001\case.json --locale pl
```

In the future desktop app, language can be selected:

- during first launch,
- in user settings,
- from an organization policy file,
- from the operating system locale as a fallback.

## Installable Application Direction

The expected path is:

1. Local web prototype: FastAPI + React.
2. Language packs used by both backend reports and frontend UI.
3. Tauri desktop wrapper.
4. Installer with default language selection.
5. Organization-managed configuration for institutional deployments.

## Rule

No user-facing string should be added directly to code once the relevant language-pack namespace exists.
