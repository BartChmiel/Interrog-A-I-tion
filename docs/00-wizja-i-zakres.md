# Wizja i zakres

## Problem

Osoba prowadzaca przesluchanie musi jednoczesnie sluchac, zadawac pytania, pilnowac protokolu, kontrolowac watki sprawy i reagowac na niespojnosci. To obciaza poznawczo i zwieksza ryzyko pominiecia istotnego tematu.

Projekt zaklada stworzenie lokalnego, bezpiecznego narzedzia, ktore wspiera przygotowanie i prowadzenie przesluchania, a takze porzadkuje material po czynnosci.

## Wybrana wizja produktu

Przyjmujemy wariant 2: asystent przesluchania z kontrola spojnosci.

System ma laczyc trzy perspektywy:

- informatyke sledcza: bezpieczne przetwarzanie materialow, audyt, integralnosc danych i praca lokalna,
- AI: generowanie pytan, streszczanie, analiza luk, RAG i kontrolowane sugestie,
- psychologie przesluchaniowa: neutralnosc, budowanie relacji, wolna narracja, unikanie presji i pytan sugerujacych.

Docelowo ma to byc produkt, ktory moglby dojrzewac w kierunku uzycia instytucjonalnego, ale pierwsza wersja ma pozostac prototypem badawczym.

## Cel produktu

Celem aplikacji jest pomoc w:

- przygotowaniu scenariusza pytan na podstawie wstepnego opisu sprawy,
- prowadzeniu notatek i protokolu w jednym miejscu,
- sledzeniu pokrycia kluczowych tematow,
- sugerowaniu pytan doprecyzowujacych,
- sugerowaniu pytan kontrolnych dotyczacych tej samej informacji ujetych inaczej,
- oznaczaniu potencjalnych niespojnosci i luk w narracji,
- tworzeniu audytowalnego zapisu pracy z AI.

## Hipoteza produktowa

Jesli przesluchujacy dostaje lokalne narzedzie, ktore porzadkuje pytania, watki, odpowiedzi i sugestie AI, to moze prowadzic czynnosci bardziej metodycznie, z mniejszym ryzykiem pominiecia tematow i z lepszym sladem audytowym.

System ma poprawiac jakosc procesu, a nie "automatycznie wykrywac klamstwo".

## Czego system nie robi

System nie powinien:

- wydawac werdyktu, czy osoba mowi prawde,
- automatycznie klasyfikowac kogos jako wiarygodnego lub niewiarygodnego,
- zastepowac przesluchujacego,
- ukrywac powodow, dla ktorych zasugerowal pytanie,
- wysylac danych do zewnetrznych uslug,
- podejmowac decyzji procesowych.

## Uzytkownicy

Pierwsze grupy uzytkownikow do rozpatrzenia:

- przesluchujacy,
- biegly lub konsultant analizujacy material,
- promotor/recenzent oceniajacy prototyp badawczy,
- administrator bezpieczenstwa systemu.

## Glowne scenariusze

1. Przygotowanie planu przesluchania
   - uzytkownik wprowadza opis sprawy i materialy,
   - AI proponuje watki, cele i pytania,
   - uzytkownik zatwierdza lub poprawia plan.

2. Prowadzenie przesluchania
   - uzytkownik notuje odpowiedzi przy pytaniach,
   - system pilnuje tematow i luk,
   - AI proponuje neutralne pytania follow-up.

3. Analiza po czynnosci
   - system wskazuje niespojnosci i braki,
   - tworzy raport roboczy,
   - zachowuje pelny audit trail pracy czlowieka i AI.

## MVP

Pierwsza wersja powinna byc ograniczona do:

- lokalnego workspace sprawy,
- edytora planu pytan,
- edytora notatek z przesluchania,
- lokalnych sugestii AI,
- oznaczania tematow i luk,
- eksportu raportu roboczego,
- dziennika audytu.

## Kryterium sukcesu

MVP jest udane, jesli na syntetycznej sprawie mozna:

- przygotowac plan pytan,
- przeprowadzic symulowane przesluchanie,
- otrzymac sensowne pytania doprecyzowujace,
- zobaczyc mape pokrycia tematow,
- wskazac potencjalne niespojnosci,
- wyeksportowac raport z audytem.
