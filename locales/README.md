# Language Packs

User-facing content lives in language packs.

Engineering artifacts remain English-first:

- code,
- technical documentation,
- schemas,
- prompts,
- architecture decisions.

User-facing strings should be loaded from `locales/<locale>/<namespace>.json`.

Initial locales:

- `en` - English,
- `pl` - Polish.

Initial namespaces:

- `report.json` - working report labels and templates,
- `ui.json` - future UI labels.

Language packs should also translate user-facing enum labels, such as severity,
finding categories, flags, and report field names.
