import type {
  CaseReviewResponse,
  EncryptionStatus,
  EnvironmentHealth,
  GroundedSuggestionDecision,
  GroundedSuggestionDecisionResponse,
  EvidenceMapResponse,
  GroundedSuggestionsResponse,
  InterviewSession,
  LocalModelConfig,
  LocalModelSmokeResult,
  MaterialQuestionLink,
  MaterialQuestionLinkDecision,
  MaterialQuestionLinkDecisionResponse,
  MaterialLinksResponse,
  MaterialListResponse,
  MaterialPreview,
  MaterialRecord,
  MaterialSourceType,
  MaterialVerification,
  RuntimeConfig,
  SessionReviewResponse,
  WorkspaceAccessDecision,
  WorkspaceResponse,
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

export type RegisterMaterialPayload = {
  id: string;
  title: string;
  content: string;
  source_type: MaterialSourceType;
  tags: string[];
};

export type GroundedSuggestionDecisionPayload = {
  decision: GroundedSuggestionDecision;
  original_text: string;
  final_text: string;
  suggestion_type: string;
  reason: string;
  linked_topics: string[];
  linked_evidence: string[];
  risk_flags: string[];
  confidence: number | null;
  model: string;
  prompt_version: string;
  context_hash: string;
  output_hash: string;
  question_id: string;
};

export type MaterialQuestionLinkDecisionPayload = {
  decision: MaterialQuestionLinkDecision;
  link: MaterialQuestionLink;
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

export async function loadEncryptionStatus(config: RuntimeConfig): Promise<EncryptionStatus> {
  return fetchJson(config, "/security/encryption");
}

export async function loadEnvironmentHealth(config: RuntimeConfig): Promise<EnvironmentHealth> {
  return fetchJson(config, "/environment/health");
}

export async function loadLocalModelConfig(config: RuntimeConfig): Promise<LocalModelConfig> {
  return fetchJson(config, "/ai/local-model/config");
}

export async function runLocalModelSmoke(config: RuntimeConfig): Promise<LocalModelSmokeResult> {
  return fetchJson(config, "/ai/local-model/smoke", {
    method: "POST",
  });
}

export async function loadWorkspace(config: RuntimeConfig): Promise<WorkspaceResponse> {
  return fetchJson(config, `/workspaces/${encodeURIComponent(config.workspaceId)}`);
}

export async function createWorkspace(config: RuntimeConfig): Promise<WorkspaceResponse> {
  return fetchJson(config, "/workspaces", {
    method: "POST",
    body: JSON.stringify({
      workspace_id: config.workspaceId,
      case_id: config.caseId,
      created_by: "local-ui",
      data_sensitivity: "synthetic",
      storage_mode: "plain_sqlite_prototype",
    }),
  });
}

export async function ensureWorkspace(config: RuntimeConfig): Promise<WorkspaceResponse> {
  try {
    return await loadWorkspace(config);
  } catch (error) {
    if ((error as ApiError).status !== 400 && (error as ApiError).status !== 404) {
      throw error;
    }
  }

  try {
    return await createWorkspace(config);
  } catch (error) {
    if ((error as ApiError).status === 400) {
      return loadWorkspace(config);
    }
    throw error;
  }
}

export async function loadWorkspaceAccess(
  config: RuntimeConfig,
  role = "investigator",
  action = "write_interview",
): Promise<WorkspaceAccessDecision> {
  const workspaceId = encodeURIComponent(config.workspaceId);
  const query = new URLSearchParams({ role, action });
  return fetchJson(config, `/workspaces/${workspaceId}/access?${query.toString()}`);
}

export async function loadWorkspaceMaterials(config: RuntimeConfig): Promise<MaterialListResponse> {
  return fetchJson(config, `/workspaces/${encodeURIComponent(config.workspaceId)}/materials`);
}

export async function loadWorkspaceMaterialPreview(
  config: RuntimeConfig,
  materialId: string,
): Promise<MaterialPreview> {
  const workspaceId = encodeURIComponent(config.workspaceId);
  return fetchJson(config, `/workspaces/${workspaceId}/materials/${encodeURIComponent(materialId)}/preview`);
}

export async function loadMaterialQuestionLinks(
  config: RuntimeConfig,
  locale: string,
): Promise<MaterialLinksResponse> {
  const workspaceId = encodeURIComponent(config.workspaceId);
  const query = new URLSearchParams({ case_id: config.caseId, locale });
  return fetchJson(config, `/workspaces/${workspaceId}/materials/links?${query.toString()}`);
}

export async function recordMaterialQuestionLinkDecision(
  config: RuntimeConfig,
  payload: MaterialQuestionLinkDecisionPayload,
): Promise<MaterialQuestionLinkDecisionResponse> {
  const workspaceId = encodeURIComponent(config.workspaceId);
  const materialId = encodeURIComponent(payload.link.material_id);
  const questionId = encodeURIComponent(payload.link.question_id);
  return fetchJson(
    config,
    `/workspaces/${workspaceId}/materials/${materialId}/questions/${questionId}/decision`,
    {
      method: "POST",
      body: JSON.stringify({
        decision: payload.decision,
        case_id: config.caseId,
        session_id: config.sessionId,
        actor_id: "local-ui",
        question_id: payload.link.question_id,
        topic_ids: payload.link.topic_ids,
        matched_terms: payload.link.matched_terms,
        confidence: payload.link.confidence,
        rationale: payload.link.rationale,
      }),
    },
  );
}

export async function loadEvidenceMap(
  config: RuntimeConfig,
  locale: string,
): Promise<EvidenceMapResponse> {
  const workspaceId = encodeURIComponent(config.workspaceId);
  const query = new URLSearchParams({
    case_id: config.caseId,
    session_id: config.sessionId,
    locale,
  });
  return fetchJson(config, `/workspaces/${workspaceId}/evidence-map?${query.toString()}`);
}

export async function loadGroundedSuggestions(
  config: RuntimeConfig,
  locale: string,
  questionId: string,
): Promise<GroundedSuggestionsResponse> {
  const workspaceId = encodeURIComponent(config.workspaceId);
  const query = new URLSearchParams({
    case_id: config.caseId,
    session_id: config.sessionId,
    question_id: questionId,
    locale,
  });
  return fetchJson(config, `/workspaces/${workspaceId}/grounded-suggestions?${query.toString()}`, {
    method: "POST",
  });
}

export async function recordGroundedSuggestionDecision(
  config: RuntimeConfig,
  suggestionId: string,
  payload: GroundedSuggestionDecisionPayload,
): Promise<GroundedSuggestionDecisionResponse> {
  const workspaceId = encodeURIComponent(config.workspaceId);
  return fetchJson(
    config,
    `/workspaces/${workspaceId}/grounded-suggestions/${encodeURIComponent(suggestionId)}/decision`,
    {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        actor_id: "local-ui",
        case_id: config.caseId,
        session_id: config.sessionId,
      }),
    },
  );
}

export async function registerWorkspaceMaterial(
  config: RuntimeConfig,
  payload: RegisterMaterialPayload,
): Promise<MaterialRecord> {
  return fetchJson(config, `/workspaces/${encodeURIComponent(config.workspaceId)}/materials`, {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      created_by: "local-ui",
      data_sensitivity: "synthetic",
      mime_type: "text/plain",
    }),
  });
}

export async function verifyWorkspaceMaterial(
  config: RuntimeConfig,
  materialId: string,
): Promise<MaterialVerification> {
  return fetchJson(
    config,
    `/workspaces/${encodeURIComponent(config.workspaceId)}/materials/${encodeURIComponent(materialId)}/verification`,
  );
}

async function fetchJson<T>(
  config: RuntimeConfig,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = options.body ? { "Content-Type": "application/json" } : undefined;
  const url = `${config.apiBaseUrl}${path}`;

  if (typeof fetch !== "function") {
    return xhrJson<T>(url, { ...options, headers });
  }

  const response = await fetch(url, {
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

function xhrJson<T>(url: string, options: RequestInit): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(options.method ?? "GET", url, true);

    for (const [key, value] of Object.entries(options.headers ?? {})) {
      request.setRequestHeader(key, String(value));
    }

    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        const error = new Error(`${request.status} ${request.statusText}`) as ApiError;
        error.status = request.status;
        reject(error);
        return;
      }

      resolve(JSON.parse(request.responseText) as T);
    };
    request.onerror = () => reject(new Error("Network request failed"));
    request.send(typeof options.body === "string" ? options.body : null);
  });
}
