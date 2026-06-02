# Synthetic case 001

Pierwszy scenariusz syntetyczny.

Cel:

- przetestowac plan pytan,
- sprawdzic pokrycie tematow,
- dodac jedna luke chronologiczna,
- dodac jedna potencjalna niespojnosc dotyczaca miejsca albo czasu.

## Zawartosc

Plik `case.json` opisuje syntetyczna rozmowe dotyczaca kradziezy roweru.

Scenariusz zawiera celowo:

- niepokryty temat potencjalnego nagrania,
- jedno pytanie potencjalnie sugerujace,
- jedna potencjalna niespojnosc czasu: `19:45` vs `20:10`.

## Uruchomienie analizy

Z katalogu `backend/`:

```powershell
python -m interrogaition.cli review ..\data\synthetic\case-001\case.json
```
