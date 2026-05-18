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

FastAPI dependencies are currently installed into the local `.deps/` directory for the development prototype.
If `.deps/` contains stale packages, use `.deps_stable/`.

In restricted sandbox environments, package directories created by an escalated install may not be readable. The API module includes a minimal fallback router for tests in that situation. Normal development should use real FastAPI.

From repository root:

```powershell
python -m pip install --target .deps_stable fastapi==0.115.12 uvicorn==0.30.6
```

From `backend/`:

```powershell
python -m interigaition.api.app
```

If you run Uvicorn directly from the repository root, expose local dependencies:

```powershell
$env:PYTHONPATH=".deps_stable;backend"
python -m uvicorn interigaition.api.app:app --reload
```
