import type {
  CaseReviewResponse,
  InterviewSession,
  RuntimeConfig,
  SessionReviewResponse,
} from "./types";

export type ApiError = Error & { status?: number };

export type AddAnswerPayload = {
  id: string;
  question_id: string;
  text: string;
  event_id: string;
  topic_ids: string[];
  claims: [];
};

export async function loadCaseReview(config: RuntimeConfig, locale: string): Promise<CaseReviewResponse> {
  return fetchJson(config, `/cases/${config.caseId}/review?locale=${locale}`);
}

export async function startSession(config: RuntimeConfig): Promise<InterviewSession> {
  return fetchJson(config, "/sessions", {
    method: "POST",
    body: JSON.stringify({
      session_id: config.sessionId,
      case_id: config.caseId,
      participant_id: config.participantId,
      initial_role: "witness",
    }),
  });
}

export async function addAnswer(
  config: RuntimeConfig,
  payload: AddAnswerPayload,
): Promise<InterviewSession> {
  return fetchJson(config, `/sessions/${config.sessionId}/answers`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loadSessionReview(
  config: RuntimeConfig,
  locale: string,
): Promise<SessionReviewResponse> {
  return fetchJson(config, `/sessions/${config.sessionId}/review?locale=${locale}`);
}

async function fetchJson<T>(
  config: RuntimeConfig,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = options.body ? { "Content-Type": "application/json" } : undefined;
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = new Error(`${response.status} ${response.statusText}`) as ApiError;
    error.status = response.status;
    throw error;
  }

  return response.json() as Promise<T>;
}
