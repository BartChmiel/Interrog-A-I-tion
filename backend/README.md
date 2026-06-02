# Backend

Lokalny backend aplikacji InterigA(I)tion.

Docelowo odpowiada za:

- logike domenowa spraw i przesluchan,
- integracje z lokalnym modelem AI,
- analize pokrycia tematow i spojnosci,
- zapis danych,
- szyfrowanie i audyt,
- eksport raportow.

Pierwszy prototyp powinien pozostac prosty: Python, lokalne API i testowalna logika bez zaleznosci od docelowego UI.

## Pierwszy cienki pipeline

Z katalogu `backend/`:

```powershell
python -m interigaition.cli review ..\data\synthetic\case-001\case.json
```

Polish report:

```powershell
python -m interigaition.cli review ..\data\synthetic\case-001\case.json --locale pl
```

Report export with an integrity manifest:

```powershell
python -m interigaition.cli review ..\data\synthetic\case-001\case.json --output ..\test-output\report.md --manifest ..\test-output\manifest.json --created-by investigator-001
python -m interigaition.cli verify-export ..\test-output\manifest.json --root ..\test-output
```

Pipeline:

1. Wczytuje syntetyczna sprawe z JSON.
2. Liczy pokrycie tematow.
3. Oznacza potencjalnie sugerujace pytania.
4. Wykrywa proste konflikty w ustrukturyzowanych twierdzeniach.
5. Generuje raport Markdown.
6. Opcjonalnie zapisuje manifest integralnosci eksportu.

Testy:

```powershell
python -m unittest discover -s ..\tests
```

## Local API prototype

FastAPI dependencies can be installed into the current Python user site for the development prototype. The API module includes a minimal fallback router for tests in restricted environments, but normal development should use real FastAPI and Uvicorn.

From repository root:

```powershell
python -m pip install --user fastapi==0.115.12 uvicorn==0.30.6
```

From `backend/`:

```powershell
python -m interigaition.api.app --help
python -m interigaition.api.app
```

Enable reload explicitly when developing the API:

```powershell
python -m interigaition.api.app --reload
```

The prototype validates live answer payloads before adding them to a session. Empty answers, unknown question ids, unknown topic ids, malformed claims, and duplicate session ids return explicit HTTP errors instead of being accepted silently.

The API also returns `Access-Control-Allow-Private-Network: true` so local browser shells can call the loopback backend during air-gapped development.

Live sessions are persisted in a local SQLite database when the API app is run normally. The default prototype database path is ignored by git:

```text
backend/local-data/interigaition.sqlite3
```

Session start, answer creation, and review refresh events are also written to an append-only audit table with a SHA-256 hash chain. This is an integrity prototype, not encrypted storage. The storage boundary is designed so a later SQLCipher or encrypted-workspace adapter can replace the plain SQLite file.

Markdown exports can be accompanied by an integrity manifest. The manifest stores SHA-256 hashes and sizes for exported files plus a hash of the manifest payload itself.

## Case workspaces

The security package includes a prototype per-case workspace boundary. A workspace has a `workspace.json` manifest and fixed subdirectories for imports, sessions, exports, audit, and model artifacts.

Plain SQLite prototype workspaces are allowed for synthetic material only. Non-synthetic material is blocked unless the workspace declares encrypted storage as required.

Encrypted workspace creation is also blocked until the local SQLite runtime reports SQLCipher support through `PRAGMA cipher_version`. The readiness status is exposed at:

```text
GET /security/encryption
```

The local API exposes prototype workspace creation, manifest loading, and access-policy decisions through:

```text
POST /workspaces
GET /workspaces/{workspace_id}
GET /workspaces/{workspace_id}/access
```

Workspace source materials can also be registered as controlled text records. The prototype stores each material under the workspace `imports/` directory, records metadata in `imports/materials.json`, and verifies SHA-256 plus file size:

```text
GET /workspaces/{workspace_id}/materials
POST /workspaces/{workspace_id}/materials
GET /workspaces/{workspace_id}/materials/links?case_id=case-001
GET /workspaces/{workspace_id}/materials/{material_id}/verification
GET /workspaces/{workspace_id}/evidence-map?case_id=case-001&session_id=demo-session
GET /workspaces/{workspace_id}/grounding-pack?case_id=case-001&session_id=demo-session&question_id=q-001
POST /workspaces/{workspace_id}/grounded-suggestions?case_id=case-001&session_id=demo-session&question_id=q-001
```

The grounded suggestions endpoint is the first live-visible AI workflow. It uses
the current grounding context pack, validates every suggested `linked_evidence`
entry against `allowed_source_ids`, returns citation warnings, and writes an
audit event containing model id, prompt version, context hash, and output hash.
The default runtime is a deterministic fake model so the live workflow can be
tested before connecting a real local model.
