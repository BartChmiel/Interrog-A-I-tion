# Stos technologiczny

## Decyzja glowna

Projekt dzielimy na komponenty. Nie robimy wszystkiego w jednym jezyku, bo system ma laczyc badania, AI, bezpieczenstwo, UI i przyszle wdrozenie instytucjonalne.

Rekomendowany stos dla MVP:

- core i backend: Python 3.11+,
- lokalne API: FastAPI,
- modele danych API: Pydantic w warstwie API, dataclasses w domenie,
- UI: React + TypeScript + Vite,
- desktop: Tauri dopiero po ustabilizowaniu lokalnej aplikacji webowej,
- LLM lokalny: Ollama przez lokalne HTTP API,
- RAG: etapowo, najpierw proste wyszukiwanie i struktury tematow, pozniej Qdrant Local albo Chroma,
- storage: SQLite na danych syntetycznych, docelowo SQLCipher lub rownowazne szyfrowanie,
- testy: unittest teraz, pytest po wprowadzeniu zaleznosci,
- zarzadzanie Pythonem: docelowo uv,
- CI: GitHub Actions po publikacji repo.

## Dlaczego nie sam Python?

Python jest najlepszy dla:

- logiki badawczej,
- prototypowania AI,
- analizy tekstu,
- ewaluacji,
- eksportow,
- testow eksperymentalnych.

Python nie jest najlepszym wyborem dla glownego interfejsu desktopowego. UI w Pythonie bylby szybszy na start, ale slabszy wdrozeniowo i mniej naturalny do nowoczesnego, wieloplatformowego interfejsu. Dlatego UI powinien byc webowy: React + TypeScript, a desktopowe opakowanie przez Tauri.

## Komponenty

### 1. Domena

Technologia: Python dataclasses teraz, Pydantic w API.

Uzasadnienie:

- latwe testowanie,
- proste opisanie w pracy,
- brak zaleznosci od frameworka,
- mozliwosc pozniejszej migracji czesci domeny do Rust/Go, jesli instytucjonalne wdrozenie tego wymaga.

### 2. Backend lokalny

Technologia: FastAPI.

Uzasadnienie:

- standardowe typowanie Pythona,
- OpenAPI i JSON Schema,
- automatyczna dokumentacja API,
- dobry pomost miedzy prototypem badawczym a aplikacja.

Alternatywy:

- Flask: prostszy, ale mniej korzystny dla kontraktow i dokumentacji API.
- Django: za duzy na lokalny prototyp narzedzia.
- Rust backend: ciekawy dla bezpieczenstwa, ale za wolny badawczo na start.

### 3. Frontend

Technologia: React + TypeScript + Vite.

Uzasadnienie:

- komponentowy UI,
- dobre typowanie,
- szybki dev server,
- latwa migracja do Tauri,
- dobry ekosystem dla widokow operacyjnych: formularze, tabele, panele, edytory, raporty.

Alternatywy:

- Svelte: bardzo dobry, ale React bedzie latwiejszy do obrony i znalezienia wsparcia.
- Vue: rownie sensowny, ale React ma wiekszy ekosystem do aplikacji narzedziowych.
- PySide/PyQt: szybkie lokalnie, ale slabsze jako baza dla przyszlej aplikacji web/desktop.

### 4. Desktop

Technologia docelowa: Tauri.

Uzasadnienie:

- aplikacja cross-platform,
- mniejszy narzut niz Electron,
- nacisk na bezpieczenstwo,
- mozliwosc uzycia webowego UI,
- mozliwosc integracji z lokalnym backendem jako sidecar.

Kolejnosc:

1. Najpierw lokalna aplikacja webowa: FastAPI + React.
2. Potem opakowanie desktopowe: Tauri.
3. Na koncu tryb bezpieczny: instalator, konfiguracja offline, storage i klucze.

### 5. AI lokalne

Technologia MVP: Ollama.

Uzasadnienie:

- prosty lokalny runtime,
- lokalne HTTP API,
- oficjalne biblioteki Python/JavaScript,
- szybkie eksperymenty z modelami,
- dobre do pracy magisterskiej i demonstratora.

Alternatywy przyszlosciowe:

- llama.cpp: wieksza kontrola, dobre dla lekkich wdrozen lokalnych,
- vLLM: mocniejsze wdrozenia serwerowe/on-premise,
- LM Studio: dobre narzedzie eksperymentalne, ale mniej wygodne jako backend produktu.

Zasada: kod aplikacji ma uzywac naszego adaptera `ai`, nie bezposrednio konkretnego narzedzia. Dzieki temu mozna podmienic Ollama na llama.cpp albo vLLM.

### 6. RAG i wyszukiwanie

Etap 1:

- wyszukiwanie po tematach,
- proste indeksowanie dokumentow,
- SQLite FTS lub wlasna minimalna warstwa,
- reczne laczenie odpowiedzi z tematami.

Etap 2:

- embeddingi lokalne,
- wektorowy indeks sprawy,
- Qdrant Local albo Chroma.

Rekomendacja: nie zaczynac od duzego frameworka RAG. Najpierw zbudowac czytelny pipeline, ktory da sie opisac i audytowac.

### 7. Dane i szyfrowanie

Technologia MVP:

- SQLite dla danych syntetycznych,
- eksport JSON dla audytu i testow,
- haszowany dziennik zdarzen.

Technologia docelowa:

- SQLCipher albo rownowazne szyfrowanie bazy,
- szyfrowanie zalacznikow osobno,
- klucze zwiazane z profilem uzytkownika lub sprawa,
- kontrolowany eksport.

### 8. Testy i ewaluacja

Technologie:

- unittest teraz,
- pytest po dodaniu zaleznosci,
- JSON Schema validation,
- testy guardrails,
- testy metryk pokrycia tematow,
- scenariusze syntetyczne w `data/synthetic`.

## Czego unikamy na starcie

- LangChain jako glowna warstwa aplikacji: moze zaciemnic audyt i utrudnic opis pracy.
- Nieaudytowalny, automatyczny scoring osoby bez rozbicia na czynniki.
- Chmurowe LLM-y jako domyslna sciezka.
- Zbyt wczesny desktop packaging.
- Mikroserwisy.
- Baza serwerowa, dopoki nie ma realnej potrzeby.

Wskazniki spojnosci, wiarygodnosci materialu i zgodnosci z dowodami moga byc rozwijane, ale musza miec widoczne czynniki, slady audytu i kontrole czlowieka.

## Decyzja dla pierwszej wersji

Pierwsza wersja powinna isc tak:

1. Python domain + analysis.
2. Syntetyczne sprawy.
3. Guardrails i prompty.
4. FastAPI jako lokalne API.
5. React/Vite jako UI.
6. Ollama adapter.
7. SQLite storage.
8. Raport JSON/Markdown.
9. Dopiero potem Tauri.

To daje najlepszy balans: szybka praca magisterska, sensowna inzynieria, droga do instytucjonalnego wdrozenia.

## Zrodla technologiczne

- FastAPI: https://fastapi.tiangolo.com/features/
- React: https://react.dev/learn
- Vite: https://vite.dev/guide/
- Tauri: https://tauri.app/
- Ollama API: https://docs.ollama.com/api/introduction
- SQLite: https://www.sqlite.org/about.html
- SQLCipher: https://www.zetetic.net/sqlcipher/
- Qdrant: https://qdrant.tech/documentation/
- Chroma: https://docs.trychroma.com/
- uv: https://docs.astral.sh/uv/
- pytest: https://docs.pytest.org/en/stable/
