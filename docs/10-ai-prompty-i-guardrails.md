# AI, prompty i guardrails

## Rola AI

AI w projekcie jest asystentem procesu. Ma generowac propozycje, streszczenia i oznaczenia wymagajace weryfikacji przez czlowieka.

AI nie jest:

- przesluchujacym,
- bieglym psychologiem,
- sedzia,
- wykrywaczem klamstwa,
- autorem oficjalnego protokolu.

## Glowne zadania AI

1. Przygotowanie planu pytan
   - identyfikacja tematow,
   - propozycja pytan otwartych,
   - propozycja pytan doprecyzowujacych,
   - oznaczenie priorytetow.

2. Wsparcie w toku przesluchania
   - sugestie follow-up,
   - wykrywanie niepokrytych tematow,
   - przepisywanie pytan na bardziej neutralne,
   - streszczenie aktualnego watku.

3. Analiza po czynnosci
   - lista luk,
   - lista potencjalnych niespojnosci,
   - mapa tematow,
   - raport roboczy.

## Guardrails tresci

Model nie moze generowac:

- werdyktow o klamstwie,
- stwierdzen o winie,
- diagnoz psychologicznych,
- sugestii nacisku lub manipulacji,
- pytan opartych na stereotypach,
- oficjalnych ustalen procesowych bez oznaczenia ich jako robocze.

## Guardrails procesu

Kazda odpowiedz AI dotyczaca istotnej decyzji analitycznej powinna miec:

- typ sugestii,
- uzasadnienie,
- poziom pewnosci,
- powiazanie z materialem sprawy,
- ostrzezenie, jesli model wychodzi poza material,
- slad audytowy.

W trybie live nie kazda drobna podpowiedz musi wymagac formalnego klikniecia "zaakceptuj/odrzuc". Ciezszy workflow akceptacji powinien dotyczyc sugestii wysokiego ryzyka, raportow i wskaznikow wiarygodnosci.

## Prompty jako artefakty

Prompty sa czescia systemu i powinny byc wersjonowane. Kazda zmiana promptu moze zmienic zachowanie systemu, dlatego powinna byc traktowana jak zmiana kodu.

Repozytorium zawiera katalog `prompts/`, w ktorym trzymamy:

- prompty systemowe,
- prompty zadaniowe,
- przyklady danych wejsciowych,
- oczekiwany format odpowiedzi,
- zasady walidacji.

## Format odpowiedzi modelu

Preferowany format to strukturalny JSON zgodny ze schematem, np.:

```json
{
  "suggestions": [
    {
      "type": "follow_up_question",
      "question": "Co wydarzylo sie potem?",
      "reason": "Odpowiedz urywa chronologie zdarzen.",
      "linked_topics": ["chronologia"],
      "risk_flags": [],
      "confidence": 0.72
    }
  ]
}
```

## Minimalny pipeline AI

1. Przygotowanie kontekstu.
2. Usuniecie danych niepotrzebnych dla zadania.
3. Wywolanie lokalnego modelu.
4. Walidacja JSON.
5. Walidacja guardrails.
6. Zapis sugestii w audycie.
7. Decyzja uzytkownika.
