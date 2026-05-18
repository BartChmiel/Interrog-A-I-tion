import type { AnswerView, Indicator, QuestionView, ReviewFinding } from "./types";

export const seedQuestions: QuestionView[] = [
  {
    id: "q-001",
    type: { pl: "otwarte", en: "open" },
    text: {
      pl: "Proszę opisać zdarzenie własnymi słowami.",
      en: "Please describe the event in your own words.",
    },
    topicIds: ["topic-chronology", "topic-location", "topic-person"],
  },
  {
    id: "q-002",
    type: { pl: "chronologiczne", en: "chronological" },
    text: {
      pl: "O której godzinie to się zaczęło?",
      en: "What time did it start?",
    },
    topicIds: ["topic-chronology"],
  },
  {
    id: "q-003",
    type: { pl: "konfrontujące", en: "challenge" },
    text: {
      pl: "Przecież stał Pan przy stojaku rowerowym o 20:00, prawda?",
      en: "You were standing by the bicycle stand at 20:00, correct?",
    },
    topicIds: ["topic-location", "topic-chronology"],
    risk: { pl: "pytanie sugerujące", en: "leading" },
  },
  {
    id: "q-004",
    type: { pl: "źródło wiedzy", en: "source of knowledge" },
    text: {
      pl: "Skąd Pan to wie?",
      en: "How do you know that?",
    },
    topicIds: ["topic-source"],
  },
];

export const seedAnswers: AnswerView[] = [
  {
    id: "a-001",
    questionId: "q-001",
    time: "12:03",
    text: {
      pl: "Widziałem mężczyznę przy stojaku rowerowym przed biblioteką. To było około 19:45. Potem odszedł z ciemnym rowerem.",
      en: "I saw a man by the bicycle stand in front of the library. It was around 19:45. Then he left with a dark bicycle.",
    },
  },
  {
    id: "a-002",
    questionId: "q-002",
    time: "12:05",
    text: {
      pl: "Wydaje mi się, że zaczęło się raczej po 20:10, bo wtedy wyszedłem z zajęć.",
      en: "I think it started after 20:10, because that is when I left class.",
    },
  },
  {
    id: "a-003",
    questionId: "q-004",
    time: "12:08",
    text: {
      pl: "Widziałem to osobiście z chodnika po drugiej stronie ulicy.",
      en: "I saw it personally from the sidewalk across the street.",
    },
  },
];

export const seedIndicators: Indicator[] = [
  {
    id: "seed-topic-coverage",
    category: "process",
    label: "Topic coverage",
    description: "Share of planned topics covered by questions or answers.",
    score: 0.8,
    confidence: 1,
    interpretation: "",
    limitations: [],
    factors: [
      {
        id: "seed-covered-topics",
        label: "Covered topics",
        description: "",
        value: "4",
        linked_ids: [],
      },
      {
        id: "seed-missing-topics",
        label: "Missing topics",
        description: "",
        value: "1",
        linked_ids: [],
      },
    ],
  },
  {
    id: "seed-question-neutrality",
    category: "process",
    label: "Question neutrality",
    description: "Share of questions without deterministic neutrality flags.",
    score: 0.75,
    confidence: 0.85,
    interpretation: "",
    limitations: [],
    factors: [
      {
        id: "seed-total-questions",
        label: "Total questions",
        description: "",
        value: "4",
        linked_ids: [],
      },
      {
        id: "seed-flagged-questions",
        label: "Flagged questions",
        description: "",
        value: "1",
        linked_ids: [],
      },
    ],
  },
  {
    id: "seed-narrative-consistency",
    category: "consistency",
    label: "Narrative consistency",
    description: "Deterministic estimate based on structured claim conflicts.",
    score: 0.67,
    confidence: 0.75,
    interpretation: "",
    limitations: [],
    factors: [
      {
        id: "seed-recorded-answers",
        label: "Recorded answers",
        description: "",
        value: "3",
        linked_ids: [],
      },
      {
        id: "seed-potential-conflicts",
        label: "Potential conflicts",
        description: "",
        value: "1",
        linked_ids: [],
      },
    ],
  },
  {
    id: "seed-credibility-review",
    category: "credibility_review",
    label: "Credibility review summary",
    description: "Aggregated decision-support indicator.",
    score: 0.8,
    confidence: 0.82,
    interpretation: "",
    limitations: [],
    factors: [
      {
        id: "seed-review-topic-coverage",
        label: "Topic coverage",
        description: "",
        value: "0.80",
        linked_ids: [],
      },
      {
        id: "seed-review-neutrality",
        label: "Question neutrality",
        description: "",
        value: "0.75",
        linked_ids: [],
      },
    ],
  },
];

export const seedFindings: ReviewFinding[] = [
  {
    category: "missing_topic",
    severity: "high",
    title: "Missing topic: Potential recording",
    detail: "Topic was not covered by any question or answer.",
    linked_ids: ["topic-recording"],
    metadata: { topic_label: "Potential recording" },
  },
  {
    category: "question_neutrality",
    severity: "medium",
    title: "Question may require neutral rewrite",
    detail: "Detected flags: leading.",
    linked_ids: ["q-003"],
    metadata: { flags: ["leading"] },
  },
  {
    category: "potential_inconsistency",
    severity: "medium",
    title: "Potential inconsistency: time",
    detail:
      "Different values were recorded for the same narrative element: 19:45, 20:10.",
    linked_ids: ["a-001", "a-002"],
    metadata: { attribute: "time", values: ["19:45", "20:10"] },
  },
];
