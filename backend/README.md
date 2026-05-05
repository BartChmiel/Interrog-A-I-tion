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
