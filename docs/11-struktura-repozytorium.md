# Struktura repozytorium

## Cel struktury

Repozytorium ma obslugiwac jednoczesnie:

- prace magisterska,
- prototyp aplikacji,
- eksperymenty AI,
- ewaluacje,
- przyszly kierunek wdrozeniowy.

## Foldery glowne

- `backend/` - lokalne API i logika systemu,
- `frontend/` - przyszly interfejs aplikacji,
- `prompts/` - szablony promptow,
- `schemas/` - kontrakty danych,
- `research/` - protokoly i materialy badawcze,
- `data/` - dane syntetyczne i lokalne katalogi robocze,
- `tests/` - testy,
- `docs/` - dokumentacja projektu.

## Backend

Proponowany podzial:

- `interrogaition/domain` - encje i logika domenowa,
- `interrogaition/ai` - adaptery modeli i guardrails,
- `interrogaition/analysis` - analiza tematow, luk i spojnosci,
- `interrogaition/storage` - zapis i odczyt spraw,
- `interrogaition/security` - szyfrowanie i integralnosc,
- `interrogaition/export` - raporty,
- `interrogaition/api` - lokalne endpointy.

## Dane

W repozytorium mozna trzymac:

- dane syntetyczne,
- schematy,
- scenariusze testowe,
- zanonimizowane przyklady tylko po formalnej decyzji.

W repozytorium nie wolno trzymac:

- prawdziwych akt,
- danych osobowych,
- nagran przesluchan,
- eksportow prywatnych,
- kluczy i hasel.

## Zasada rozwoju

Najpierw rozwijamy kontrakty danych i logike domenowa, potem UI. Dzieki temu projekt bedzie latwiejszy do testowania, opisania w pracy i rozbudowy.

