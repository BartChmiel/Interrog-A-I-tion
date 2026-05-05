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

- `interigaition/domain` - encje i logika domenowa,
- `interigaition/ai` - adaptery modeli i guardrails,
- `interigaition/analysis` - analiza tematow, luk i spojnosci,
- `interigaition/storage` - zapis i odczyt spraw,
- `interigaition/security` - szyfrowanie i integralnosc,
- `interigaition/export` - raporty,
- `interigaition/api` - lokalne endpointy.

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

