const state = {
  locale: "pl",
  activeQuestionId: "q-001",
  notes: [],
};

const copy = {
  pl: {
    caseSubtitle: "Syntetyczne przesłuchanie dotyczące kradzieży roweru",
    mode: "Live",
    airgapped: "Air-gapped",
    role: "Świadek",
    language: "Język",
    questions: "Plan pytań",
    liveInterview: "Sesja przesłuchania",
    indicators: "Wskaźniki",
    visibleToInterviewer: "widoczne",
    assistant: "Asystent",
    localOnly: "lokalnie",
    findings: "Ustalenia",
    currentQuestion: "Aktywne pytanie",
    answer: "Odpowiedź",
    notePlaceholder: "Notatka robocza",
    addNote: "Dodaj",
    confidence: "Pewność",
    score: "Wynik",
    factors: "Czynniki",
    suggestedAction: "Sugestia",
    source: "Źródło",
    noNotes: "Brak notatek roboczych.",
    questionCount: "4 pytania",
    findingCount: "3 ustalenia",
    roleLine: "Rola: Świadek",
  },
  en: {
    caseSubtitle: "Synthetic bicycle theft interview",
    mode: "Live",
    airgapped: "Air-gapped",
    role: "Witness",
    language: "Language",
    questions: "Question plan",
    liveInterview: "Interview session",
    indicators: "Indicators",
    visibleToInterviewer: "visible",
    assistant: "Assistant",
    localOnly: "local",
    findings: "Findings",
    currentQuestion: "Active question",
    answer: "Answer",
    notePlaceholder: "Working note",
    addNote: "Add",
    confidence: "Confidence",
    score: "Score",
    factors: "Factors",
    suggestedAction: "Suggestion",
    source: "Source",
    noNotes: "No working notes.",
    questionCount: "4 questions",
    findingCount: "3 findings",
    roleLine: "Role: Witness",
  },
};

const questions = [
  {
    id: "q-001",
    type: { pl: "otwarte", en: "open" },
    text: {
      pl: "Proszę opisać zdarzenie własnymi słowami.",
      en: "Please describe the event in your own words.",
    },
    topics: ["chronologia", "miejsce", "opis osoby"],
  },
  {
    id: "q-002",
    type: { pl: "chronologiczne", en: "chronological" },
    text: {
      pl: "O której godzinie to się zaczęło?",
      en: "What time did it start?",
    },
    topics: ["chronologia"],
  },
  {
    id: "q-003",
    type: { pl: "konfrontujące", en: "challenge" },
    text: {
      pl: "Przecież stał Pan przy stojaku rowerowym o 20:00, prawda?",
      en: "You were standing by the bicycle stand at 20:00, correct?",
    },
    topics: ["miejsce", "chronologia"],
    risk: { pl: "pytanie sugerujące", en: "leading" },
  },
  {
    id: "q-004",
    type: { pl: "źródło wiedzy", en: "source of knowledge" },
    text: {
      pl: "Skąd Pan to wie?",
      en: "How do you know that?",
    },
    topics: ["źródło wiedzy"],
  },
];

const answers = [
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

const indicators = [
  {
    label: { pl: "Pokrycie tematów", en: "Topic coverage" },
    score: 0.8,
    confidence: 1,
    factors: [
      { pl: "Tematy pokryte: 4", en: "Covered topics: 4" },
      { pl: "Tematy niepokryte: 1", en: "Missing topics: 1" },
    ],
  },
  {
    label: { pl: "Neutralność pytań", en: "Question neutrality" },
    score: 0.75,
    confidence: 0.85,
    factors: [
      { pl: "Liczba pytań: 4", en: "Total questions: 4" },
      { pl: "Pytania oznaczone flagami: 1", en: "Flagged questions: 1" },
    ],
  },
  {
    label: { pl: "Spójność narracji", en: "Narrative consistency" },
    score: 0.67,
    confidence: 0.75,
    factors: [
      { pl: "Zapisane odpowiedzi: 3", en: "Recorded answers: 3" },
      { pl: "Potencjalne konflikty: 1", en: "Potential conflicts: 1" },
    ],
  },
  {
    label: { pl: "Przegląd wiarygodności", en: "Credibility review" },
    score: 0.8,
    confidence: 0.82,
    factors: [
      { pl: "Pokrycie tematów: 0.80", en: "Topic coverage: 0.80" },
      { pl: "Neutralność pytań: 0.75", en: "Question neutrality: 0.75" },
      { pl: "Spójność narracji: 0.67", en: "Narrative consistency: 0.67" },
    ],
  },
];

const suggestions = [
  {
    title: { pl: "Doprecyzuj czas", en: "Clarify time" },
    detail: {
      pl: "W materiale pojawiają się godziny 19:45 i 20:10 dla tego samego zdarzenia.",
      en: "The material contains 19:45 and 20:10 for the same event.",
    },
  },
  {
    title: { pl: "Sprawdź nagranie", en: "Check recording" },
    detail: {
      pl: "Temat potencjalnego nagrania nie został jeszcze pokryty.",
      en: "The potential recording topic has not been covered yet.",
    },
  },
];

const findings = [
  {
    severity: "high",
    title: { pl: "Niepokryty temat: Potencjalne nagranie", en: "Missing topic: Potential recording" },
    detail: {
      pl: "Temat nie został pokryty żadnym pytaniem ani odpowiedzią.",
      en: "Topic was not covered by any question or answer.",
    },
  },
  {
    severity: "medium",
    title: { pl: "Pytanie może wymagać neutralizacji", en: "Question may require neutral review" },
    detail: {
      pl: "Wykryta flaga: pytanie sugerujące.",
      en: "Detected flag: leading.",
    },
  },
  {
    severity: "medium",
    title: { pl: "Potencjalna niespójność: czas", en: "Potential inconsistency: time" },
    detail: {
      pl: "Dla tego samego elementu narracji zapisano wartości 19:45 i 20:10.",
      en: "The same narrative element contains values 19:45 and 20:10.",
    },
  },
];

function t(key) {
  return copy[state.locale][key] || key;
}

function localize(value) {
  return value[state.locale] || value.en || "";
}

function render() {
  document.documentElement.lang = state.locale;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.getElementById("case-subtitle").textContent = t("caseSubtitle");
  document.getElementById("question-count").textContent = t("questionCount");
  document.getElementById("finding-count").textContent = t("findingCount");
  document.getElementById("active-role").textContent = t("roleLine");
  document.getElementById("note-input").placeholder = t("notePlaceholder");
  document.getElementById("add-note-button").textContent = t("addNote");

  document.querySelectorAll(".lang-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.locale === state.locale);
  });

  renderStatus();
  renderQuestions();
  renderActiveQuestion();
  renderAnswers();
  renderIndicators();
  renderSuggestions();
  renderFindings();
}

function renderStatus() {
  const strip = document.getElementById("status-strip");
  strip.innerHTML = "";
  [t("mode"), t("airgapped"), t("role")].forEach((label) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = label;
    strip.appendChild(chip);
  });
}

function renderQuestions() {
  const list = document.getElementById("question-list");
  list.innerHTML = "";
  questions.forEach((question) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `question-item${question.id === state.activeQuestionId ? " is-active" : ""}`;
    button.addEventListener("click", () => {
      state.activeQuestionId = question.id;
      render();
    });

    const type = document.createElement("span");
    type.className = "question-type";
    type.textContent = localize(question.type);

    const text = document.createElement("strong");
    text.textContent = localize(question.text);

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = question.id;

    button.append(type, text, meta);

    if (question.risk) {
      const risk = document.createElement("span");
      risk.className = "risk-tag";
      risk.textContent = localize(question.risk);
      button.appendChild(risk);
    }

    list.appendChild(button);
  });
}

function renderActiveQuestion() {
  const target = document.getElementById("active-question");
  const active = questions.find((question) => question.id === state.activeQuestionId);
  target.innerHTML = "";
  const label = document.createElement("strong");
  label.textContent = t("currentQuestion");
  const text = document.createElement("p");
  text.textContent = localize(active.text);
  target.append(label, text);
}

function renderAnswers() {
  const stream = document.getElementById("answer-stream");
  stream.innerHTML = "";

  answers.forEach((answer) => {
    const card = document.createElement("article");
    card.className = "answer-card";
    const title = document.createElement("strong");
    title.textContent = `${t("answer")} ${answer.id}`;
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = answer.time;
    const text = document.createElement("p");
    text.textContent = localize(answer.text);
    card.append(title, meta, text);
    stream.appendChild(card);
  });

  state.notes.forEach((note, index) => {
    const card = document.createElement("article");
    card.className = "answer-card";
    const title = document.createElement("strong");
    title.textContent = `${t("notePlaceholder")} ${index + 1}`;
    const text = document.createElement("p");
    text.textContent = note;
    card.append(title, text);
    stream.appendChild(card);
  });
}

function renderIndicators() {
  const list = document.getElementById("indicator-list");
  list.innerHTML = "";
  indicators.forEach((indicator) => {
    const card = document.createElement("article");
    card.className = "indicator-card";

    const header = document.createElement("div");
    header.className = "indicator-header";
    const title = document.createElement("strong");
    title.className = "indicator-title";
    title.textContent = localize(indicator.label);
    const score = document.createElement("span");
    score.className = "score";
    score.textContent = indicator.score.toFixed(2);
    header.append(title, score);

    const track = document.createElement("div");
    track.className = "bar-track";
    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.setProperty("--value", `${Math.round(indicator.score * 100)}%`);
    track.appendChild(fill);

    const confidence = document.createElement("div");
    confidence.className = "confidence-row";
    confidence.innerHTML = `<span>${t("confidence")}</span><strong>${indicator.confidence.toFixed(2)}</strong>`;

    const factors = document.createElement("div");
    factors.className = "factor-list";
    indicator.factors.forEach((factor) => {
      const row = document.createElement("div");
      row.className = "factor-row";
      row.textContent = localize(factor);
      factors.appendChild(row);
    });

    card.append(header, track, confidence, factors);
    list.appendChild(card);
  });
}

function renderSuggestions() {
  const list = document.getElementById("suggestion-list");
  list.innerHTML = "";
  suggestions.forEach((suggestion) => {
    const card = document.createElement("article");
    card.className = "suggestion-card";
    const title = document.createElement("strong");
    title.className = "suggestion-title";
    title.textContent = localize(suggestion.title);
    const detail = document.createElement("p");
    detail.textContent = localize(suggestion.detail);
    card.append(title, detail);
    list.appendChild(card);
  });
}

function renderFindings() {
  const list = document.getElementById("finding-list");
  list.innerHTML = "";
  findings.forEach((finding) => {
    const card = document.createElement("article");
    card.className = "finding-card";
    card.dataset.severity = finding.severity;
    const title = document.createElement("strong");
    title.className = "finding-title";
    title.textContent = localize(finding.title);
    const meta = document.createElement("div");
    meta.className = "finding-meta";
    meta.textContent = finding.severity;
    const detail = document.createElement("p");
    detail.textContent = localize(finding.detail);
    card.append(title, meta, detail);
    list.appendChild(card);
  });
}

document.querySelectorAll(".lang-button").forEach((button) => {
  button.addEventListener("click", () => {
    state.locale = button.dataset.locale;
    render();
  });
});

document.getElementById("add-note-button").addEventListener("click", () => {
  const input = document.getElementById("note-input");
  const value = input.value.trim();
  if (!value) {
    return;
  }
  state.notes.push(value);
  input.value = "";
  renderAnswers();
});

render();
