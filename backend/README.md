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
