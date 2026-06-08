# InterrogA(I)tion Frontend App

React + TypeScript + Vite application shell for the local investigative interviewing assistant.

## Requirements

Install Node.js with `npm`, then run:

```powershell
npm install
npm run dev
```

The development server defaults to:

```text
http://127.0.0.1:5173
```

## Local API

Start the backend from `backend/`:

```powershell
python -m interrogaition.api.app
```

The app uses `http://127.0.0.1:8000` by default. You can override it with:

```text
http://127.0.0.1:5173/?api=http://127.0.0.1:8000&case=case-001&session=demo-session&participant=person-001&workspace=case-001-workspace
```

During Vite development, loopback API calls to `127.0.0.1:8000` or `localhost:8000` are routed through the same-origin `/api` proxy. This keeps the embedded browser and strict local browser policies on the happy path without changing the production API URL behavior.

Supported runtime query parameters:

- `api`: local API base URL,
- `case`: synthetic case id,
- `session`: session id to create or resume,
- `participant`: participant id,
- `workspace`: local case workspace id used for security, access, and export-integrity status.

The right insight rail includes a compact security panel backed by the local API. It shows the current workspace, storage mode, encryption runtime status, workspace access decision, and export manifest readiness.

The security rail begins with an environment health report. It summarizes local API
readiness, synthetic fixtures, workspace root status, encryption readiness, and
local model gating with expandable details and remediation text.

The security rail also shows local model runtime readiness. It displays the
configured model, effective provider, live-output gate, runtime restrictions, and a
safe smoke-test button. The smoke check is deterministic by default and does not
send case material or interview notes to a real model.

The same area shows model artifact isolation. It reports whether the workspace has
dedicated prompt, context, output, cache, and evaluation directories under
`models/`, plus a local artifact policy manifest. The UI can initialize this
isolation before real local model experiments.

The model artifact panel also shows the current artifact manifest record count and
the latest artifact type/hash. Artifact content is not manually edited in the UI;
records are intended to be written by controlled model workflows.

The same rail includes a compact case map. It groups topics with question, answer, material, claim, finding, and indicator counts so the operator can see coverage, grounding, and clarification needs without an automated verdict.

The case map also shows an advisory Evidence Alignment Indicator as a gradient bar with a numeric value, band (`insufficient review`, `low`, `medium`, `high`), reviewed/confidence meta, and explanation bullets. It is derived only from human-reviewed material-question links and does not assert truth, guilt, or credibility (see ADR 0017).

The same rail includes a grounded AI panel. It calls the local
`/grounded-suggestions` endpoint for the active question and shows suggested
follow-up questions, topic gaps, potential inconsistencies, and summaries with
their reasons, source ids, model id, prompt version, citation warnings, and compact
grounded-suggestion artifact ids/hashes when the backend captured context/output
artifacts.
Each suggestion has `use`, `edit`, and `reject` controls. Online decisions are
recorded through the backend append-only audit chain with the original text,
final operator text, source ids, model id, prompt version, and context/output
hashes. Offline decisions remain local demo state only.

The same rail includes a case-material register for synthetic text materials. It can create a controlled workspace material record, list registered materials, show size/hash metadata, and call backend verification for each record.

Each material card can open a bounded text preview through the local API. The preview shows line/character counts and indicates when the backend truncated long material text.

Registered materials are also linked deterministically to interview questions through shared topic signals. The active question shows linked materials, and each material card shows linked question ids with confidence values.

Material cards also expose compact accept/reject controls and matched-term audit
details for each material-question link. Online decisions are recorded through the
backend audit chain; offline decisions remain local demo state.

## Scripts

- `npm run dev` - local Vite server,
- `npm run build` - TypeScript check and production build,
- `npm run preview` - preview production build,
- `npm run typecheck` - TypeScript check only.
