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

Pipeline:

1. Wczytuje syntetyczna sprawe z JSON.
2. Liczy pokrycie tematow.
3. Oznacza potencjalnie sugerujace pytania.
4. Wykrywa proste konflikty w ustrukturyzowanych twierdzeniach.
5. Generuje raport Markdown.

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

## Case workspaces

The security package includes a prototype per-case workspace boundary. A workspace has a `workspace.json` manifest and fixed subdirectories for imports, sessions, exports, audit, and model artifacts.

Plain SQLite prototype workspaces are allowed for synthetic material only. Non-synthetic material is blocked unless the workspace declares encrypted storage as required.

The local API exposes prototype workspace creation, manifest loading, and access-policy decisions through:

```text
POST /workspaces
GET /workspaces/{workspace_id}
GET /workspaces/{workspace_id}/access
```
