# ADR 0001: Stos technologiczny MVP

## Status

Accepted for MVP.

## Kontekst

Projekt laczy AI, psychologie przesluchaniowa, informatyke sledcza i potencjalne wdrozenie w instytucjach publicznych. Potrzebujemy technologii, ktora pozwoli szybko prototypowac, a jednoczesnie nie zamknie drogi do bezpiecznego wdrozenia lokalnego.

## Decyzja

W MVP stosujemy:

- Python dla domeny, analizy i AI,
- FastAPI dla lokalnego API,
- React + TypeScript + Vite dla UI,
- Ollama jako pierwszy lokalny runtime LLM,
- SQLite jako pierwszy storage,
- SQLCipher jako kierunek szyfrowania,
- Tauri jako pozniejszy wrapper desktopowy.

## Konsekwencje pozytywne

- szybkie prototypowanie,
- dobra testowalnosc,
- czytelne kontrakty danych,
- jasny podzial komponentow,
- latwe opisanie w pracy magisterskiej,
- mozliwosc przyszlej migracji krytycznych komponentow.

## Konsekwencje negatywne

- wiecej niz jedna technologia w projekcie,
- docelowo trzeba spiac Python backend z aplikacja desktopowa,
- czesc zabezpieczen bedzie musiala dojrzec po MVP,
- Tauri wymaga pozniej podstaw Rust/toolchain.

## Alternatywy odrzucone na start

- wszystko w Pythonie: szybsze teraz, slabsze UI i packaging,
- Electron od razu: wiekszy narzut,
- Rust od razu: za wolne badawczo,
- LangChain jako rdzen: zbyt duza nieprzezroczystosc na etap audytowalnego prototypu,
- chmurowe LLM-y: sprzeczne z zalozeniem lokalnosci.

