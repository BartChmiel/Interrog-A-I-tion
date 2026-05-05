# Architektura lokalna

## Zalozenie

Aplikacja ma dzialac lokalnie, bez wysylania materialow sprawy do chmury. Model AI, baza danych, indeks wyszukiwania i pliki sprawy powinny znajdowac sie na kontrolowanym urzadzeniu lub w kontrolowanym srodowisku lokalnym.

## Moduly

1. Interfejs aplikacji
   - lista spraw,
   - edytor planu pytan,
   - tryb przesluchania,
   - widok analizy i raportu,
   - widok audytu sugestii AI.

2. Magazyn spraw
   - metadane sprawy,
   - pytania,
   - odpowiedzi,
   - notatki,
   - zalaczniki,
   - dziennik audytu.

3. Warstwa AI
   - lokalny model jezykowy,
   - lokalny system RAG dla dokumentow sprawy,
   - szablony promptow,
   - walidator odpowiedzi modelu,
   - guardrails blokujace werdykty o klamstwie i presje na wynik.

4. Analiza przesluchania
   - ekstrakcja tematow,
   - macierz pytanie-odpowiedz-temat,
   - detekcja luk,
   - detekcja potencjalnych sprzecznosci,
   - wskazniki pokrycia i spojnosci,
   - klasyfikacja pytan wedlug neutralnosci i funkcji metodycznej.

5. Bezpieczenstwo
   - szyfrowanie,
   - kontrola dostepu,
   - audyt zdarzen,
   - eksport z suma kontrolna,
   - tryb anonimizacji danych do badan.

## Proponowany stos technologiczny

Wersja badawcza powinna byc mozliwie prosta, ale nie zamykac drogi do wdrozenia instytucjonalnego:

- logika domenowa i AI: Python,
- lokalne API: FastAPI,
- interfejs: React + TypeScript + Vite,
- desktop w pozniejszym etapie: Tauri,
- baza lokalna: SQLite, docelowo SQLCipher albo rownowazne szyfrowanie,
- wyszukiwanie/RAG: najpierw proste wyszukiwanie lokalne, potem Qdrant Local albo Chroma,
- modele: Ollama w MVP, adaptery pod llama.cpp albo vLLM w przyszlosci,
- eksport: JSON, Markdown/HTML, pozniej PDF i DOCX.

Szczegoly decyzji sa opisane w [Stos technologiczny](14-stos-technologiczny.md).

## Proponowany podzial kodu

- `domain` - pojecia sprawy, pytan, odpowiedzi, tematow i audytu,
- `ai` - adaptery modeli, prompty, walidacja odpowiedzi,
- `analysis` - pokrycie tematow, spojnosc, luki, neutralnosc pytan,
- `storage` - lokalny magazyn danych,
- `security` - szyfrowanie, kontrola dostepu, integralnosc,
- `export` - raporty i formaty wymiany,
- `api` - lokalne endpointy aplikacji.

## Granice zaufania

Najwazniejsze granice:

- uzytkownik aplikacji,
- lokalny proces aplikacji,
- lokalny model AI,
- zaszyfrowany magazyn danych,
- eksporty i kopie zapasowe.

Kazde przejscie danych przez granice powinno byc jawne, logowane i mozliwe do uzasadnienia.

## Tryby pracy

1. Tryb badawczy
   - dane syntetyczne,
   - uproszczone logowanie,
   - latwe uruchamianie lokalne,
   - szybka ewaluacja.

2. Tryb bezpieczny
   - praca offline,
   - szyfrowanie,
   - brak telemetrii,
   - audyt i kontrola eksportu.

3. Tryb instytucjonalny
   - role,
   - centralne zarzadzanie konfiguracja,
   - proces aktualizacji modeli,
   - formalna ocena ryzyka i zgodnosci.
