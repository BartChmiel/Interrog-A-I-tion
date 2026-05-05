# InterigA(I)tion

Lokalny, audytowalny asystent przesluchania z kontrola spojnosci narracji, pokrycia tematow i jakosci pytan.

Projekt jest pomyslany jako system pomocniczy dla osoby prowadzacej czynnosci, a nie jako automatyczny oceniacz prawdomownosci. AI ma pomagac w:

- przygotowaniu planu pytan na podstawie materialow sprawy,
- notowaniu i porzadkowaniu przebiegu przesluchania,
- sugerowaniu pytan doprecyzowujacych oraz sprawdzajacych spojnosc narracji,
- wspieraniu neutralnych, metodycznych technik rozmowy sledczej,
- wskazywaniu luk tematycznych, sprzecznosci i miejsc wymagajacych weryfikacji,
- tworzeniu roboczych, niewiazacych wskaznikow pokrycia tematu i spojnosci.

## Zasada glowna

System nie stwierdza, czy osoba klamie. System moze jedynie wskazywac obserwowalne cechy materialu, takie jak niespojnosc odpowiedzi, brak odpowiedzi, zmiana szczegolu, luka czasowa albo temat niepokryty pytaniami. Interpretacja pozostaje po stronie czlowieka.

## Wybrany wariant

Projekt rozwijamy jako wariant 2: asystent przesluchania z kontrola spojnosci.

Wersja magisterska ma pokazac prototyp, ktory:

- wspiera planowanie przesluchania,
- pomaga prowadzic notatki i pytania w toku czynnosci,
- sugeruje neutralne pytania follow-up,
- analizuje pokrycie tematow,
- wykrywa potencjalne niespojnosci narracyjne,
- generuje raport roboczy wraz ze sladem audytowym.

Architektura ma jednak od poczatku zakladac przyszly wariant instytucjonalny: lokalne dzialanie, szyfrowanie, role, audyt, ewaluacje i zgodnosc z regulacjami dotyczacymi AI oraz danych w organach scigania.

## Dokumentacja

- [Wizja i zakres](docs/00-wizja-i-zakres.md)
- [Wymagania MVP](docs/01-wymagania-mvp.md)
- [Architektura lokalna](docs/02-architektura-lokalna.md)
- [Bezpieczenstwo i prywatnosc](docs/03-bezpieczenstwo-i-prywatnosc.md)
- [Metodyka przesluchania i AI](docs/04-metodyka-przesluchania-i-ai.md)
- [Plan pracy magisterskiej](docs/05-plan-pracy-magisterskiej.md)
- [Dane i ewaluacja](docs/06-dane-i-ewaluacja.md)
- [Ryzyka etyczne i prawne](docs/07-ryzyka-etyczne-i-prawne.md)
- [Wariant 2 i roadmapa](docs/08-wariant-2-roadmapa.md)
- [Psychologia przesluchaniowa](docs/09-psychologia-przesluchaniowa.md)
- [AI, prompty i guardrails](docs/10-ai-prompty-i-guardrails.md)
- [Struktura repozytorium](docs/11-struktura-repozytorium.md)
- [Slownik pojec](docs/12-slownik-pojec.md)
- [Zrodla startowe](docs/13-zrodla-startowe.md)
- [Stos technologiczny](docs/14-stos-technologiczny.md)
- [Publikacja na GitHub](docs/15-publikacja-github.md)

## Proponowane etapy

1. Doprecyzowanie zakresu badawczego i prawnego.
2. Projekt MVP bez danych wrazliwych.
3. Lokalny prototyp z szyfrowanym magazynem spraw.
4. Modul AI do generowania planu pytan i pytan follow-up.
5. Modul analizy pokrycia tematow i spojnosci odpowiedzi.
6. Ewaluacja na danych syntetycznych, potem na danych zanonimizowanych.

## Struktura kodu

- `backend/` - lokalne API, logika domenowa, analiza, storage, AI i eksport.
- `frontend/` - przyszly interfejs aplikacji.
- `prompts/` - wersjonowane szablony promptow i instrukcje modeli.
- `schemas/` - kontrakty danych w JSON Schema.
- `research/` - protokoly badawcze, scenariusze ewaluacyjne i notatki.
- `data/synthetic/` - dane syntetyczne dopuszczalne do pracy w repo.
- `tests/` - testy jednostkowe, integracyjne i ewaluacyjne.
