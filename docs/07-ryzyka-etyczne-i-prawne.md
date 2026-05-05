# Ryzyka etyczne i prawne

## Najwazniejsze ryzyka

1. Automatyzacja oceny wiarygodnosci
   - ryzyko: uzytkownik traktuje wskaznik jako prawde,
   - ograniczenie: wskazniki opisowe, brak werdyktow, widoczne uzasadnienia.

2. Sugestywne pytania
   - ryzyko: AI generuje pytania naprowadzajace,
   - ograniczenie: filtr neutralnosci pytan i wymog zatwierdzenia przez czlowieka.

3. Wplyw AI na protokol
   - ryzyko: tresc AI miesza sie z trescia wypowiedzi,
   - ograniczenie: jasne oznaczanie zrodel tekstu.

4. Dane wrazliwe
   - ryzyko: wyciek materialow sprawy,
   - ograniczenie: lokalnosc, szyfrowanie, brak telemetrii, kontrolowany eksport.

5. Brak walidacji psychologicznej
   - ryzyko: system sugeruje zbyt mocne interpretacje,
   - ograniczenie: jezyk ostrozny, ewaluacja ekspercka, zakaz klasyfikowania osoby.

## Zasady projektowe

- Czlowiek podejmuje decyzje.
- AI jest widocznym narzedziem, nie ukrytym autorem.
- Kazda sugestia musi byc audytowalna.
- Wskazniki sa opisowe i niewiazace.
- Dane nie opuszczaja kontrolowanego srodowiska.
- System preferuje pytania neutralne i doprecyzowujace.

## Formulacje bezpieczne

Lepsze:

- "fragment wymaga doprecyzowania",
- "odpowiedz rozni sie od wczesniejszej w zakresie czasu",
- "temat nie zostal jeszcze pokryty pytaniami",
- "model proponuje neutralne pytanie follow-up".

Gorsze:

- "osoba klamie",
- "niska wiarygodnosc psychologiczna",
- "AI wykrylo manipulacje",
- "system ustalil prawde".

