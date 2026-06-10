import type { Answer, AnswerView, Locale, Question, QuestionView, RuntimeConfig } from "./types";
import { text, type CopyKey } from "./i18n";
import { seedAnswers, seedQuestions } from "./demoData";

export function runtimeConfig(): RuntimeConfig {
  const params = new URLSearchParams(window.location.search);
  const envApi = import.meta.env.VITE_API_BASE_URL as string | undefined;
  const requestedApi = params.get("api") || envApi || "http://127.0.0.1:8000";

  return {
    apiBaseUrl: resolveApiBaseUrl(requestedApi),
    caseId: params.get("case") || "case-001",
    sessionId: params.get("session") || `react-session-${Date.now()}`,
    participantId: params.get("participant") || "person-001",
    workspaceId: params.get("workspace") || `${params.get("case") || "case-001"}-workspace`,
  };
}

export function normalizeApiBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function resolveApiBaseUrl(value: string): string {
  const normalized = normalizeApiBaseUrl(value);
  if (
    import.meta.env.DEV &&
    window.location.port === "5173" &&
    isLoopbackApiUrl(normalized)
  ) {
    return "/api";
  }

  return normalized;
}

function isLoopbackApiUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.hostname === "127.0.0.1" || url.hostname === "localhost") &&
      url.port === "8000"
    );
  } catch {
    return false;
  }
}

export function questionTypeLabel(questionType: string): { pl: string; en: string } {
  const labels: Record<string, { pl: string; en: string }> = {
    open: { pl: "otwarte", en: "open" },
    clarifying: { pl: "doprecyzowujące", en: "clarifying" },
    chronological: { pl: "chronologia", en: "timeline" },
    source_of_knowledge: { pl: "źródło wiedzy", en: "source" },
    control: { pl: "kontrolne", en: "control" },
    summary: { pl: "podsumowanie", en: "summary" },
    challenge: { pl: "weryfikacyjne", en: "verification" },
  };
  return labels[questionType] ?? { pl: questionType, en: questionType };
}

export function questionSourceLabel(source: string | undefined): { pl: string; en: string } | undefined {
  if (source === "ai") {
    return { pl: "AI / operator", en: "AI / operator" };
  }
  if (source === "human") {
    return { pl: "plan sprawy", en: "case plan" };
  }
  return undefined;
}

export function questionRiskLabel(question: Question): { pl: string; en: string } | undefined {
  if (question.question_type === "challenge") {
    return { pl: "pytanie sugerujące", en: "leading question" };
  }
  if (question.neutrality_flags?.length) {
    return { pl: "wymaga neutralizacji", en: "needs neutralization" };
  }
  return undefined;
}

export function toQuestionView(question: Question): QuestionView {
  const seed = seedQuestions.find((candidate) => candidate.id === question.id);
  return {
    id: question.id,
    type: seed?.type ?? questionTypeLabel(question.question_type),
    text: seed?.text ?? { pl: question.text, en: question.text },
    topicIds: question.topic_ids,
    source: question.source,
    risk: seed?.risk ?? questionRiskLabel(question),
  };
}

export function toAnswerView(answer: Answer, locale: Locale): AnswerView {
  const seed = seedAnswers.find((candidate) => candidate.id === answer.id);
  return {
    id: answer.id,
    questionId: answer.question_id,
    time: seed?.time ?? formatTime(answer.created_at, locale),
    text: seed?.text ?? { pl: answer.text, en: answer.text },
  };
}

export function formatTime(value: string | undefined, locale: Locale): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString(locale === "pl" ? "pl-PL" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCount(
  count: number,
  locale: Locale,
  labels: {
    singular: string;
    pluralFew: string;
    pluralMany: string;
  },
): string {
  if (locale === "en") {
    return `${count} ${count === 1 ? labels.singular : labels.pluralMany}`;
  }

  const lastDigit = count % 10;
  const lastTwo = count % 100;
  const suffix =
    count === 1
      ? labels.singular
      : lastDigit >= 2 && lastDigit <= 4 && !(lastTwo >= 12 && lastTwo <= 14)
        ? labels.pluralFew
        : labels.pluralMany;

  return `${count} ${suffix}`;
}

export function scorePercent(score: number | null): string {
  return `${Math.round((score ?? 0) * 100)}%`;
}

export function sessionRoleLine(caseId: string, locale: Locale): string {
  const roleKeys: Record<string, CopyKey> = {
    "case-001": "roleWitnessMale",
    "case-002": "roleNightStaffWitness",
    "case-003": "roleCareWitness",
  };
  return `${text(locale, "rolePrefix")}: ${text(locale, roleKeys[caseId] ?? "roleWitness")}`;
}

export function caseAssistantHints(
  caseId: string,
  locale: Locale,
): Array<{ detail: string; title: string }> {
  const hintSets: Record<string, Array<{ detailKey: CopyKey; titleKey: CopyKey }>> = {
    "case-001": [
      { titleKey: "hintBikeTimeTitle", detailKey: "hintBikeTimeDetail" },
      { titleKey: "checkRecording", detailKey: "checkRecordingDetail" },
    ],
    "case-002": [
      { titleKey: "hintPharmacyDoorTitle", detailKey: "hintPharmacyDoorDetail" },
      { titleKey: "checkRecording", detailKey: "checkRecordingDetail" },
    ],
    "case-003": [
      { titleKey: "hintCareTimeTitle", detailKey: "hintCareTimeDetail" },
      { titleKey: "hintCareRecordingTitle", detailKey: "hintCareRecordingDetail" },
    ],
  };

  return (hintSets[caseId] ?? hintSets["case-001"]).map((hint) => ({
    title: text(locale, hint.titleKey),
    detail: text(locale, hint.detailKey),
  }));
}
