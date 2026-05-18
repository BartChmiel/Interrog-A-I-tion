const CONFIG = runtimeConfig();

const state = {
  locale: "pl",
  activeQuestionId: "q-001",
  apiMode: "offline",
  apiMessageKey: "offlineDataset",
  caseData: null,
  session: null,
  indicators: [],
  findings: [],
  localAnswers: [],
  isSubmitting: false,
};

const copy = {
  pl: {
    caseSubtitle: "Syntetyczne przesłuchanie dotyczące kradzieży roweru",
    mode: "Live",
    airgapped: "Air-gapped",
    role: "Świadek",
    questions: "Plan pytań",
    liveInterview: "Sesja przesłuchania",
    indicators: "Wskaźniki",
    visibleToInterviewer: "widoczne",
    assistant: "Asystent",
    localOnly: "lokalnie",
    findings: "Ustalenia",
    currentQuestion: "Aktywne pytanie",
    answer: "Odpowiedź",
    answerPlaceholder: "Zapisz odpowiedź osoby przesłuchiwanej",
    recordAnswer: "Zapisz",
    confidence: "Pewność",
    noAnswers: "Brak zapisanych odpowiedzi.",
    apiConnecting: "łączenie z API",
    apiOnline: "API online",
    apiUnavailable: "API offline",
    offlineDataset: "demo lokalne",
    retryApi: "Połącz ponownie",
    answerRequired: "wpisz odpowiedź",
    answerSaved: "odpowiedź zapisana",
    answerSaveFailed: "błąd zapisu",
    reviewUpdated: "review odświeżony",
    roleLine: "Rola: Świadek",
    questionSingular: "pytanie",
    questionPluralFew: "pytania",
    questionPluralMany: "pytań",
    findingSingular: "ustalenie",
    findingPluralFew: "ustalenia",
    findingPluralMany: "ustaleń",
  },
  en: {
    caseSubtitle: "Synthetic bicycle theft interview",
    mode: "Live",
    airgapped: "Air-gapped",
    role: "Witness",
    questions: "Question plan",
    liveInterview: "Interview session",
    indicators: "Indicators",
    visibleToInterviewer: "visible",
    assistant: "Assistant",
    localOnly: "local",
    findings: "Findings",
    currentQuestion: "Active question",
    answer: "Answer",
    answerPlaceholder: "Record the interviewee answer",
    recordAnswer: "Record",
    confidence: "Confidence",
    noAnswers: "No recorded answers.",
    apiConnecting: "connecting API",
    apiOnline: "API online",
    apiUnavailable: "API offline",
    offlineDataset: "local demo",
    retryApi: "Reconnect",
    answerRequired: "enter an answer",
    answerSaved: "answer recorded",
    answerSaveFailed: "save failed",
    reviewUpdated: "review refreshed",
    roleLine: "Role: Witness",
    questionSingular: "question",
    questionPluralFew: "questions",
    questionPluralMany: "questions",
    findingSingular: "finding",
    findingPluralFew: "findings",
    findingPluralMany: "findings",
  },
};

const domainCopy = {
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
};

const seedQuestions = [
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

const seedAnswers = [
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

const seedIndicators = [
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

const seedFindings = [
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
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  return value[state.locale] || value.en || "";
}

function domainLabel(label) {
  return domainCopy[state.locale][label] || label;
}

function render() {
  document.documentElement.lang = state.locale;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });

  document.getElementById("case-subtitle").textContent = state.caseData?.title || t("caseSubtitle");
  document.getElementById("question-count").textContent = formatCount(
    getQuestions().length,
    "question",
  );
  document.getElementById("finding-count").textContent = formatCount(
    getFindings().length,
    "finding",
  );
  document.getElementById("active-role").textContent = t("roleLine");
  document.getElementById("answer-input").placeholder = t("answerPlaceholder");
  document.getElementById("record-answer-button").textContent = state.isSubmitting
    ? "..."
    : t("recordAnswer");
  document.getElementById("record-answer-button").disabled = state.isSubmitting;

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

  [
    { label: t("mode") },
    { label: t("airgapped") },
    { label: t("role") },
    { label: t(state.apiMessageKey), state: state.apiMode },
  ].forEach((item) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    if (item.state) {
      chip.dataset.state = item.state;
    }
    chip.textContent = item.label;
    strip.appendChild(chip);
  });

  if (state.apiMode === "offline") {
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "status-action";
    retry.textContent = t("retryApi");
    retry.addEventListener("click", () => {
      initializeApiWorkflow();
    });
    strip.appendChild(retry);
  }
}

function renderQuestions() {
  const list = document.getElementById("question-list");
  list.innerHTML = "";

  getQuestions().forEach((question) => {
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
  const active = getActiveQuestion();
  target.innerHTML = "";

  const label = document.createElement("strong");
  label.textContent = t("currentQuestion");
  const text = document.createElement("p");
  text.textContent = active ? localize(active.text) : "";
  target.append(label, text);
}

function renderAnswers() {
  const stream = document.getElementById("answer-stream");
  stream.innerHTML = "";

  const currentAnswers = getAnswers();
  if (!currentAnswers.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = t("noAnswers");
    stream.appendChild(empty);
    return;
  }

  currentAnswers.forEach((answer) => {
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
}

function renderIndicators() {
  const list = document.getElementById("indicator-list");
  list.innerHTML = "";

  getIndicators().forEach((indicator) => {
    const scoreValue = indicator.score ?? 0;
    const card = document.createElement("article");
    card.className = "indicator-card";

    const header = document.createElement("div");
    header.className = "indicator-header";
    const title = document.createElement("strong");
    title.className = "indicator-title";
    title.textContent = indicatorTitle(indicator);
    const score = document.createElement("span");
    score.className = "score";
    score.textContent = indicator.score === null || indicator.score === undefined
      ? "n/a"
      : scoreValue.toFixed(2);
    header.append(title, score);

    const track = document.createElement("div");
    track.className = "bar-track";
    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.setProperty("--value", `${Math.round(scoreValue * 100)}%`);
    track.appendChild(fill);

    const confidence = document.createElement("div");
    confidence.className = "confidence-row";
    confidence.innerHTML = `<span>${t("confidence")}</span><strong>${indicator.confidence.toFixed(2)}</strong>`;

    const factors = document.createElement("div");
    factors.className = "factor-list";
    indicator.factors.forEach((factor) => {
      const row = document.createElement("div");
      row.className = "factor-row";
      row.textContent = factorText(factor);
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
  getFindings().forEach((finding) => {
    const card = document.createElement("article");
    card.className = "finding-card";
    card.dataset.severity = finding.severity;
    const title = document.createElement("strong");
    title.className = "finding-title";
    title.textContent = findingTitle(finding);
    const meta = document.createElement("div");
    meta.className = "finding-meta";
    meta.textContent = finding.severity;
    const detail = document.createElement("p");
    detail.textContent = findingDetail(finding);
    card.append(title, meta, detail);
    list.appendChild(card);
  });
}

function getQuestions() {
  const questions = state.caseData?.questions?.length ? state.caseData.questions : seedQuestions;
  return questions.map(toQuestionView);
}

function toQuestionView(question) {
  const seed = seedQuestions.find((candidate) => candidate.id === question.id);
  const questionType = question.question_type || question.type;
  return {
    id: question.id,
    type: seed?.type || questionTypeLabel(questionType),
    text: seed?.text || { pl: question.text, en: question.text },
    topicIds: question.topic_ids || question.topicIds || seed?.topicIds || [],
    risk: seed?.risk || (question.neutrality_flags?.length ? {
      pl: "flaga neutralności",
      en: "neutrality flag",
    } : null),
  };
}

function getActiveQuestion() {
  return getQuestions().find((question) => question.id === state.activeQuestionId) || getQuestions()[0];
}

function getAnswers() {
  const baseAnswers = state.caseData?.answers?.length
    ? state.caseData.answers.map(toAnswerView)
    : seedAnswers;
  const sessionAnswers = state.session?.answers?.map(toAnswerView) || [];
  return [...baseAnswers, ...state.localAnswers.map(toAnswerView), ...sessionAnswers];
}

function toAnswerView(answer) {
  const seed = seedAnswers.find((candidate) => candidate.id === answer.id);
  return {
    id: answer.id,
    questionId: answer.question_id || answer.questionId,
    time: seed?.time || formatTime(answer.created_at) || answer.time || "",
    text: seed?.text || { pl: answer.text, en: answer.text },
  };
}

function getIndicators() {
  return state.indicators.length ? state.indicators : seedIndicators;
}

function getFindings() {
  return state.findings.length ? state.findings : seedFindings;
}

function indicatorTitle(indicator) {
  return domainLabel(localize(indicator.label));
}

function factorText(factor) {
  if (factor.label && factor.value !== undefined) {
    return `${domainLabel(factor.label)}: ${factor.value}`;
  }
  return localize(factor);
}

function findingTitle(finding) {
  if (typeof finding.title !== "string") {
    return localize(finding.title);
  }
  if (state.locale === "en") {
    return finding.title;
  }
  if (finding.category === "missing_topic") {
    return `Niepokryty temat: ${finding.metadata?.topic_label || ""}`.trim();
  }
  if (finding.category === "question_neutrality") {
    return "Pytanie może wymagać neutralizacji";
  }
  if (finding.category === "potential_inconsistency") {
    return `Potencjalna niespójność: ${finding.metadata?.attribute || ""}`.trim();
  }
  return finding.title;
}

function findingDetail(finding) {
  if (typeof finding.detail !== "string") {
    return localize(finding.detail);
  }
  if (state.locale === "en") {
    return finding.detail;
  }
  if (finding.category === "missing_topic") {
    return "Temat nie został pokryty żadnym pytaniem ani odpowiedzią.";
  }
  if (finding.category === "question_neutrality") {
    return "Pytanie wymaga przeglądu pod kątem neutralności językowej.";
  }
  if (finding.category === "potential_inconsistency") {
    return "W materiale zapisano różne wartości dla tego samego elementu narracji. Wymaga to doprecyzowania, a nie automatycznego werdyktu.";
  }
  return finding.detail;
}

function questionTypeLabel(questionType) {
  const labels = {
    open: { pl: "otwarte", en: "open" },
    clarifying: { pl: "doprecyzowujące", en: "clarifying" },
    chronological: { pl: "chronologiczne", en: "chronological" },
    source_of_knowledge: { pl: "źródło wiedzy", en: "source of knowledge" },
    control: { pl: "kontrolne", en: "control" },
    summary: { pl: "podsumowanie", en: "summary" },
    challenge: { pl: "konfrontujące", en: "challenge" },
  };
  return labels[questionType] || { pl: questionType, en: questionType };
}

function formatCount(count, kind) {
  if (state.locale === "en") {
    const key = count === 1 ? `${kind}Singular` : `${kind}PluralMany`;
    return `${count} ${t(key)}`;
  }

  const lastDigit = count % 10;
  const lastTwo = count % 100;
  const suffix = count === 1
    ? t(`${kind}Singular`)
    : lastDigit >= 2 && lastDigit <= 4 && !(lastTwo >= 12 && lastTwo <= 14)
      ? t(`${kind}PluralFew`)
      : t(`${kind}PluralMany`);
  return `${count} ${suffix}`;
}

function formatTime(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleTimeString(state.locale === "pl" ? "pl-PL" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function initializeApiWorkflow() {
  if (state.isSubmitting || state.apiMode === "connecting") {
    return;
  }

  setApiState("connecting", "apiConnecting");
  render();

  try {
    await loadCaseReview();
    await startOrResumeSession();
    await refreshSessionReview();
    setApiState("online", "apiOnline");
  } catch (error) {
    console.warn("Local API unavailable, using static demo data.", error);
    setApiState("offline", "apiUnavailable");
  }

  render();
}

async function loadCaseReview() {
  const payload = await fetchJson(`/cases/${CONFIG.caseId}/review?locale=${state.locale}`);
  state.caseData = payload.case;
  state.indicators = payload.indicators || [];
  state.findings = payload.review?.findings || [];
}

async function startSession() {
  state.session = await fetchJson("/sessions", {
    method: "POST",
    body: JSON.stringify({
      session_id: CONFIG.sessionId,
      case_id: CONFIG.caseId,
      participant_id: CONFIG.participantId,
      initial_role: "witness",
    }),
  });
}

async function startOrResumeSession() {
  try {
    await startSession();
  } catch (error) {
    if (error.status === 409) {
      await refreshSessionReview();
      return;
    }
    throw error;
  }
}

async function refreshSessionReview() {
  const payload = await fetchJson(`/sessions/${CONFIG.sessionId}/review?locale=${state.locale}`);
  state.session = payload.session;
  state.indicators = payload.indicators || [];
  state.findings = payload.snapshot?.review?.findings || [];
}

async function refreshLocalizedApiState() {
  if (state.apiMode !== "online") {
    return;
  }

  setApiState("connecting", "apiConnecting");
  render();

  try {
    await loadCaseReview();
    await refreshSessionReview();
    setApiState("online", "reviewUpdated");
  } catch (error) {
    console.warn("Could not refresh localized API state.", error);
    setApiState("offline", "apiUnavailable");
  }

  render();
}

async function recordAnswer() {
  const input = document.getElementById("answer-input");
  const value = input.value.trim();
  if (!value) {
    setApiState(state.apiMode, "answerRequired");
    renderStatus();
    return;
  }

  const active = getActiveQuestion();
  state.isSubmitting = true;
  render();

  if (state.apiMode !== "online" || !state.session) {
    state.localAnswers.push({
      id: `local-answer-${state.localAnswers.length + 1}`,
      question_id: active.id,
      text: value,
      topic_ids: active.topicIds,
      created_at: new Date().toISOString(),
    });
    input.value = "";
    state.isSubmitting = false;
    setApiState("offline", "answerSaved");
    render();
    return;
  }

  try {
    const timestamp = Date.now();
    await fetchJson(`/sessions/${CONFIG.sessionId}/answers`, {
      method: "POST",
      body: JSON.stringify({
        id: `ui-answer-${timestamp}`,
        question_id: active.id,
        text: value,
        topic_ids: active.topicIds,
        event_id: `ui-event-answer-${timestamp}`,
        claims: [],
      }),
    });
    await refreshSessionReview();
    input.value = "";
    setApiState("online", "reviewUpdated");
  } catch (error) {
    console.error("Could not record answer.", error);
    setApiState("offline", "answerSaveFailed");
  }

  state.isSubmitting = false;
  render();
}

async function fetchJson(path, options = {}) {
  const headers = options.body
    ? { "Content-Type": "application/json", ...(options.headers || {}) }
    : options.headers;
  const response = await fetch(`${CONFIG.apiBaseUrl}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = new Error(`${response.status} ${response.statusText}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

function runtimeConfig() {
  const params = new URLSearchParams(window.location.search);
  return {
    apiBaseUrl: normalizeApiBaseUrl(params.get("api") || "http://127.0.0.1:8000"),
    caseId: params.get("case") || "case-001",
    sessionId: params.get("session") || `prototype-session-${Date.now()}`,
    participantId: params.get("participant") || "person-001",
  };
}

function normalizeApiBaseUrl(value) {
  return value.trim().replace(/\/+$/, "");
}

function setApiState(mode, messageKey) {
  state.apiMode = mode;
  state.apiMessageKey = messageKey;
}

document.querySelectorAll(".lang-button").forEach((button) => {
  button.addEventListener("click", () => {
    state.locale = button.dataset.locale;
    render();
    refreshLocalizedApiState();
  });
});

document.getElementById("record-answer-button").addEventListener("click", () => {
  recordAnswer();
});

document.getElementById("answer-input").addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    recordAnswer();
  }
});

render();
initializeApiWorkflow();
