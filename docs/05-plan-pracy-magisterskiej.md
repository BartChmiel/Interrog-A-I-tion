# Plan pracy magisterskiej

## Roboczy tytul

Lokalny system AI wspierajacy przygotowanie, prowadzenie i analize spojnosci przesluchan w kontekscie informatyki sledczej.

## Problem badawczy

Czy lokalny system AI moze zwiekszyc kompletnosc, spojnosc i audytowalnosc procesu przygotowania oraz dokumentowania przesluchania, zachowujac wymagania prywatnosci, bezpieczenstwa danych i neutralnosci metodycznej?

## Pytania badawcze

1. Czy AI pomaga przygotowac bardziej kompletna liste pytan niz praca bez wsparcia narzedzia?
2. Czy system pomaga wykrywac luki tematyczne w notatkach z przesluchania?
3. Czy lokalny model moze generowac uzyteczne pytania doprecyzowujace bez wysylania danych do chmury?
4. Jakie zabezpieczenia sa konieczne, aby taki system byl sensowny w kontekście danych wrazliwych?
5. Jak ograniczyc ryzyko nadmiernego zaufania do sugestii AI?
6. Czy system moze wspierac neutralne techniki investigative interviewing bez automatycznego oceniania osoby?

## Hipotezy robocze

- H1: Narzedzie zwiekszy pokrycie tematow wskazanych w protokole sprawy.
- H2: Narzedzie skroci czas przygotowania pierwszego planu pytan.
- H3: Lokalne modele beda wystarczajace do generowania pytan pomocniczych, ale beda wymagaly walidacji i ograniczen promptow.
- H4: Jawny audyt sugestii AI zmniejszy ryzyko niekontrolowanego wplywu modelu na dokumentacje.
- H5: Guardrails ograniczajace pytania sugerujace zwieksza jakosc metodyczna wygenerowanych pytan.

## Rozdzialy pracy

1. Wprowadzenie i motywacja.
2. Informatyka sledcza, dokumentowanie czynnosci i wymagania dowodowe.
3. AI lokalne, modele jezykowe i RAG w systemach wrazliwych.
4. Psychologiczne i etyczne granice wspomagania przesluchan.
5. Projekt systemu.
6. Implementacja prototypu.
7. Ewaluacja.
8. Wnioski i ograniczenia.

## Zakres prototypu

Prototyp powinien obejmowac:

- model sprawy,
- plan pytan,
- tryb notowania przesluchania,
- lokalna generacje pytan,
- walidacje neutralnosci pytania,
- analize pokrycia tematow,
- analize potencjalnych niespojnosci,
- raport z audytem.

Prototyp nie powinien obejmowac:

- oceny prawdomownosci osoby,
- automatycznego scoringu podejrzanego lub swiadka,
- integracji z rzeczywistymi systemami policyjnymi,
- pracy na jawnych danych rzeczywistych bez procedur uczelni i instytucji.

## Artefakty

- prototyp aplikacji,
- dokumentacja architektury,
- model zagrozen,
- zestaw scenariuszy testowych,
- raport ewaluacyjny,
- przykladowe zanonimizowane lub syntetyczne sprawy.
