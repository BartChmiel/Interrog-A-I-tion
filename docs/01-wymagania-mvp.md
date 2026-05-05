# Wymagania MVP

## Funkcje podstawowe

1. Tworzenie sprawy
   - nazwa lub sygnatura robocza,
   - typ sprawy,
   - lista uczestnikow,
   - opis wstepny,
   - zalaczone materialy tekstowe.

2. Przygotowanie przesluchania
   - reczne tworzenie listy pytan,
   - generowanie propozycji pytan przez lokalny model,
   - grupowanie pytan wedlug tematow,
   - oznaczanie pytan jako obowiazkowe, pomocnicze, kontrolne lub follow-up,
   - ocena neutralnosci pytania przed uzyciem.

3. Tryb przesluchania
   - szybkie notowanie odpowiedzi,
   - przypisywanie odpowiedzi do pytan i tematow,
   - oznaczanie fragmentow jako istotne, niejasne, sprzeczne lub do weryfikacji,
   - sugestie dodatkowych pytan na podstawie dotychczasowych odpowiedzi,
   - oznaczenie, czy pytanie pochodzi z planu, od uzytkownika czy z AI.

4. Analiza po przesluchaniu
   - mapa pokrycia tematow,
   - lista luk,
   - lista potencjalnych niespojnosci,
   - zestaw pytan do kolejnej czynnosci,
   - eksport raportu.

5. Audyt
   - zapis, kiedy AI wygenerowalo sugestie,
   - zapis, ktore sugestie zaakceptowano, zmieniono lub odrzucono,
   - oznaczenie, czy fragment pochodzi od uzytkownika czy od modelu.

## Funkcje psychologiczno-metodyczne

1. Wsparcie modelu PEACE
   - planning and preparation,
   - engage and explain,
   - account, clarification and challenge,
   - closure,
   - evaluation.

2. Wsparcie pytan neutralnych
   - preferowanie pytan otwartych,
   - oznaczanie pytan potencjalnie sugerujacych,
   - proponowanie bezpieczniejszej wersji pytania.

3. Cross-validacja narracyjna
   - sprawdzanie czasu,
   - sprawdzanie miejsc,
   - sprawdzanie kolejnosci zdarzen,
   - sprawdzanie zrodel wiedzy,
   - sprawdzanie relacji miedzy wypowiedzia a materialem sprawy.

4. Ograniczenia interpretacyjne
   - brak diagnoz psychologicznych,
   - brak werdyktow o klamstwie,
   - brak scoringu osoby,
   - tylko opis materialu i procesu.

## Wymagania niefunkcjonalne

- pelne dzialanie lokalne,
- brak domyslnej telemetrii,
- szyfrowanie danych na dysku,
- mozliwosc pracy offline,
- czytelny interfejs do dlugiej pracy,
- niskie ryzyko utraty danych podczas przesluchania,
- proste eksporty do formatow mozliwych do oceny akademickiej.

## Minimalne role

- badacz: pracuje na danych syntetycznych i zanonimizowanych,
- przesluchujacy: prowadzi sprawe i zatwierdza sugestie,
- administrator: zarzadza konfiguracja, modelami i dostepem,
- audytor: odczytuje raporty i slad dzialan bez zmiany materialu.

## Poza MVP

Na pozniej:

- transkrypcja audio,
- rozpoznawanie mowcow,
- integracja z systemami kancelaryjnymi,
- wielostanowiskowosc,
- zaawansowana analiza lingwistyczna,
- automatyczne porownywanie wielu przesluchan.
