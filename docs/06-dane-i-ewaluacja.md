# Dane i ewaluacja

## Dane

Najbezpieczniejsza kolejnosc pracy z danymi:

1. Dane syntetyczne.
2. Dane publiczne lub edukacyjne.
3. Dane zanonimizowane.
4. Dane rzeczywiste tylko po zgodach, umowach i ustaleniu procedur bezpieczenstwa.

## Procedura dla danych rzeczywistych

Przed praca na danych z prokuratury lub akt nalezy ustalic:

- zakres danych,
- podstawe prawną i zgody,
- sposob anonimizacji,
- miejsce przechowywania,
- kto ma dostep,
- jak usuwane sa dane po badaniu,
- czy mozna uzyc danych do publikacji wynikow,
- czy promotor/uczelnia wymaga komisji etycznej lub dodatkowej zgody.

## Ewaluacja funkcjonalna

Metryki:

- liczba tematow pokrytych pytaniami,
- liczba wygenerowanych pytan ocenionych jako uzyteczne,
- liczba pytan odrzuconych jako sugerujace lub ryzykowne,
- czas przygotowania planu pytan,
- liczba wykrytych luk,
- liczba falszywych alarmow w analizie niespojnosci.

## Ewaluacja psychologiczno-metodyczna

Metryki:

- udzial pytan otwartych,
- liczba pytan sugerujacych,
- liczba pytan neutralizowanych przez system,
- zgodnosc planu z fazami PEACE,
- jakosc pytan follow-up oceniona przez eksperta,
- rozdzielenie wolnej narracji od doprecyzowania i konfrontacji.

## Ewaluacja AI

Metryki:

- trafnosc sugestii pytan,
- uzasadnienie sugestii,
- liczba halucynowanych zalozen,
- liczba sugestii wychodzacych poza material sprawy,
- skutecznosc guardrails,
- powtarzalnosc odpowiedzi przy tej samej sprawie.

## Ewaluacja ekspercka

Mozliwa procedura:

1. Ekspert otrzymuje opis sprawy.
2. Tworzy plan pytan bez narzedzia.
3. Tworzy lub poprawia plan z narzedziem.
4. Drugi ekspert ocenia kompletnosc, neutralnosc i uzytecznosc pytan.
5. Wyniki sa porownywane.

## Zbiory testowe

Repozytorium powinno zawierac tylko dane syntetyczne. Kazdy scenariusz syntetyczny powinien miec:

- opis sprawy,
- liste oczekiwanych tematow,
- plan referencyjny pytan,
- symulowane odpowiedzi,
- celowo dodane luki lub niespojnosci,
- oczekiwany raport systemu.

## Ewaluacja bezpieczenstwa

Do sprawdzenia:

- czy aplikacja wykonuje polaczenia sieciowe,
- czy dane sa zaszyfrowane na dysku,
- czy eksport zawiera metadane,
- czy dziennik audytu pozwala odtworzyc prace z AI,
- czy prompt injection w dokumentach nie wymusza niebezpiecznej odpowiedzi modelu.
