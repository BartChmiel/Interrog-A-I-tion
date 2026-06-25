import type {
  CaseCatalogResponse,
  CaseParticipantListResponse,
  CaseQualityReport,
  CaseReviewResponse,
  CaseStarterMaterialsResponse,
  ClaimReviewDecisionResponse,
  ClaimReviewStatus,
  AddCaseParticipantResponse,
  CreateLocalCaseResponse,
  WorkflowReadinessReport,
  EncryptionStatus,
  EnvironmentHealth,
  GroundedSuggestionDecision,
  GroundedSuggestionDecisionResponse,
  EvidenceMapResponse,
  ExportBundleResponse,
  ExportIntegrityPreviewResponse,
  GroundingPackResponse,
  GroundedSuggestionsResponse,
  InterviewSession,
  LocalModelConfig,
  ModelExperimentReadiness,
  LocalModelSmokeResult,
  ModelArtifactManifest,
  ModelArtifactIsolationStatus,
  MaterialQuestionLink,
  MaterialQuestionLinkDecision,
  MaterialQuestionLinkDecisionResponse,
  MaterialLinksResponse,
  MaterialListResponse,
  MaterialPreview,
  MaterialRecord,
  MaterialSourceType,
  MaterialVerification,
  OperatorActionDecisionListResponse,
  OperatorActionDecisionResponse,
  OperatorActionDecisionType,
  QuestionDraftListResponse,
  QuestionDraftResponse,
  RuntimeConfig,
  SeedMaterialsResponse,
  SessionAuditResponse,
  SessionReviewResponse,
  StopReviewDecisionResponse,
  StopReviewDecisionType,
  StopReviewListResponse,
  WorkspaceAuditResponse,
  WorkspaceAccessDecision,
  WorkspaceResponse,
  WorkspaceSecurityReport,
} from "./types";

export type ApiError = Error & { status?: number };

export type AddAnswerPayload = {
  id: string;
  question_id: string;
  text: string;
  event_id: string;
  topic_ids: string[];
  claims: [];
  workspace_id?: string;
};

export type RegisterMaterialPayload = {
  id: string;
  title: string;
  content: string;
  source_type: MaterialSourceType;
  tags: string[];
};

export type CreateLocalCasePayload = {
  title: string;
  description: string;
  participant_name: string;
  locale: string;
};

export type AddCaseParticipantPayload = {
  name: string;
  notes?: string;
  role?: string;
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
  prompt_hash: string;
  context_hash: string;
  output_hash: string;
  question_id: string;
};

export type MaterialQuestionLinkDecisionPayload = {
  decision: MaterialQuestionLinkDecision;
  link: MaterialQuestionLink;
};

export type OperatorActionDecisionPayload = {
  action_id: string;
  action_kind: string;
  action_title: string;
  action_detail: string;
  action_priority: "high" | "medium" | "low";
  target_question_id?: string | null;
  target_tab?: string | null;
  source_object_ids?: string[];
  decision_type: OperatorActionDecisionType;
  operator_note?: string;
  before_state?: Record<string, unknown>;
  after_state?: Record<string, unknown>;
  model_id?: string;
  prompt_version?: string;
  prompt_hash?: string;
  context_hash?: string;
  output_hash?: string;
};

export type ClaimReviewPayload = {
  decision: ClaimReviewStatus;
  subject: string;
  attribute: string;
  value: string;
  source_text: string;
  operator_note?: string;
};

export type CreateQuestionDraftPayload = {
  material_id: string;
  topic_id?: string | null;
  source_object_ids?: string[];
  action_id?: string;
  locale: string;
};

export type StopReviewDecisionPayload = {
  decision: StopReviewDecisionType;
  rationale: string;
  checklist?: string[];
};

export async function loadCaseCatalog(config: RuntimeConfig, locale: string): Promise<CaseCatalogResponse> {
  return fetchJson(config, `/cases?locale=${locale}`);
}

export async function createLocalCase(
  config: RuntimeConfig,
  payload: CreateLocalCasePayload,
): Promise<CreateLocalCaseResponse> {
  return fetchJson(config, "/cases", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      created_by: "local-ui",
    }),
  });
}

export async function loadCaseParticipants(
  config: RuntimeConfig,
): Promise<CaseParticipantListResponse> {
  return fetchJson(config, `/cases/${encodeURIComponent(config.caseId)}/participants`);
}

export async function addCaseParticipant(
  config: RuntimeConfig,
  payload: AddCaseParticipantPayload,
): Promise<AddCaseParticipantResponse> {
  return fetchJson(config, `/cases/${encodeURIComponent(config.caseId)}/participants`, {
    method: "POST",
    body: JSON.stringify({
      name: payload.name,
      notes: payload.notes ?? "",
      role: payload.role ?? "witness",
    }),
  });
}

export async function loadCaseReview(config: RuntimeConfig, locale: string): Promise<CaseReviewResponse> {
  return fetchJson(config, `/cases/${config.caseId}/review?locale=${locale}`);
}

export async function loadCaseStarterMaterials(
  config: RuntimeConfig,
  locale: string,
): Promise<CaseStarterMaterialsResponse> {
  return fetchJson(config, `/cases/${config.caseId}/starter-materials?locale=${locale}`);
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

export async function reviewSessionClaim(
  config: RuntimeConfig,
  answerId: string,
  claimId: string,
  payload: ClaimReviewPayload,
): Promise<ClaimReviewDecisionResponse> {
  const encodedAnswerId = encodeURIComponent(answerId);
  const encodedClaimId = encodeURIComponent(claimId);
  return fetchJson(config, `/sessions/${config.sessionId}/answers/${encodedAnswerId}/claims/${encodedClaimId}/review`, {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      actor_id: "local-ui",
    }),
  });
}

export async function loadSessionReview(
  config: RuntimeConfig,
  locale: string,
): Promise<SessionReviewResponse> {
  const query = new URLSearchParams({ locale, workspace_id: config.workspaceId });
  return fetchJson(config, `/sessions/${config.sessionId}/review?${query.toString()}`);
}

export async function loadSessionAudit(config: RuntimeConfig): Promise<SessionAuditResponse> {
  return fetchJson(config, `/sessions/${config.sessionId}/audit`);
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

export async function runLocalModelSmoke(
  config: RuntimeConfig,
  executeReal = false,
): Promise<LocalModelSmokeResult> {
  const query = executeReal
    ? `?${new URLSearchParams({
        execute_real: "true",
        workspace_id: config.workspaceId,
      }).toString()}`
    : "";
  return fetchJson(config, `/ai/local-model/smoke${query}`, {
    method: "POST",
  });
}

export async function loadLocalModelExperimentReadiness(
  config: RuntimeConfig,
): Promise<ModelExperimentReadiness> {
  const query = new URLSearchParams({
    workspace_id: config.workspaceId,
  });
  return fetchJson(config, `/ai/local-model/experiment-readiness?${query.toString()}`);
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

export async function loadWorkspaceSecurity(config: RuntimeConfig): Promise<WorkspaceSecurityReport> {
  return fetchJson(config, `/workspaces/${encodeURIComponent(config.workspaceId)}/security`);
}

export async function loadWorkspaceWorkflowReadiness(
  config: RuntimeConfig,
  locale: string,
): Promise<WorkflowReadinessReport> {
  const workspaceId = encodeURIComponent(config.workspaceId);
  const query = new URLSearchParams({
    case_id: config.caseId,
    session_id: config.sessionId,
    locale,
  });
  return fetchJson(config, `/workspaces/${workspaceId}/demo-readiness?${query.toString()}`);
}

export async function loadWorkspaceCaseQuality(
  config: RuntimeConfig,
  locale: string,
): Promise<CaseQualityReport> {
  const workspaceId = encodeURIComponent(config.workspaceId);
  const query = new URLSearchParams({
    case_id: config.caseId,
    session_id: config.sessionId,
    locale,
  });
  return fetchJson(config, `/workspaces/${workspaceId}/case-quality?${query.toString()}`);
}

export async function loadWorkspaceStopReviews(config: RuntimeConfig): Promise<StopReviewListResponse> {
  return fetchJson(config, `/workspaces/${encodeURIComponent(config.workspaceId)}/stop-reviews`);
}

export async function recordWorkspaceStopReview(
  config: RuntimeConfig,
  payload: StopReviewDecisionPayload,
): Promise<StopReviewDecisionResponse> {
  return fetchJson(config, `/workspaces/${encodeURIComponent(config.workspaceId)}/stop-reviews`, {
    method: "POST",
    body: JSON.stringify({
      gate_id: "local_model_real_smoke",
      decision: payload.decision,
      created_by: "local-ui",
      rationale: payload.rationale,
      checklist: payload.checklist ?? [],
      role: "admin",
    }),
  });
}

export async function loadWorkspaceAudit(config: RuntimeConfig): Promise<WorkspaceAuditResponse> {
  return fetchJson(config, `/workspaces/${encodeURIComponent(config.workspaceId)}/audit`);
}

export async function loadModelArtifactIsolation(
  config: RuntimeConfig,
): Promise<ModelArtifactIsolationStatus> {
  return fetchJson(config, `/workspaces/${encodeURIComponent(config.workspaceId)}/model-artifacts`);
}

export async function loadModelArtifactManifest(config: RuntimeConfig): Promise<ModelArtifactManifest> {
  return fetchJson(config, `/workspaces/${encodeURIComponent(config.workspaceId)}/model-artifacts/manifest`);
}

export async function ensureModelArtifactIsolation(
  config: RuntimeConfig,
): Promise<ModelArtifactIsolationStatus> {
  return fetchJson(config, `/workspaces/${encodeURIComponent(config.workspaceId)}/model-artifacts/isolation`, {
    method: "POST",
    body: JSON.stringify({
      created_by: "local-ui",
      role: "admin",
    }),
  });
}

export async function loadWorkspaceMaterials(config: RuntimeConfig): Promise<MaterialListResponse> {
  return fetchJson(config, `/workspaces/${encodeURIComponent(config.workspaceId)}/materials`);
}

export async function loadWorkspaceQuestionDrafts(
  config: RuntimeConfig,
): Promise<QuestionDraftListResponse> {
  const workspaceId = encodeURIComponent(config.workspaceId);
  const query = new URLSearchParams({
    case_id: config.caseId,
    session_id: config.sessionId,
  });
  return fetchJson(config, `/workspaces/${workspaceId}/question-drafts?${query.toString()}`);
}

export async function createWorkspaceQuestionDraft(
  config: RuntimeConfig,
  payload: CreateQuestionDraftPayload,
): Promise<QuestionDraftResponse> {
  return fetchJson(config, `/workspaces/${encodeURIComponent(config.workspaceId)}/question-drafts`, {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      case_id: config.caseId,
      session_id: config.sessionId,
      participant_id: config.participantId,
      created_by: "local-ui",
      role: "investigator",
    }),
  });
}

export async function seedWorkspaceMaterials(
  config: RuntimeConfig,
  locale: string,
): Promise<SeedMaterialsResponse> {
  return fetchJson(config, `/workspaces/${encodeURIComponent(config.workspaceId)}/materials/seed`, {
    method: "POST",
    body: JSON.stringify({
      created_by: "local-ui",
      locale,
      role: "investigator",
    }),
  });
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

export async function loadExportIntegrityPreview(
  config: RuntimeConfig,
  reportMarkdown: string,
  reportPath = "session-report.md",
): Promise<ExportIntegrityPreviewResponse> {
  const workspaceId = encodeURIComponent(config.workspaceId);
  return fetchJson(config, `/workspaces/${workspaceId}/exports/integrity-preview`, {
    method: "POST",
    body: JSON.stringify({
      case_id: config.caseId,
      created_by: "local-ui",
      include_model_artifacts: true,
      files: [{ path: reportPath, content: reportMarkdown }],
    }),
  });
}

export async function loadExportBundle(
  config: RuntimeConfig,
  markdown: string,
  jsonExport: string | null,
  markdownPath = "session-report.md",
): Promise<ExportBundleResponse> {
  const workspaceId = encodeURIComponent(config.workspaceId);
  return fetchJson(config, `/workspaces/${workspaceId}/exports/bundle`, {
    method: "POST",
    body: JSON.stringify({
      case_id: config.caseId,
      created_by: "local-ui",
      include_model_artifacts: true,
      markdown,
      markdown_path: markdownPath,
      json_export: jsonExport,
    }),
  });
}

export async function loadGroundingPack(
  config: RuntimeConfig,
  locale: string,
  questionId: string,
): Promise<GroundingPackResponse> {
  const workspaceId = encodeURIComponent(config.workspaceId);
  const query = new URLSearchParams({
    case_id: config.caseId,
    session_id: config.sessionId,
    question_id: questionId,
    locale,
  });
  return fetchJson(config, `/workspaces/${workspaceId}/grounding-pack?${query.toString()}`);
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

export async function loadOperatorActionDecisions(
  config: RuntimeConfig,
): Promise<OperatorActionDecisionListResponse> {
  const workspaceId = encodeURIComponent(config.workspaceId);
  const query = new URLSearchParams({
    case_id: config.caseId,
    session_id: config.sessionId,
  });
  return fetchJson(config, `/workspaces/${workspaceId}/operator-actions/decisions?${query.toString()}`);
}

export async function recordOperatorActionDecision(
  config: RuntimeConfig,
  payload: OperatorActionDecisionPayload,
): Promise<OperatorActionDecisionResponse> {
  const workspaceId = encodeURIComponent(config.workspaceId);
  return fetchJson(config, `/workspaces/${workspaceId}/operator-actions/decisions`, {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      case_id: config.caseId,
      session_id: config.sessionId,
      participant_id: config.participantId,
      created_by: "local-ui",
      role: "investigator",
    }),
  });
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
