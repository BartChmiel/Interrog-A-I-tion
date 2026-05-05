# Bezpieczenstwo i prywatnosc

## Priorytety

Projekt dotyczy potencjalnie bardzo wrazliwych danych, dlatego bezpieczenstwo nie jest dodatkiem, tylko czescia glownej funkcji systemu.

Priorytety:

- lokalne przetwarzanie,
- minimalizacja danych,
- szyfrowanie w spoczynku,
- kontrolowany eksport,
- audytowalnosc,
- anonimizacja do badan,
- odtwarzalnosc dzialan AI.

## Dane

Mozliwe kategorie danych:

- opis sprawy,
- dane osobowe uczestnikow,
- tresc pytan i odpowiedzi,
- notatki sluzbowe,
- dokumenty z akt,
- metadane czasu i autora,
- sugestie AI,
- decyzje uzytkownika wobec sugestii AI.

## Minimalny model zabezpieczen

1. Szyfrowanie spraw na dysku.
2. Oddzielne klucze dla spraw albo dla profilu uzytkownika.
3. Haslo lub systemowy mechanizm logowania.
4. Brak zewnetrznych requestow sieciowych w trybie bezpiecznym.
5. Dziennik audytu odporny na przypadkowa edycje.
6. Eksport z metadanymi: kto, kiedy, z czego wygenerowal.
7. Funkcja anonimizacji/pseudonimizacji danych badawczych.

## Ryzyka

- przypadkowy wyciek przez model lub logi,
- prompt injection w dokumentach sprawy,
- nadmierne zaufanie do sugestii AI,
- brak rozroznienia tekstu AI od tekstu czlowieka,
- trudnosc usuniecia danych z kopii zapasowych,
- niejawna telemetria bibliotek lub modeli.

## Zasada projektowa

Kazda sugestia AI powinna byc:

- oznaczona jako sugestia,
- uzasadniona,
- mozliwa do odrzucenia,
- zapisana w audycie,
- odseparowana od oficjalnego protokolu, dopoki czlowiek jej nie zatwierdzi.

