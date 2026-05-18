import type { Locale, LocalizedText } from "./types";

export const copy = {
  pl: {
    caseFallback: "Syntetyczne przesłuchanie dotyczące kradzieży roweru",
    live: "Live",
    airgapped: "Air-gapped",
    witness: "Świadek",
    questions: "Plan pytań",
    session: "Sesja przesłuchania",
    indicators: "Wskaźniki",
    visible: "widoczne",
    assistant: "Asystent",
    localOnly: "lokalnie",
    findings: "Ustalenia",
    activeQuestion: "Aktywne pytanie",
    answer: "Odpowiedź",
    answerPlaceholder: "Zapisz odpowiedź osoby przesłuchiwanej",
    record: "Zapisz",
    reconnect: "Połącz ponownie",
    confidence: "Pewność",
    noAnswers: "Brak zapisanych odpowiedzi.",
    connecting: "łączenie z API",
    online: "API online",
    offline: "API offline",
    localDemo: "demo lokalne",
    answerRequired: "wpisz odpowiedź",
    reviewUpdated: "review odświeżony",
    saveFailed: "błąd zapisu",
    roleLine: "Rola: Świadek",
    questionSingular: "pytanie",
    questionPluralFew: "pytania",
    questionPluralMany: "pytań",
    findingSingular: "ustalenie",
    findingPluralFew: "ustalenia",
    findingPluralMany: "ustaleń",
    clarifyTime: "Doprecyzuj czas",
    clarifyTimeDetail:
      "W materiale pojawiają się różne godziny dla tego samego zdarzenia.",
    checkRecording: "Sprawdź nagranie",
    checkRecordingDetail: "Temat potencjalnego nagrania nie został jeszcze pokryty.",
    noAutomatedVerdict: "bez automatycznego werdyktu",
  },
  en: {
    caseFallback: "Synthetic bicycle theft interview",
    live: "Live",
    airgapped: "Air-gapped",
    witness: "Witness",
    questions: "Question plan",
    session: "Interview session",
    indicators: "Indicators",
    visible: "visible",
    assistant: "Assistant",
    localOnly: "local",
    findings: "Findings",
    activeQuestion: "Active question",
    answer: "Answer",
    answerPlaceholder: "Record the interviewee answer",
    record: "Record",
    reconnect: "Reconnect",
    confidence: "Confidence",
    noAnswers: "No recorded answers.",
    connecting: "connecting API",
    online: "API online",
    offline: "API offline",
    localDemo: "local demo",
    answerRequired: "enter an answer",
    reviewUpdated: "review refreshed",
    saveFailed: "save failed",
    roleLine: "Role: Witness",
    questionSingular: "question",
    questionPluralFew: "questions",
    questionPluralMany: "questions",
    findingSingular: "finding",
    findingPluralFew: "findings",
    findingPluralMany: "findings",
    clarifyTime: "Clarify time",
    clarifyTimeDetail: "The material contains different times for the same event.",
    checkRecording: "Check recording",
    checkRecordingDetail: "The potential recording topic has not been covered yet.",
    noAutomatedVerdict: "no automated verdict",
  },
} satisfies Record<Locale, Record<string, string>>;

export const domainCopy = {
  pl: {
    "Topic coverage": "Pokrycie tematów",
    "Question neutrality": "Neutralność pytań",
    "Narrative consistency": "Spójność narracji",
    "Source-of-knowledge coverage": "Pokrycie źródła wiedzy",
    "Credibility review summary": "Przegląd wiarygodności",
    "Covered topics": "Tematy pokryte",
    "Missing topics": "Tematy niepokryte",
    "Total questions": "Liczba pytań",
    "Flagged questions": "Pytania z flagami",
    "Recorded answers": "Zapisane odpowiedzi",
    "Potential conflicts": "Potencjalne konflikty",
    "Source topics covered": "Pokryte tematy źródła wiedzy",
    "Source claims": "Twierdzenia o źródle wiedzy",
  },
  en: {},
} satisfies Record<Locale, Record<string, string>>;

export type CopyKey = keyof typeof copy.pl;

export function text(locale: Locale, key: CopyKey): string {
  return copy[locale][key] ?? key;
}

export function localize(value: LocalizedText | string | undefined, locale: Locale): string {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  return value[locale] ?? value.en ?? "";
}

export function domainLabel(label: string, locale: Locale): string {
  return domainCopy[locale][label] ?? label;
}
