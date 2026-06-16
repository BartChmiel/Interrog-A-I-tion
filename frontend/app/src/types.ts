export type Locale = "pl" | "en";

export type ApiMode = "connecting" | "online" | "offline";

export type RuntimeConfig = {
  apiBaseUrl: string;
  caseId: string;
  sessionId: string;
  participantId: string;
  workspaceId: string;
};

export type LocalizedText = Partial<Record<Locale, string>>;

export type Question = {
  id: string;
  text: string;
  source: string;
  question_type: string;
  topic_ids: string[];
  neutrality_flags?: string[];
};

export type QuestionDraft = {
  id: string;
  workspace_id: string;
  case_id: string;
  session_id: string | null;
  participant_id: string | null;
  text: string;
  source: string;
  question_type: string;
  topic_ids: string[];
  source_material_ids: string[];
  source_object_ids: string[];
  status: string;
  locale: Locale;
  rationale: string;
  created_by: string;
  created_at: string;
  audit_event_id: string;
  event_hash: string | null;
};

export type QuestionDraftListResponse = {
  workspace_id: string;
  case_id: string;
  session_id: string | null;
  drafts: QuestionDraft[];
  chain_valid: boolean;
};

export type QuestionDraftResponse = {
  draft: QuestionDraft;
  audit_event: AuditEvent;
  chain_valid: boolean;
};

export type Answer = {
  id: string;
  question_id: string;
  text: string;
  topic_ids: string[];
  created_at?: string;
  claims?: Claim[];
};

export type ClaimReviewStatus = "pending" | "accepted" | "edited" | "rejected";

export type Claim = {
  id: string;
  subject: string;
  attribute: string;
  value: string;
  source_text?: string;
  review_status?: ClaimReviewStatus;
};

export type ClaimView = {
  id: string;
  subject: string;
  attribute: string;
  value: string;
  sourceText: string;
  reviewStatus: ClaimReviewStatus;
};

export type TopicPriority = "high" | "medium" | "low";

export type CaseTopic = {
  id: string;
  label: string;
  description: string;
  priority: TopicPriority;
};

export type CaseData = {
  id: string;
  title: string;
  description: string;
  created_at?: string;
  topics: CaseTopic[];
  questions: Question[];
  answers: Answer[];
};

export type RoleAssignment = {
  participant_id: string;
  role: string;
  assigned_at: string;
  reason: string;
};

export type InterviewSession = {
  id: string;
  case_id: string;
  participant_id: string;
  role_history: RoleAssignment[];
  answers: Answer[];
  events: Array<{ id: string; event_type: string; timestamp: string }>;
};

export type ReviewFinding = {
  category: string;
  title: string;
  detail: string;
  linked_ids: string[];
  severity: "low" | "medium" | "high";
  metadata?: Record<string, unknown>;
};

export type InterviewReview = {
  case_id: string;
  covered_topic_ids: string[];
  missing_topic_ids: string[];
  findings: ReviewFinding[];
};

export type IndicatorFactor = {
  id: string;
  label: string;
  description: string;
  value: string;
  linked_ids: string[];
};

export type Indicator = {
  id: string;
  category: string;
  label: string;
  description: string;
  score: number | null;
  confidence: number;
  factors: IndicatorFactor[];
  interpretation: string;
  limitations: string[];
};

export type CaseReviewResponse = {
  case: CaseData;
  review: InterviewReview;
  indicators: Indicator[];
  report_markdown: string;
};

export type CaseCatalogItem = {
  id: string;
  title: string;
  description: string;
  created_at: string;
  topic_count: number;
  high_priority_topic_count: number;
  question_count: number;
  answer_count: number;
  answered_question_count: number;
};

export type CaseCatalogResponse = {
  cases: CaseCatalogItem[];
};

export type SessionReviewResponse = {
  session: InterviewSession;
  snapshot: {
    session_id: string;
    case_id: string;
    sequence_no: number;
    review: InterviewReview;
    generated_at: string;
  };
  indicators: Indicator[];
  report_markdown: string;
};

export type ClaimReviewDecisionResponse = {
  session: InterviewSession;
  audit_event: AuditEvent;
  chain_valid: boolean;
};

export type EncryptionStatus = {
  backend: "standard_sqlite" | "sqlcipher";
  available: boolean;
  detail: string;
  version: string | null;
  checked_at: string;
};

export type EnvironmentHealthState = "ready" | "warning" | "blocked" | "unknown";

export type EnvironmentHealthCheck = {
  id: string;
  label: string;
  state: EnvironmentHealthState;
  detail: string;
  remediation: string;
};

export type EnvironmentHealth = {
  state: EnvironmentHealthState;
  generated_at: string;
  checks: EnvironmentHealthCheck[];
  summary: Record<string, number>;
};

export type LocalModelConfig = {
  provider: string;
  effective_provider: string;
  configured_model: string;
  ollama_base_url: string;
  timeout_seconds: number;
  temperature: number;
  real_model_enabled: boolean;
  live_output_enabled: boolean;
  restrictions: string[];
};

export type LocalModelSmokeResult = {
  ok: boolean;
  provider: string;
  model: string;
  real_model_invoked: boolean;
  detail: string;
  response_preview: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
};

export type ModelArtifactIsolationStatus = {
  workspace_id: string;
  state: EnvironmentHealthState;
  root: string;
  policy_path: string;
  policy_exists: boolean;
  missing_directories: string[];
  directory_count: number;
  external_cache_allowed: boolean;
  network_artifacts_allowed: boolean;
  sensitive_material_allowed: boolean;
  detail: string;
  warnings: string[];
};

export type ModelArtifactRecord = {
  artifact_id: string;
  artifact_type: string;
  relative_path: string;
  sha256: string;
  size_bytes: number;
  content_type: string;
  source: string;
  created_by: string;
  created_at: string;
  metadata: Record<string, unknown>;
  previous_hash: string | null;
  record_hash: string | null;
};

export type ModelArtifactManifest = {
  schema_version: number;
  workspace_id: string;
  manifest_path: string;
  record_count: number;
  records: ModelArtifactRecord[];
  chain_valid: boolean;
  latest_record_hash: string | null;
};

export type ModelArtifactSummary = Pick<
  ModelArtifactRecord,
  "artifact_id" | "artifact_type" | "relative_path" | "sha256"
> & {
  deduplicated?: boolean;
};

export type WorkspaceManifest = {
  schema_version: number;
  workspace_id: string;
  case_id: string;
  created_by: string;
  created_at: string;
  status: "active" | "sealed" | "archived";
  data_sensitivity: "synthetic" | "anonymized" | "sensitive";
  storage_mode: "plain_sqlite_prototype" | "encrypted_required";
  directories: Record<string, string>;
};

export type WorkspaceResponse = {
  root_path: string;
  manifest: WorkspaceManifest;
};

export type WorkspaceAccessDecision = {
  role: string;
  action: string;
  allowed: boolean;
  reason: string;
};

export type AuditEvent = {
  id: string;
  timestamp: string;
  actor: "human" | "ai" | "system";
  action: string;
  object_type: string;
  object_id: string;
  details: Record<string, unknown>;
  previous_hash: string | null;
  event_hash: string | null;
};

export type WorkspaceAuditResponse = {
  workspace_id: string;
  chain_valid: boolean;
  events: AuditEvent[];
};

export type SessionAuditResponse = {
  session_id: string;
  chain_valid: boolean;
  events: AuditEvent[];
};

export type MaterialSourceType =
  | "text_note"
  | "case_protocol"
  | "audio_transcript"
  | "external_document"
  | "user_note";

export type StarterMaterial = {
  id: string;
  title: string;
  description: string;
  source_type: MaterialSourceType;
  tags: string[];
  content: string;
};

export type CaseStarterMaterialsResponse = {
  case_id: string;
  materials: StarterMaterial[];
};

export type MaterialRecord = {
  id: string;
  workspace_id: string;
  case_id: string;
  title: string;
  description: string;
  source_type: MaterialSourceType;
  data_sensitivity: "synthetic" | "anonymized" | "sensitive";
  mime_type: string;
  original_name: string;
  relative_path: string;
  sha256: string;
  size_bytes: number;
  tags: string[];
  created_by: string;
  created_at: string;
};

export type MaterialListResponse = {
  materials: MaterialRecord[];
};

export type SeedMaterialsResponse = {
  materials: MaterialRecord[];
  imported_count: number;
  skipped_count: number;
  imported_ids: string[];
  skipped_ids: string[];
};

export type MaterialPreview = {
  material_id: string;
  title: string;
  mime_type: string;
  text_preview: string;
  truncated: boolean;
  line_count: number;
  char_count: number;
};

export type MaterialVerification = {
  material_id: string;
  verified: boolean;
  exists: boolean;
  sha256_matches: boolean;
  size_matches: boolean;
  expected_sha256: string;
  actual_sha256: string | null;
  expected_size_bytes: number;
  actual_size_bytes: number | null;
};

export type MaterialQuestionLink = {
  material_id: string;
  question_id: string;
  topic_ids: string[];
  matched_terms: string[];
  confidence: number;
  rationale: string;
};

export type MaterialQuestionLinkDecision = "accepted" | "rejected";

export type MaterialQuestionLinkDecisionResponse = {
  decision: MaterialQuestionLinkDecision;
  chain_valid: boolean;
  audit_event: {
    id: string;
    action: string;
    object_type: string;
    object_id: string;
    event_hash: string;
  };
};

export type MaterialLinksResponse = {
  links: MaterialQuestionLink[];
};

export type EvidenceTopicStatus =
  | "covered"
  | "grounded"
  | "material_only"
  | "contested"
  | "missing";

export type EvidenceMapSummary = {
  total_topics: number;
  covered_topics: number;
  grounded_topics: number;
  material_only_topics: number;
  contested_topics: number;
  missing_topics: number;
  total_questions: number;
  answered_questions: number;
  total_answers: number;
  total_claims: number;
  total_materials: number;
  total_material_question_links: number;
  total_findings: number;
};

export type EvidenceTopicNode = {
  topic_id: string;
  label: string;
  priority: string;
  status: EvidenceTopicStatus;
  question_ids: string[];
  answer_ids: string[];
  claim_ids: string[];
  material_ids: string[];
  finding_ids: string[];
  indicator_ids: string[];
};

export type EvidenceMap = {
  case_id: string;
  summary: EvidenceMapSummary;
  topic_nodes: EvidenceTopicNode[];
};

export type AlignmentBand = "insufficient_review" | "low" | "medium" | "high";

export type AlignmentTopicNode = {
  topic_id: string;
  label: string;
  priority: string;
  weight: number;
  in_scope: boolean;
  supported: boolean;
  accepted_link_count: number;
  rejected_link_count: number;
  pending_link_count: number;
};

export type EvidenceAlignment = {
  case_id: string;
  band: AlignmentBand;
  score: number | null;
  confidence: number;
  total_proposed_links: number;
  reviewed_links: number;
  accepted_links: number;
  rejected_links: number;
  pending_links: number;
  in_scope_topics: number;
  supported_topics: number;
  rejection_rate: number;
  topic_nodes: AlignmentTopicNode[];
  explanation: string[];
  indicator: Indicator;
};

export type EvidenceMapResponse = {
  evidence_map: EvidenceMap;
  evidence_alignment: EvidenceAlignment;
};

export type GroundingPackRule = {
  id: string;
  severity: "required" | "recommended";
  instruction: string;
};

export type GroundingTopicContext = {
  topic_id: string;
  label: string;
  status: EvidenceTopicStatus;
  in_focus: boolean;
  priority: "low" | "medium" | "high";
  question_ids: string[];
  answer_ids: string[];
  claim_ids: string[];
  material_ids: string[];
  finding_ids: string[];
};

export type GroundingMaterialReference = {
  material_id: string;
  title: string;
  source_type: string;
  topic_ids: string[];
  linked_question_ids: string[];
  max_confidence: number;
  tags: string[];
};

export type GroundingContextPack = {
  case_id: string;
  focus_question_id: string | null;
  task: string;
  allowed_source_ids: string[];
  topic_contexts: GroundingTopicContext[];
  material_references: GroundingMaterialReference[];
  rules: GroundingPackRule[];
  operator_review_required: boolean;
};

export type GroundingPackResponse = {
  grounding_pack: GroundingContextPack;
};

export type ExportIntegrityFileRecord = {
  path: string;
  sha256: string;
  size_bytes: number;
};

export type ExportModelArtifactManifestReference = {
  workspace_id: string;
  manifest_path: string;
  manifest_sha256: string | null;
  record_count: number;
  chain_valid: boolean;
  latest_record_hash: string | null;
  records: Array<{
    artifact_id: string;
    artifact_type: string;
    relative_path: string;
    sha256: string;
    size_bytes: number;
    record_hash: string | null;
  }>;
};

export type ExportIntegrityManifest = {
  schema_version: number;
  export_id: string;
  case_id: string;
  created_by: string;
  created_at: string;
  files: ExportIntegrityFileRecord[];
  manifest_hash: string | null;
  model_artifacts: ExportModelArtifactManifestReference | null;
};

export type ExportIntegrityVerification = {
  verified: boolean;
  manifest_hash_valid: boolean;
  missing_files: string[];
  changed_files: string[];
  model_artifact_manifest_hash_valid: boolean;
  model_artifact_chain_valid: boolean;
  missing_model_artifact_files: string[];
  changed_model_artifact_files: string[];
  unexpected_errors: string[];
};

export type ExportIntegrityPreviewResponse = {
  manifest: ExportIntegrityManifest;
  verification: ExportIntegrityVerification;
};

export type ExportBundleResponse = {
  filename: string;
  content_type: string;
  content_base64: string;
  manifest: ExportIntegrityManifest;
  verification: ExportIntegrityVerification;
};

export type GroundedSuggestion = {
  id: string;
  suggestion_type: string;
  text: string;
  reason: string;
  linked_topics: string[];
  linked_evidence: string[];
  risk_flags: string[];
  confidence: number | null;
  status: string;
  created_at: string;
};

export type GroundedSuggestionWarning = {
  suggestion_id: string;
  warning_type: string;
  detail: string;
};

export type GroundedSuggestionDecision = "accepted" | "edited" | "rejected";

export type GroundedSuggestionDecisionResponse = {
  decision: GroundedSuggestionDecision;
  chain_valid: boolean;
  audit_event: {
    id: string;
    action: string;
    object_type: string;
    object_id: string;
    event_hash: string;
  };
};

export type GroundedSuggestionsResponse = {
  suggestions: GroundedSuggestion[];
  model: string;
  prompt_version: string;
  prompt_hash: string;
  context_hash: string;
  output_hash: string;
  warnings: GroundedSuggestionWarning[];
  prompt_artifact?: ModelArtifactSummary | null;
  context_artifact?: ModelArtifactSummary | null;
  output_artifact?: ModelArtifactSummary | null;
  artifact_warning?: string | null;
};

export type OperatorActionDecisionType =
  | "opened"
  | "accepted"
  | "edited"
  | "rejected"
  | "skipped"
  | "dismissed"
  | "converted_to_question";

export type OperatorActionDecision = {
  decision_id: string;
  audit_event_id: string;
  event_hash: string;
  workspace_id: string;
  case_id: string;
  session_id: string | null;
  participant_id: string | null;
  created_at: string;
  created_by: string;
  action_id: string;
  action_kind: string;
  action_title: string;
  action_detail: string;
  action_priority: "high" | "medium" | "low";
  target_question_id: string | null;
  target_tab: string | null;
  source_object_ids: string[];
  decision_type: OperatorActionDecisionType;
  operator_note: string;
  before_state: Record<string, unknown>;
  after_state: Record<string, unknown>;
  model_id: string;
  prompt_version: string;
  prompt_hash: string;
  context_hash: string;
  output_hash: string;
};

export type OperatorActionDecisionResponse = {
  decision: OperatorActionDecision;
  audit_event: {
    id: string;
    action: string;
    object_type: string;
    object_id: string;
    event_hash: string;
  };
  chain_valid: boolean;
};

export type OperatorActionDecisionListResponse = {
  workspace_id: string;
  case_id: string;
  session_id: string | null;
  decisions: OperatorActionDecision[];
  chain_valid: boolean;
};

export type QuestionView = {
  id: string;
  text: LocalizedText;
  type: LocalizedText;
  topicIds: string[];
  source?: string;
  risk?: LocalizedText;
};

export type AnswerView = {
  id: string;
  questionId: string;
  text: LocalizedText;
  time: string;
  claims?: ClaimView[];
};
