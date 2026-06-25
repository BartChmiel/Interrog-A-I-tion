import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Database,
  Eye,
  FileCheck2,
  FileDown,
  FileText,
  FolderArchive,
  FolderOpen,
  Fingerprint,
  History,
  KeyRound,
  Languages,
  ListChecks,
  MoreHorizontal,
  Moon,
  Network,
  Pencil,
  Plus,
  ClipboardCopy,
  RefreshCw,
  Send,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
  Sun,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import {
  addAnswer,
  addCaseParticipant,
  createLocalCase,
  createWorkspaceQuestionDraft,
  ensureModelArtifactIsolation,
  ensureWorkspace,
  loadCaseCatalog,
  loadCaseParticipants,
  loadCaseReview,
  loadCaseStarterMaterials,
  loadEncryptionStatus,
  loadEnvironmentHealth,
  loadEvidenceMap,
  loadGroundedSuggestions,
  loadLocalModelExperimentReadiness,
  loadLocalModelConfig,
  loadMaterialQuestionLinks,
  loadModelArtifactManifest,
  loadModelArtifactIsolation,
  loadOperatorActionDecisions,
  loadWorkspaceQuestionDrafts,
  loadSessionAudit,
  loadWorkspaceMaterialPreview,
  loadSessionReview,
  loadWorkspaceAccess,
  loadWorkspaceAudit,
  loadWorkspaceCaseQuality,
  loadWorkspaceWorkflowReadiness,
  loadWorkspaceSecurity,
  loadWorkspaceStopReviews,
  loadWorkspaceMaterials,
  recordGroundedSuggestionDecision,
  recordMaterialQuestionLinkDecision,
  recordOperatorActionDecision,
  recordWorkspaceStopReview,
  reviewSessionClaim,
  registerWorkspaceMaterial,
  runLocalModelSmoke,
  seedWorkspaceMaterials,
  startSession,
  verifyWorkspaceMaterial,
  type ApiError,
} from "./api";
import { AiRuntimeStatusCard } from "./ai-status-card";
import { CaseCatalogBadges, WorkspaceEmptyState } from "./case-workflow";
import { evidenceStatusLabel } from "./evidence-labels";
import { GroundingPackPanel } from "./grounding-pack-panel";
import {
  formatGroundedAiError,
  GroundedSuggestionsPanel,
} from "./grounded-ai-panel";
import { SessionReportPanel } from "./session-report-panel";
import type { SessionReportExportInput } from "./session-report";
import { seedAnswers, seedCaseCatalog, seedFindings, seedIndicators, seedQuestions } from "./sampleData";
import { domainLabel, localize, text, type CopyKey } from "./i18n";
import type {
  Answer,
  AnswerView,
  ApiMode,
  AuditEvent,
  CaseCatalogItem,
  CaseParticipant,
  CaseData,
  CaseQualityReport,
  CaseTopic,
  ClaimReviewStatus,
  ClaimView,
  WorkflowReadinessReport,
  EncryptionStatus,
  EnvironmentHealth,
  EnvironmentHealthState,
  EvidenceAlignment,
  EvidenceMap,
  EvidenceTopicNode,
  EvidenceTopicStatus,
  GroundedSuggestionDecision,
  GroundedSuggestion,
  GroundedSuggestionQualityReport,
  GroundedSuggestionSupportReport,
  GroundedSuggestionTriageReport,
  GroundedSuggestionsResponse,
  GroundedSuggestionWarning,
  Indicator,
  InterviewSession,
  InterviewReview,
  Locale,
  LocalModelConfig,
  ModelExperimentReadiness,
  LocalModelSmokeResult,
  ModelArtifactManifest,
  ModelArtifactIsolationStatus,
  ModelArtifactSummary,
  MaterialQuestionLink,
  MaterialQuestionLinkDecision,
  MaterialPreview,
  MaterialRecord,
  MaterialSourceType,
  MaterialVerification,
  OperatorActionDecision,
  OperatorActionDecisionType,
  QuestionDraft,
  QuestionView,
  ReviewFinding,
  RuntimeConfig,
  SessionAuditResponse,
  StarterMaterial,
  StopReviewDecisionType,
  StopReviewListResponse,
  WorkspaceAccessDecision,
  WorkspaceAuditResponse,
  WorkspaceResponse,
  WorkspaceSecurityReport,
} from "./types";
import {
  caseAssistantHints,
  formatCount,
  questionSourceLabel,
  runtimeConfig,
  scorePercent,
  sessionRoleLine,
  toAnswerView,
  toQuestionView,
} from "./utils";
import {
  CollapsibleSection,
  CollapsibleWorkspaceCard,
  InterviewContextStrip,
  Modal,
  WorkspaceCard,
  WorkspaceZone,
} from "./ui-shell";
import type { TutorialStepDefinition } from "./tutorial-steps";
import { TutorialLaunchButton, TutorialTour } from "./tutorial-tour";

type MaterialDraft = {
  title: string;
  content: string;
  tags: string;
  sourceType: MaterialSourceType;
};

type NewCaseDraft = {
  title: string;
  description: string;
  participantName: string;
};

type OperationsTab = "monitor" | "ai" | "materials" | "review";
type WorkMode = "interview" | OperationsTab;
type WorkspacePerspective = "operator" | "auditor";
type ReviewTab = "report" | "quality" | "stop" | "audit" | "analytics";
type UiTheme = "light" | "dark";
type UiDensity = "comfortable" | "compact";

type WorkModeDescriptor = {
  id: WorkMode;
  label: string;
  detail: string;
  value: string;
  icon: ReactNode;
};

type OperatorActionKind = "ask" | "materials" | "review";

type OperatorAction = {
  id: string;
  kind: OperatorActionKind;
  title: string;
  detail: string;
  priority: "high" | "medium" | "low";
  targetQuestionId?: string;
  targetTab?: OperationsTab;
  sourceObjectIds?: string[];
};

type MaterialTaskKind = "review_link" | "verify_material" | "material_only" | "contested_topic";

type MaterialTask = {
  id: string;
  kind: MaterialTaskKind;
  title: string;
  detail: string;
  priority: OperatorAction["priority"];
  materialId?: string;
  questionId?: string;
  topicId?: string;
  sourceObjectIds: string[];
  link?: MaterialQuestionLink;
};

type StopReadinessGate = {
  id: string;
  label: string;
  detail: string;
  state: EnvironmentHealthState;
  icon: ReactNode;
};

type OperationsGuidanceAction = {
  id: string;
  detail: string;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
};

const emptyMaterialDraft: MaterialDraft = {
  title: "",
  content: "",
  tags: "",
  sourceType: "case_protocol",
};

const emptyNewCaseDraft: NewCaseDraft = {
  title: "",
  description: "",
  participantName: "",
};

const materialSourceTypes: MaterialSourceType[] = [
  "case_protocol",
  "text_note",
  "user_note",
  "audio_transcript",
  "external_document",
];

const config = runtimeConfig();

const uiStorageKeys = {
  density: "interrogaition.ui.density",
  leftRailCollapsed: "interrogaition.ui.leftRailCollapsed",
  rightRailCollapsed: "interrogaition.ui.rightRailCollapsed",
  theme: "interrogaition.ui.theme",
} as const;

function readStoredOption<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  try {
    const value = window.localStorage.getItem(key);
    return allowed.includes(value as T) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

function readStoredBoolean(key: string, fallback: boolean): boolean {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value === "true";
  } catch {
    return fallback;
  }
}

function writeStoredValue(key: string, value: string | boolean): void {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Local storage is a progressive enhancement for UI preferences.
  }
}

export function App() {
  const [locale, setLocale] = useState<Locale>("pl");
  const [apiMode, setApiMode] = useState<ApiMode>("offline");
  const [statusKey, setStatusKey] = useState<CopyKey>("localMode");
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [caseCatalog, setCaseCatalog] = useState<CaseCatalogItem[]>(seedCaseCatalog[locale]);
  const [caseStarterMaterials, setCaseStarterMaterials] = useState<StarterMaterial[]>([]);
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [review, setReview] = useState<InterviewReview | null>(null);
  const [reportMarkdown, setReportMarkdown] = useState<string | null>(null);
  const [sessionReportExported, setSessionReportExported] = useState(false);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [findings, setFindings] = useState<ReviewFinding[]>([]);
  const [encryptionStatus, setEncryptionStatus] = useState<EncryptionStatus | null>(null);
  const [environmentHealth, setEnvironmentHealth] = useState<EnvironmentHealth | null>(null);
  const [localModelConfig, setLocalModelConfig] = useState<LocalModelConfig | null>(null);
  const [localModelSmoke, setLocalModelSmoke] = useState<LocalModelSmokeResult | null>(null);
  const [modelExperimentReadiness, setModelExperimentReadiness] = useState<ModelExperimentReadiness | null>(null);
  const [modelArtifactManifest, setModelArtifactManifest] = useState<ModelArtifactManifest | null>(null);
  const [modelArtifactIsolation, setModelArtifactIsolation] = useState<ModelArtifactIsolationStatus | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [workspaceSecurity, setWorkspaceSecurity] = useState<WorkspaceSecurityReport | null>(null);
  const [workspaceAccess, setWorkspaceAccess] = useState<WorkspaceAccessDecision | null>(null);
  const [workflowReadiness, setWorkflowReadiness] = useState<WorkflowReadinessReport | null>(null);
  const [caseQuality, setCaseQuality] = useState<CaseQualityReport | null>(null);
  const [stopReviewList, setStopReviewList] = useState<StopReviewListResponse | null>(null);
  const [workspaceAudit, setWorkspaceAudit] = useState<WorkspaceAuditResponse | null>(null);
  const [sessionAudit, setSessionAudit] = useState<SessionAuditResponse | null>(null);
  const [workspaceMaterials, setWorkspaceMaterials] = useState<MaterialRecord[]>([]);
  const [questionDrafts, setQuestionDrafts] = useState<QuestionDraft[]>([]);
  const [materialQuestionLinks, setMaterialQuestionLinks] = useState<MaterialQuestionLink[]>([]);
  const [materialQuestionLinkDecisions, setMaterialQuestionLinkDecisions] = useState<Record<string, MaterialQuestionLinkDecision>>({});
  const [materialPreviews, setMaterialPreviews] = useState<Record<string, MaterialPreview>>({});
  const [activeMaterialPreviewId, setActiveMaterialPreviewId] = useState<string | null>(null);
  const [evidenceMap, setEvidenceMap] = useState<EvidenceMap | null>(null);
  const [evidenceAlignment, setEvidenceAlignment] = useState<EvidenceAlignment | null>(null);
  const [operatorActionDecisions, setOperatorActionDecisions] = useState<OperatorActionDecision[]>([]);
  const [groundedSuggestions, setGroundedSuggestions] = useState<GroundedSuggestion[]>([]);
  const [groundedSuggestionWarnings, setGroundedSuggestionWarnings] = useState<GroundedSuggestionWarning[]>([]);
  const [groundedSuggestionMeta, setGroundedSuggestionMeta] = useState<{
    model: string;
    promptVersion: string;
    promptHash: string;
    contextHash: string;
    outputHash: string;
    promptArtifact: ModelArtifactSummary | null;
    contextArtifact: ModelArtifactSummary | null;
    outputArtifact: ModelArtifactSummary | null;
    artifactWarning: string | null;
    qualityReport: GroundedSuggestionQualityReport | null;
    supportReport: GroundedSuggestionSupportReport | null;
    triageReport: GroundedSuggestionTriageReport | null;
  } | null>(null);
  const [suggestionDrafts, setSuggestionDrafts] = useState<Record<string, string>>({});
  const [suggestionDecisions, setSuggestionDecisions] = useState<Record<string, GroundedSuggestionDecision>>({});
  const [isGroundedSuggestionsLoading, setIsGroundedSuggestionsLoading] = useState(false);
  const [isStopReviewSubmitting, setIsStopReviewSubmitting] = useState(false);
  const [groundedSuggestionsError, setGroundedSuggestionsError] = useState<string | null>(null);
  const [groundedCacheTick, setGroundedCacheTick] = useState(0);
  const groundedCacheRef = useRef<
    Record<
      string,
      {
        suggestions: GroundedSuggestion[];
        warnings: GroundedSuggestionWarning[];
        meta: {
          model: string;
          promptVersion: string;
          promptHash: string;
          contextHash: string;
          outputHash: string;
          promptArtifact: ModelArtifactSummary | null;
          contextArtifact: ModelArtifactSummary | null;
          outputArtifact: ModelArtifactSummary | null;
          artifactWarning: string | null;
          qualityReport: GroundedSuggestionQualityReport | null;
          supportReport: GroundedSuggestionSupportReport | null;
          triageReport: GroundedSuggestionTriageReport | null;
        } | null;
        decisions: Record<string, GroundedSuggestionDecision>;
        drafts: Record<string, string>;
      }
    >
  >({});
  const [materialDraft, setMaterialDraft] = useState<MaterialDraft>(emptyMaterialDraft);
  const [newCaseDraft, setNewCaseDraft] = useState<NewCaseDraft>(emptyNewCaseDraft);
  const [newCaseError, setNewCaseError] = useState<string | null>(null);
  const [isNewCaseOpen, setIsNewCaseOpen] = useState(false);
  const [isCaseCreating, setIsCaseCreating] = useState(false);
  const [caseParticipants, setCaseParticipants] = useState<CaseParticipant[]>([]);
  const [participantDraft, setParticipantDraft] = useState("");
  const [isParticipantSubmitting, setIsParticipantSubmitting] = useState(false);
  const [materialVerifications, setMaterialVerifications] = useState<Record<string, MaterialVerification>>({});
  const [activeQuestionId, setActiveQuestionId] = useState("q-001");
  const [activeWorkMode, setActiveWorkMode] = useState<WorkMode>("interview");
  const [activeOperationsTab, setActiveOperationsTab] = useState<OperationsTab>("monitor");
  const [workspacePerspective, setWorkspacePerspective] = useState<WorkspacePerspective>("operator");
  const [activeReviewTab, setActiveReviewTab] = useState<ReviewTab>("report");
  const [dismissedOperatorActionIds, setDismissedOperatorActionIds] = useState<Set<string>>(new Set());
  const [answerText, setAnswerText] = useState("");
  const [localAnswers, setLocalAnswers] = useState<Answer[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewingClaimIds, setReviewingClaimIds] = useState<Set<string>>(new Set());
  const [claimEditDraft, setClaimEditDraft] = useState<ClaimEditDraft>(null);
  const [isMaterialSubmitting, setIsMaterialSubmitting] = useState(false);
  const [isQuestionDraftSubmitting, setIsQuestionDraftSubmitting] = useState(false);
  const [isArtifactIsolationSubmitting, setIsArtifactIsolationSubmitting] = useState(false);
  const [isModelSmokeRunning, setIsModelSmokeRunning] = useState(false);
  const didInitializeApi = useRef(false);
  const [workflowReviewVisited, setWorkflowReviewVisited] = useState(false);
  const [leftRailCollapsed, setLeftRailCollapsed] = useState(() =>
    readStoredBoolean(uiStorageKeys.leftRailCollapsed, true),
  );
  const [rightRailCollapsed, setRightRailCollapsed] = useState(() =>
    readStoredBoolean(uiStorageKeys.rightRailCollapsed, true),
  );
  const [tutorialActive, setTutorialActive] = useState(false);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [uiTheme, setUiTheme] = useState<UiTheme>(() =>
    readStoredOption(uiStorageKeys.theme, "light", ["light", "dark"] as const),
  );
  const [uiDensity, setUiDensity] = useState<UiDensity>(() =>
    readStoredOption(uiStorageKeys.density, "comfortable", ["comfortable", "compact"] as const),
  );
  const localeRef = useRef<Locale>(locale);

  useEffect(() => {
    document.documentElement.dataset.theme = uiTheme;
    writeStoredValue(uiStorageKeys.theme, uiTheme);
  }, [uiTheme]);

  useEffect(() => {
    writeStoredValue(uiStorageKeys.density, uiDensity);
  }, [uiDensity]);

  useEffect(() => {
    writeStoredValue(uiStorageKeys.leftRailCollapsed, leftRailCollapsed);
  }, [leftRailCollapsed]);

  useEffect(() => {
    writeStoredValue(uiStorageKeys.rightRailCollapsed, rightRailCollapsed);
  }, [rightRailCollapsed]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const questions = useMemo<QuestionView[]>(() => {
    const caseQuestions = caseData?.questions.length ? caseData.questions.map(toQuestionView) : seedQuestions;
    const dynamicQuestions = questionDrafts.map((draft) => questionDraftToQuestionView(draft, locale));
    return mergeQuestionViews(caseQuestions, dynamicQuestions);
  }, [caseData, locale, questionDrafts]);

  const activeQuestion = questions.find((question) => question.id === activeQuestionId) ?? questions[0];
  const activeQuestionIndex = Math.max(0, questions.findIndex((question) => question.id === activeQuestion?.id));
  const materialsById = useMemo(() => {
    return new Map(workspaceMaterials.map((material) => [material.id, material]));
  }, [workspaceMaterials]);
  const starterMaterialsById = useMemo(() => {
    return new Map(caseStarterMaterials.map((material) => [material.id, material]));
  }, [caseStarterMaterials]);
  const activeQuestionLinks = useMemo(() => {
    const directLinks = materialQuestionLinks.filter((link) => link.question_id === activeQuestion?.id);
    const draft = questionDrafts.find((candidate) => candidate.id === activeQuestion?.id);
    const draftLinks = draft ? questionDraftToMaterialLinks(draft) : [];
    return mergeMaterialQuestionLinks(directLinks, draftLinks);
  }, [activeQuestion?.id, materialQuestionLinks, questionDrafts]);

  const answerViews = useMemo(() => {
    const base = caseData?.answers.length
      ? caseData.answers.map((answer) => toAnswerView(answer, locale))
      : seedAnswers;
    const sessionAnswers = (session?.answers.map((answer) => toAnswerView(answer, locale)) ?? []).slice().reverse();
    const localAnswerViews = localAnswers.map((answer) => toAnswerView(answer, locale)).slice().reverse();
    return [...sessionAnswers, ...localAnswerViews, ...base];
  }, [caseData, locale, localAnswers, session]);

  useEffect(() => {
    if (!activeQuestionId) {
      return;
    }

    groundedCacheRef.current[activeQuestionId] = {
      suggestions: groundedSuggestions,
      warnings: groundedSuggestionWarnings,
      meta: groundedSuggestionMeta,
      decisions: suggestionDecisions,
      drafts: suggestionDrafts,
    };
  }, [
    activeQuestionId,
    groundedSuggestionMeta,
    groundedSuggestionWarnings,
    groundedSuggestions,
    suggestionDecisions,
    suggestionDrafts,
  ]);

  const cachedGroundedQuestionCount = useMemo(
    () => Object.keys(groundedCacheRef.current).length,
    [activeQuestionId, groundedCacheTick],
  );
  const auditedGroundedDecisionCount = useMemo(() => {
    const events = [...(workspaceAudit?.events ?? []), ...(sessionAudit?.events ?? [])];
    return events.filter((event) =>
      ["grounded_suggestion_accepted", "grounded_suggestion_edited", "grounded_suggestion_rejected"].includes(
        event.action,
      ),
    ).length;
  }, [sessionAudit?.events, workspaceAudit?.events]);

  const visibleIndicators = indicators.length ? indicators : seedIndicators;
  const visibleFindings = findings.length ? findings : seedFindings;
  const materialTasks = useMemo(
    () =>
      buildMaterialTasks({
        caseStarterMaterials,
        decisions: materialQuestionLinkDecisions,
        evidenceMap,
        links: materialQuestionLinks,
        locale,
        materials: workspaceMaterials,
        questions,
        verifications: materialVerifications,
      }),
    [
      caseStarterMaterials,
      evidenceMap,
      materialQuestionLinkDecisions,
      materialQuestionLinks,
      locale,
      materialVerifications,
      questions,
      workspaceMaterials,
    ],
  );
  const operatorActions = useMemo(
    () =>
      buildOperatorActions({
        activeQuestionId: activeQuestion?.id,
        answerViews,
        caseStarterMaterials,
        evidenceMap,
        findings: visibleFindings,
        links: materialQuestionLinks,
        locale,
        materialTasks,
        materials: workspaceMaterials,
        questions,
      }),
    [
      activeQuestion?.id,
      answerViews,
      caseStarterMaterials,
      evidenceMap,
      materialQuestionLinks,
      materialTasks,
      locale,
      questions,
      visibleFindings,
      workspaceMaterials,
    ],
  );
  const visibleOperatorActions = useMemo(
    () => operatorActions.filter((action) => !dismissedOperatorActionIds.has(action.id)),
    [dismissedOperatorActionIds, operatorActions],
  );

  useEffect(() => {
    localeRef.current = locale;
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    if (activeOperationsTab === "review" || activeWorkMode === "review") {
      setWorkflowReviewVisited(true);
    }
  }, [activeOperationsTab, activeWorkMode]);

  const startTutorial = useCallback(() => {
    setLeftRailCollapsed(false);
    setTutorialStepIndex(0);
    setTutorialActive(true);
  }, []);

  const closeTutorial = useCallback(() => {
    setTutorialActive(false);
    setTutorialStepIndex(0);
  }, []);

  function openWorkMode(mode: WorkMode) {
    setActiveWorkMode(mode);
    if (mode !== "interview") {
      setActiveOperationsTab(mode);
    }
    if (mode === "review") {
      setWorkflowReviewVisited(true);
    }
    if (mode === "interview") {
      setLeftRailCollapsed(true);
    }
    setRightRailCollapsed(true);
  }

  const handleTutorialStepEnter = useCallback((step: TutorialStepDefinition) => {
    if (step.id === "zone-left" || step.id === "case-dossier" || step.id === "workflow-path") {
      setLeftRailCollapsed(false);
    }

    if (step.id === "zone-operations") {
      setRightRailCollapsed(false);
    }

    if (step.id === "tab-monitor") {
      setActiveWorkMode("monitor");
      setActiveOperationsTab("monitor");
    }
    if (step.id === "tab-ai") {
      setActiveWorkMode("ai");
      setActiveOperationsTab("ai");
    }
    if (step.id === "tab-materials") {
      setActiveWorkMode("materials");
      setActiveOperationsTab("materials");
    }
    if (step.id === "tab-review") {
      setActiveWorkMode("review");
      setActiveOperationsTab("review");
    }
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tutorial") === "1") {
      const timer = window.setTimeout(() => startTutorial(), 700);
      return () => window.clearTimeout(timer);
    }
  }, [startTutorial]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (tutorialActive) {
        return;
      }
      if (event.key !== "?") {
        return;
      }
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) {
          return;
        }
      }
      event.preventDefault();
      startTutorial();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [startTutorial, tutorialActive]);

  const workflowChecklist = useMemo(() => {
    const answeredCount = new Set(answerViews.map((answer) => answer.questionId)).size;
    return [
      {
        id: "question",
        label: text(locale, "workflowPathStepQuestion"),
        done: answeredCount > 0,
      },
      {
        id: "local-ai",
        label: text(locale, "workflowPathStepLocalAi"),
        done: environmentHealth !== null || localModelConfig !== null,
      },
      {
        id: "materials",
        label: text(locale, "workflowPathStepMaterials"),
        done: workspaceMaterials.length > 0,
      },
      {
        id: "grounded-ai",
        label: text(locale, "workflowPathStepGroundedAi"),
        done: groundedSuggestions.length > 0,
      },
      {
        id: "review",
        label: text(locale, "workflowPathStepReview"),
        done: workflowReviewVisited,
      },
      {
        id: "report",
        label: text(locale, "workflowPathStepReport"),
        done: sessionReportExported,
      },
    ];
  }, [
    answerViews,
    workflowReviewVisited,
    environmentHealth,
    groundedSuggestions.length,
    locale,
    localModelConfig,
    sessionReportExported,
    workspaceMaterials.length,
  ]);

  useEffect(() => {
    if (didInitializeApi.current) {
      return;
    }
    didInitializeApi.current = true;
    void initializeApiWorkflow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function initializeApiWorkflow() {
    if (isSubmitting || apiMode === "connecting") {
      return;
    }

    const requestLocale = localeRef.current;
    setApiMode("connecting");
    setStatusKey("connecting");

    try {
      const [catalog, caseReview, starterMaterials, participants] = await Promise.all([
        loadCaseCatalog(config, requestLocale).catch(() => ({ cases: seedCaseCatalog[requestLocale] })),
        loadCaseReview(config, requestLocale),
        loadCaseStarterMaterials(config, requestLocale).catch(() => ({ case_id: config.caseId, materials: [] })),
        loadCaseParticipants(config).catch(() => ({ case_id: config.caseId, participants: [] })),
      ]);
      if (localeRef.current !== requestLocale) {
        return;
      }
      const firstQuestionId = caseReview.case.questions[0]?.id ?? activeQuestionId;
      setCaseCatalog(catalog.cases);
      setCaseData(caseReview.case);
      setCaseStarterMaterials(starterMaterials.materials);
      setCaseParticipants(participants.participants);
      setActiveQuestionId(firstQuestionId);
      setIndicators(caseReview.indicators);
      setReview(caseReview.review);
      setFindings(caseReview.review.findings);
      await refreshSecurityState(firstQuestionId, requestLocale);
      await startOrResumeSession(config);
      const sessionReview = await loadSessionReview(config, requestLocale);
      const nextSessionAudit = await loadSessionAuditOrNull();
      if (localeRef.current !== requestLocale) {
        return;
      }
      setSession(sessionReview.session);
      setSessionAudit(nextSessionAudit);
      setIndicators(sessionReview.indicators);
      setReview(sessionReview.snapshot.review);
      setFindings(sessionReview.snapshot.review.findings);
      setReportMarkdown(sessionReview.report_markdown);
      setApiMode("online");
      setStatusKey("online");
    } catch (error) {
      if (localeRef.current !== requestLocale) {
        return;
      }
      console.warn("Local API unavailable, using static sample data.", error);
      setCaseCatalog(seedCaseCatalog[requestLocale]);
      setCaseStarterMaterials([]);
      setCaseParticipants([]);
      setReview(null);
      setReportMarkdown(null);
      setApiMode("offline");
      setStatusKey("offline");
    }
  }

  async function refreshSecurityState(questionId = activeQuestionId, requestLocale: Locale = localeRef.current) {
    try {
      const [security, health, modelConfig, ensuredWorkspace] = await Promise.all([
        loadEncryptionStatus(config),
        loadEnvironmentHealth(config),
        loadLocalModelConfig(config),
        ensureWorkspace(config),
      ]);
      await seedWorkspaceMaterials(config, requestLocale).catch((error) => {
        console.warn("Could not seed starter materials.", error);
        return null;
      });
      const [
        access,
        artifactManifest,
        artifactIsolation,
        workspaceSecurityReport,
        nextWorkflowReadiness,
        nextCaseQuality,
        experimentReadiness,
        stopReviews,
        materialList,
        draftList,
        materialLinks,
        nextEvidenceMap,
        operatorDecisions,
        nextGroundedSuggestions,
      ] = await Promise.all([
        loadWorkspaceAccess(config),
        loadModelArtifactManifest(config),
        loadModelArtifactIsolation(config),
        loadWorkspaceSecurity(config),
        loadWorkflowReadinessOrNull(requestLocale),
        loadCaseQualityOrNull(requestLocale),
        loadLocalModelExperimentReadiness(config),
        loadStopReviewsOrNull(),
        loadWorkspaceMaterials(config),
        loadQuestionDraftsOrEmpty(),
        loadMaterialQuestionLinksOrEmpty(requestLocale),
        loadEvidenceMapOrNull(requestLocale),
        loadOperatorActionDecisionsOrEmpty(),
        loadGroundedSuggestionsOrEmpty(requestLocale, questionId),
      ]);
      const auditTrail = await loadWorkspaceAuditOrNull();
      if (localeRef.current !== requestLocale) {
        return;
      }
      setEncryptionStatus(security);
      setEnvironmentHealth(health);
      setLocalModelConfig(modelConfig);
      setModelArtifactManifest(artifactManifest);
      setModelArtifactIsolation(artifactIsolation);
      setWorkspaceSecurity(workspaceSecurityReport);
      setWorkflowReadiness(nextWorkflowReadiness);
      setCaseQuality(nextCaseQuality);
      setModelExperimentReadiness(experimentReadiness);
      setStopReviewList(stopReviews);
      setWorkspaceAudit(auditTrail);
      setWorkspace(ensuredWorkspace);
      setWorkspaceAccess(access);
      setWorkspaceMaterials(sortMaterials(materialList.materials));
      setQuestionDrafts(sortQuestionDrafts(draftList));
      setMaterialQuestionLinks(materialLinks);
      setEvidenceMap(nextEvidenceMap);
      setOperatorActionDecisions(operatorDecisions);
      applyGroundedSuggestions(nextGroundedSuggestions);
    } catch (error) {
      console.warn("Could not refresh local workspace security state.", error);
      setEncryptionStatus(null);
      setEnvironmentHealth(null);
      setLocalModelConfig(null);
      setLocalModelSmoke(null);
      setModelExperimentReadiness(null);
      setModelArtifactManifest(null);
      setModelArtifactIsolation(null);
      setWorkspace(null);
      setWorkspaceSecurity(null);
      setWorkspaceAccess(null);
      setWorkflowReadiness(null);
      setCaseQuality(null);
      setStopReviewList(null);
      setWorkspaceAudit(null);
      setSessionAudit(null);
      setWorkspaceMaterials([]);
      setQuestionDrafts([]);
      setMaterialQuestionLinks([]);
      setMaterialQuestionLinkDecisions({});
      setMaterialPreviews({});
      setActiveMaterialPreviewId(null);
      setEvidenceMap(null);
      setEvidenceAlignment(null);
      setOperatorActionDecisions([]);
      applyGroundedSuggestions(null);
      setMaterialVerifications({});
    }
  }

  async function loadMaterialQuestionLinksOrEmpty(nextLocale: Locale): Promise<MaterialQuestionLink[]> {
    try {
      const materialLinks = await loadMaterialQuestionLinks(config, nextLocale);
      return materialLinks.links;
    } catch (error) {
      console.warn("Could not refresh material-question links.", error);
      return [];
    }
  }

  async function loadQuestionDraftsOrEmpty(): Promise<QuestionDraft[]> {
    try {
      const response = await loadWorkspaceQuestionDrafts(config);
      return response.drafts;
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.status === 404) {
        return [];
      }
      console.warn("Could not refresh workspace question drafts.", error);
      return [];
    }
  }

  async function loadEvidenceMapOrNull(nextLocale: Locale): Promise<EvidenceMap | null> {
    try {
      const response = await loadEvidenceMap(config, nextLocale);
      setEvidenceAlignment(response.evidence_alignment ?? null);
      return response.evidence_map;
    } catch (error) {
      console.warn("Could not refresh evidence map.", error);
      setEvidenceAlignment(null);
      return null;
    }
  }

  async function loadOperatorActionDecisionsOrEmpty(): Promise<OperatorActionDecision[]> {
    try {
      const response = await loadOperatorActionDecisions(config);
      return response.decisions;
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.status === 404) {
        return [];
      }
      console.warn("Could not refresh operator action decisions.", error);
      return [];
    }
  }

  async function loadWorkspaceAuditOrNull(): Promise<WorkspaceAuditResponse | null> {
    try {
      return await loadWorkspaceAudit(config);
    } catch (error) {
      console.warn("Could not refresh workspace audit trail.", error);
      return null;
    }
  }

  async function loadWorkflowReadinessOrNull(nextLocale: Locale = localeRef.current): Promise<WorkflowReadinessReport | null> {
    try {
      return await loadWorkspaceWorkflowReadiness(config, nextLocale);
    } catch (error) {
      console.warn("Could not refresh workflow readiness report.", error);
      return null;
    }
  }

  async function loadCaseQualityOrNull(nextLocale: Locale = locale): Promise<CaseQualityReport | null> {
    try {
      return await loadWorkspaceCaseQuality(config, nextLocale);
    } catch (error) {
      console.warn("Could not refresh case quality report.", error);
      return null;
    }
  }

  async function loadStopReviewsOrNull(): Promise<StopReviewListResponse | null> {
    try {
      return await loadWorkspaceStopReviews(config);
    } catch (error) {
      console.warn("Could not refresh STOP review decisions.", error);
      return null;
    }
  }

  async function loadSessionAuditOrNull(): Promise<SessionAuditResponse | null> {
    try {
      return await loadSessionAudit(config);
    } catch (error) {
      console.warn("Could not refresh session audit trail.", error);
      return null;
    }
  }

  async function refreshAuditTrails() {
    const [nextWorkspaceAudit, nextSessionAudit, nextWorkflowReadiness, nextCaseQuality] = await Promise.all([
      loadWorkspaceAuditOrNull(),
      loadSessionAuditOrNull(),
      loadWorkflowReadinessOrNull(localeRef.current),
      loadCaseQualityOrNull(localeRef.current),
    ]);
    setWorkspaceAudit(nextWorkspaceAudit);
    setSessionAudit(nextSessionAudit);
    setWorkflowReadiness(nextWorkflowReadiness);
    setCaseQuality(nextCaseQuality);
  }

  async function loadGroundedSuggestionsOrEmpty(
    nextLocale: Locale,
    questionId: string,
  ): Promise<GroundedSuggestionsResponse | null> {
    try {
      return await loadGroundedSuggestions(config, nextLocale, questionId);
    } catch (error) {
      console.warn("Could not refresh grounded suggestions.", error);
      return null;
    }
  }

  async function refreshGroundedSuggestions(
    nextLocale: Locale = locale,
    questionId: string = activeQuestionId,
    options: { clearOnError?: boolean } = {},
  ) {
    if (apiMode !== "online") {
      return;
    }

    delete groundedCacheRef.current[questionId];
    setGroundedCacheTick((value) => value + 1);
    setIsGroundedSuggestionsLoading(true);
    setGroundedSuggestionsError(null);

    try {
      const response = await loadGroundedSuggestions(config, nextLocale, questionId);
      applyGroundedSuggestions(response);
    } catch (error) {
      console.warn("Could not refresh grounded suggestions.", error);
      setGroundedSuggestionsError(formatGroundedAiError(error, nextLocale));
      if (options.clearOnError) {
        applyGroundedSuggestions(null);
      }
    } finally {
      setIsGroundedSuggestionsLoading(false);
    }
  }

  function refreshModelArtifactManifestAfterCapture(response: GroundedSuggestionsResponse | null) {
    if (!response?.prompt_artifact && !response?.context_artifact && !response?.output_artifact) {
      return;
    }

    void loadModelArtifactManifest(config)
      .then(setModelArtifactManifest)
      .catch((error) => {
        console.warn("Could not refresh model artifact manifest after grounded suggestions.", error);
      });
  }

  function applyGroundedSuggestions(response: GroundedSuggestionsResponse | null) {
    setGroundedSuggestions(response?.suggestions ?? []);
    setGroundedSuggestionWarnings(response?.warnings ?? []);
    setGroundedSuggestionMeta(
      response
        ? {
            model: response.model,
            promptVersion: response.prompt_version,
            promptHash: response.prompt_hash,
            contextHash: response.context_hash,
            outputHash: response.output_hash,
            promptArtifact: response.prompt_artifact ?? null,
            contextArtifact: response.context_artifact ?? null,
            outputArtifact: response.output_artifact ?? null,
            artifactWarning: response.artifact_warning ?? null,
            qualityReport: response.quality_report ?? null,
            supportReport: response.support_report ?? null,
            triageReport: response.triage_report ?? null,
          }
        : null,
    );
    setSuggestionDrafts({});
    setSuggestionDecisions({});
    refreshModelArtifactManifestAfterCapture(response);
  }

  async function startOrResumeSession(runtime: RuntimeConfig) {
    try {
      const started = await startSession(runtime);
      setSession(started);
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.status === 409) {
        return;
      }
      throw error;
    }
  }

  async function refreshLocalizedApiState(nextLocale: Locale) {
    const requestLocale = nextLocale;
    setApiMode("connecting");
    setStatusKey("connecting");
    groundedCacheRef.current = {};
    setGroundedCacheTick((value) => value + 1);

    try {
      await startOrResumeSession(config);
      await seedWorkspaceMaterials(config, requestLocale).catch((error) => {
        console.warn("Could not seed starter materials for localized refresh.", error);
        return null;
      });
      const [
        catalog,
        caseReview,
        starterMaterials,
        participants,
        sessionReview,
        draftList,
        materialList,
        materialLinks,
        nextEvidenceMap,
        nextWorkflowReadiness,
        nextCaseQuality,
        nextGroundedSuggestions,
      ] = await Promise.all([
        loadCaseCatalog(config, requestLocale).catch(() => ({ cases: seedCaseCatalog[requestLocale] })),
        loadCaseReview(config, requestLocale),
        loadCaseStarterMaterials(config, requestLocale).catch(() => ({ case_id: config.caseId, materials: [] })),
        loadCaseParticipants(config).catch(() => ({ case_id: config.caseId, participants: [] })),
        loadSessionReview(config, requestLocale),
        loadQuestionDraftsOrEmpty(),
        loadWorkspaceMaterials(config),
        loadMaterialQuestionLinksOrEmpty(requestLocale),
        loadEvidenceMapOrNull(requestLocale),
        loadWorkflowReadinessOrNull(requestLocale),
        loadCaseQualityOrNull(requestLocale),
        loadGroundedSuggestionsOrEmpty(requestLocale, activeQuestionId),
      ]);
      if (localeRef.current !== requestLocale) {
        return;
      }
      setCaseCatalog(catalog.cases);
      setCaseData(caseReview.case);
      setCaseStarterMaterials(starterMaterials.materials);
      setCaseParticipants(participants.participants);
      if (!caseReview.case.questions.some((question) => question.id === activeQuestionId)) {
        setActiveQuestionId(caseReview.case.questions[0]?.id ?? activeQuestionId);
      }
      setSession(sessionReview.session);
      setIndicators(sessionReview.indicators);
      setReview(sessionReview.snapshot.review);
      setFindings(sessionReview.snapshot.review.findings);
      setReportMarkdown(sessionReview.report_markdown);
      setQuestionDrafts(sortQuestionDrafts(draftList));
      setWorkspaceMaterials(sortMaterials(materialList.materials));
      setMaterialQuestionLinks(materialLinks);
      setEvidenceMap(nextEvidenceMap);
      setWorkflowReadiness(nextWorkflowReadiness);
      setCaseQuality(nextCaseQuality);
      applyGroundedSuggestions(nextGroundedSuggestions);
      setApiMode("online");
      setStatusKey("reviewUpdated");
    } catch (error) {
      if (localeRef.current !== requestLocale) {
        return;
      }
      console.warn("Could not refresh localized API state.", error);
      setCaseCatalog(seedCaseCatalog[requestLocale]);
      setCaseStarterMaterials([]);
      setCaseParticipants([]);
      setReview(null);
      setReportMarkdown(null);
      setApiMode("offline");
      setStatusKey("offline");
    }
  }

  async function recordAnswer() {
    const value = answerText.trim();
    if (!value || !activeQuestion) {
      setStatusKey("answerRequired");
      return;
    }

    setIsSubmitting(true);

    if (apiMode !== "online" || !session) {
      setLocalAnswers((current) => [
        ...current,
        {
          id: `local-answer-${current.length + 1}`,
          question_id: activeQuestion.id,
          text: value,
          topic_ids: activeQuestion.topicIds,
          created_at: new Date().toISOString(),
        },
      ]);
      setAnswerText("");
      setStatusKey("reviewUpdated");
      setIsSubmitting(false);
      return;
    }

    try {
      const timestamp = Date.now();
      await addAnswer(config, {
        id: `ui-answer-${timestamp}`,
        question_id: activeQuestion.id,
        text: value,
        event_id: `ui-event-answer-${timestamp}`,
        topic_ids: activeQuestion.topicIds,
        claims: [],
        workspace_id: config.workspaceId,
      });
      const [sessionReview, nextEvidenceMap, nextGroundedSuggestions] = await Promise.all([
        loadSessionReview(config, locale),
        loadEvidenceMapOrNull(locale),
        loadGroundedSuggestionsOrEmpty(locale, activeQuestion.id),
      ]);
      setSession(sessionReview.session);
      setIndicators(sessionReview.indicators);
      setReview(sessionReview.snapshot.review);
      setFindings(sessionReview.snapshot.review.findings);
      setReportMarkdown(sessionReview.report_markdown);
      setEvidenceMap(nextEvidenceMap);
      applyGroundedSuggestions(nextGroundedSuggestions);
      setAnswerText("");
      setStatusKey("reviewUpdated");
      void refreshAuditTrails();
    } catch (error) {
      console.error("Could not record answer.", error);
      setApiMode("offline");
      setStatusKey("saveFailed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function recordClaimReview(
    answer: AnswerView,
    claim: ClaimView,
    decision: ClaimReviewStatus,
    finalClaim: ClaimView = claim,
  ) {
    if (apiMode !== "online" || !session) {
      setStatusKey("offline");
      return;
    }

    setReviewingClaimIds((current) => new Set(current).add(claim.id));
    try {
      await reviewSessionClaim(config, answer.id, claim.id, {
        decision,
        subject: finalClaim.subject,
        attribute: finalClaim.attribute,
        value: finalClaim.value,
        source_text: finalClaim.sourceText,
      });
      const [sessionReview, nextEvidenceMap, nextGroundedSuggestions] = await Promise.all([
        loadSessionReview(config, locale),
        loadEvidenceMapOrNull(locale),
        loadGroundedSuggestionsOrEmpty(locale, activeQuestion?.id ?? activeQuestionId),
      ]);
      setSession(sessionReview.session);
      setIndicators(sessionReview.indicators);
      setReview(sessionReview.snapshot.review);
      setFindings(sessionReview.snapshot.review.findings);
      setReportMarkdown(sessionReview.report_markdown);
      setEvidenceMap(nextEvidenceMap);
      applyGroundedSuggestions(nextGroundedSuggestions);
      setStatusKey("claimReviewSaved");
      void refreshAuditTrails();
    } catch (error) {
      console.error("Could not review claim.", error);
      setStatusKey("claimReviewFailed");
    } finally {
      setReviewingClaimIds((current) => {
        const next = new Set(current);
        next.delete(claim.id);
        return next;
      });
    }
  }

  async function registerMaterial() {
    const title = materialDraft.title.trim();
    const content = materialDraft.content.trim();

    if (!title) {
      setStatusKey("materialTitleRequired");
      return;
    }
    if (!content) {
      setStatusKey("materialContentRequired");
      return;
    }
    if (apiMode !== "online" || !workspace) {
      setStatusKey("offline");
      return;
    }

    setIsMaterialSubmitting(true);
    try {
      const record = await registerWorkspaceMaterial(config, {
        id: createMaterialId(),
        title,
        content,
        source_type: materialDraft.sourceType,
        tags: parseTags(materialDraft.tags),
      });
      const verification = await verifyWorkspaceMaterial(config, record.id);
      const [materialLinks, nextEvidenceMap, nextGroundedSuggestions] = await Promise.all([
        loadMaterialQuestionLinksOrEmpty(locale),
        loadEvidenceMapOrNull(locale),
        loadGroundedSuggestionsOrEmpty(locale, activeQuestionId),
      ]);
      setWorkspaceMaterials((current) => sortMaterials([...current, record]));
      setMaterialVerifications((current) => ({ ...current, [record.id]: verification }));
      setMaterialQuestionLinks(materialLinks);
      setEvidenceMap(nextEvidenceMap);
      applyGroundedSuggestions(nextGroundedSuggestions);
      setMaterialDraft(emptyMaterialDraft);
      setStatusKey("materialSaved");
    } catch (error) {
      console.error("Could not register material.", error);
      setStatusKey("materialFailed");
    } finally {
      setIsMaterialSubmitting(false);
    }
  }

  async function verifyMaterial(materialId: string) {
    if (apiMode !== "online") {
      setStatusKey("offline");
      return;
    }

    try {
      const verification = await verifyWorkspaceMaterial(config, materialId);
      setMaterialVerifications((current) => ({ ...current, [materialId]: verification }));
      setStatusKey(
        verification.verified ? "verified" : verification.exists ? "changed" : "missing",
      );
    } catch (error) {
      console.error("Could not verify material.", error);
      setStatusKey("materialFailed");
    }
  }

  async function smokeLocalModel(executeReal = false) {
    if (apiMode !== "online") {
      setStatusKey("offline");
      return;
    }

    setIsModelSmokeRunning(true);
    try {
      const result = await runLocalModelSmoke(config, executeReal);
      setLocalModelSmoke(result);
      setStatusKey(result.ok ? "modelSmokeOk" : "modelSmokeFailed");
    } catch (error) {
      console.error("Could not run local model smoke check.", error);
      setStatusKey("modelSmokeFailed");
    } finally {
      setIsModelSmokeRunning(false);
    }
  }

  async function initializeModelArtifactIsolation() {
    if (apiMode !== "online") {
      setStatusKey("offline");
      return;
    }

    setIsArtifactIsolationSubmitting(true);
    try {
      const isolation = await ensureModelArtifactIsolation(config);
      const [health, manifest, readiness] = await Promise.all([
        loadEnvironmentHealth(config),
        loadModelArtifactManifest(config),
        loadLocalModelExperimentReadiness(config),
      ]);
      setModelArtifactIsolation(isolation);
      setModelArtifactManifest(manifest);
      setModelExperimentReadiness(readiness);
      setEnvironmentHealth(health);
      setStatusKey("artifactIsolationReady");
    } catch (error) {
      console.error("Could not initialize model artifact isolation.", error);
      setStatusKey("artifactIsolationFailed");
    } finally {
      setIsArtifactIsolationSubmitting(false);
    }
  }

  async function submitStopReviewDecision(decision: StopReviewDecisionType) {
    if (apiMode !== "online") {
      setStatusKey("offline");
      return;
    }

    setIsStopReviewSubmitting(true);
    try {
      await recordWorkspaceStopReview(config, {
        decision,
        rationale:
          decision === "approved"
            ? "Operator approved a controlled real-model smoke run from the Monitor panel."
            : "Operator rejected or reopened the controlled real-model smoke gate from the Monitor panel.",
        checklist:
          decision === "approved"
            ? [
                "Workspace security report reviewed.",
                "Model artifact isolation reviewed.",
                "Smoke prompt remains synthetic and case-data free.",
              ]
            : [],
      });
      const [readiness, stopReviews, auditTrail] = await Promise.all([
        loadLocalModelExperimentReadiness(config),
        loadStopReviewsOrNull(),
        loadWorkspaceAuditOrNull(),
      ]);
      setModelExperimentReadiness(readiness);
      setStopReviewList(stopReviews);
      setWorkspaceAudit(auditTrail);
      setStatusKey(decision === "approved" ? "stopReviewApproved" : "stopReviewRejected");
    } catch (error) {
      console.error("Could not record STOP review decision.", error);
      setStatusKey("stopReviewFailed");
    } finally {
      setIsStopReviewSubmitting(false);
    }
  }

  async function toggleMaterialPreview(materialId: string) {
    if (activeMaterialPreviewId === materialId) {
      setActiveMaterialPreviewId(null);
      return;
    }

    if (materialPreviews[materialId]) {
      setActiveMaterialPreviewId(materialId);
      return;
    }

    if (apiMode !== "online") {
      setStatusKey("offline");
      return;
    }

    try {
      const preview = await loadWorkspaceMaterialPreview(config, materialId);
      setMaterialPreviews((current) => ({ ...current, [materialId]: preview }));
      setActiveMaterialPreviewId(materialId);
      setStatusKey("materialPreviewLoaded");
    } catch (error) {
      console.error("Could not load material preview.", error);
      setStatusKey("materialPreviewFailed");
    }
  }

  async function decideMaterialQuestionLink(
    link: MaterialQuestionLink,
    decision: MaterialQuestionLinkDecision,
  ) {
    if (apiMode === "online") {
      try {
        await recordMaterialQuestionLinkDecision(config, { decision, link });
      } catch (error) {
        console.error("Could not audit material-question link decision.", error);
        setStatusKey("saveFailed");
        return;
      }
    }

    setMaterialQuestionLinkDecisions((current) => ({
      ...current,
      [materialQuestionLinkKey(link)]: decision,
    }));
    if (apiMode === "online") {
      void loadEvidenceMapOrNull(locale).then(setEvidenceMap);
      void refreshAuditTrails();
    }
    setStatusKey(decision === "accepted" ? "linkAccepted" : "linkRejected");
  }

  async function createQuestionDraftFromMaterialTask(task: MaterialTask) {
    if (!task.materialId) {
      setStatusKey("materialFailed");
      return;
    }
    if (apiMode !== "online" || !workspace) {
      setStatusKey("offline");
      return;
    }

    setIsQuestionDraftSubmitting(true);
    try {
      const response = await createWorkspaceQuestionDraft(config, {
        material_id: task.materialId,
        topic_id: task.topicId ?? null,
        source_object_ids: task.sourceObjectIds,
        action_id: task.id,
        locale,
      });
      const draft = response.draft;
      setQuestionDrafts((current) => sortQuestionDrafts(upsertQuestionDraft(current, draft)));
      setActiveQuestionId(draft.id);
      setActiveWorkMode("interview");
      setActiveOperationsTab("monitor");
      const [sessionReview, nextEvidenceMap, nextGroundedSuggestions] = await Promise.all([
        loadSessionReview(config, locale),
        loadEvidenceMapOrNull(locale),
        loadGroundedSuggestionsOrEmpty(locale, draft.id),
      ]);
      setSession(sessionReview.session);
      setIndicators(sessionReview.indicators);
      setReview(sessionReview.snapshot.review);
      setFindings(sessionReview.snapshot.review.findings);
      setReportMarkdown(sessionReview.report_markdown);
      setEvidenceMap(nextEvidenceMap);
      applyGroundedSuggestions(nextGroundedSuggestions);
      void refreshAuditTrails();
      setStatusKey("questionDraftCreated");
    } catch (error) {
      console.error("Could not create question draft.", error);
      setStatusKey("questionDraftFailed");
    } finally {
      setIsQuestionDraftSubmitting(false);
    }
  }

  function selectActiveQuestion(questionId: string) {
    setActiveQuestionId(questionId);
    if (apiMode !== "online") {
      return;
    }

    const cached = groundedCacheRef.current[questionId];
    if (cached) {
      setGroundedSuggestions(cached.suggestions);
      setGroundedSuggestionWarnings(cached.warnings);
      setGroundedSuggestionMeta(cached.meta);
      setSuggestionDecisions(cached.decisions);
      setSuggestionDrafts(cached.drafts);
      setGroundedSuggestionsError(null);
      setIsGroundedSuggestionsLoading(false);
      return;
    }

    void refreshGroundedSuggestions(locale, questionId, { clearOnError: true }).then(() => {
      void refreshAuditTrails();
    });
  }

  function startEditingSuggestion(suggestion: GroundedSuggestion) {
    setSuggestionDrafts((current) => ({
      ...current,
      [suggestion.id]: current[suggestion.id] ?? suggestion.text,
    }));
    setStatusKey("suggestionEdit");
  }

  async function useSuggestion(suggestion: GroundedSuggestion) {
    const finalText = suggestionDrafts[suggestion.id]?.trim() || suggestion.text;
    await recordSuggestionDecision(suggestion, "accepted", finalText, "suggestionUsed");
  }

  async function saveEditedSuggestion(suggestion: GroundedSuggestion) {
    const finalText = suggestionDrafts[suggestion.id]?.trim();
    if (!finalText) {
      setStatusKey("answerRequired");
      return;
    }
    await recordSuggestionDecision(suggestion, "edited", finalText, "suggestionEdited");
  }

  async function rejectSuggestion(suggestion: GroundedSuggestion) {
    const finalText = suggestionDrafts[suggestion.id]?.trim() || suggestion.text;
    await recordSuggestionDecision(suggestion, "rejected", finalText, "suggestionRejected");
  }

  async function recordSuggestionDecision(
    suggestion: GroundedSuggestion,
    decision: GroundedSuggestionDecision,
    finalText: string,
    nextStatus: CopyKey,
  ) {
    if (apiMode === "online") {
      try {
        await recordGroundedSuggestionDecision(config, suggestion.id, {
          decision,
          original_text: suggestion.text,
          final_text: finalText,
          suggestion_type: suggestion.suggestion_type,
          reason: suggestion.reason,
          linked_topics: suggestion.linked_topics,
          linked_evidence: suggestion.linked_evidence,
          risk_flags: suggestion.risk_flags,
          confidence: suggestion.confidence,
          model: groundedSuggestionMeta?.model ?? "",
          prompt_version: groundedSuggestionMeta?.promptVersion ?? "",
          prompt_hash: groundedSuggestionMeta?.promptHash ?? "",
          context_hash: groundedSuggestionMeta?.contextHash ?? "",
          output_hash: groundedSuggestionMeta?.outputHash ?? "",
          question_id: activeQuestionId,
        });
      } catch (error) {
        console.error("Could not audit grounded suggestion decision.", error);
        setStatusKey("saveFailed");
        return;
      }
    }

    setSuggestionDecisions((current) => ({ ...current, [suggestion.id]: decision }));
    if (decision === "accepted" || decision === "edited") {
      setSuggestionDrafts((current) => ({ ...current, [suggestion.id]: finalText }));
    }
    setStatusKey(nextStatus);
    if (apiMode === "online") {
      void refreshAuditTrails();
    }
  }

  function changeLocale(nextLocale: Locale) {
    localeRef.current = nextLocale;
    setLocale(nextLocale);
    if (apiMode !== "online") {
      setCaseCatalog(seedCaseCatalog[nextLocale]);
    }
    void refreshLocalizedApiState(nextLocale);
  }

  function navigateToRuntime(runtime: {
    case_id: string;
    session_id: string;
    workspace_id: string;
    participant_id: string;
  }) {
    const nextUrl = new URL(window.location.href);
    const currentApiParam = new URLSearchParams(window.location.search).get("api");
    nextUrl.searchParams.set("case", runtime.case_id);
    nextUrl.searchParams.set("session", runtime.session_id);
    nextUrl.searchParams.set("workspace", runtime.workspace_id);
    nextUrl.searchParams.set("participant", runtime.participant_id);
    if (currentApiParam) {
      nextUrl.searchParams.set("api", currentApiParam);
    }
    window.location.assign(nextUrl.toString());
  }

  async function submitNewCase() {
    const title = newCaseDraft.title.trim();
    if (!title || isCaseCreating) {
      setNewCaseError(text(locale, "newCaseTitleRequired"));
      return;
    }
    setIsCaseCreating(true);
    setNewCaseError(null);
    try {
      const response = await createLocalCase(config, {
        title,
        description: newCaseDraft.description.trim(),
        participant_name: newCaseDraft.participantName.trim(),
        locale,
      });
      setStatusKey("newCaseCreated");
      setIsNewCaseOpen(false);
      setNewCaseDraft(emptyNewCaseDraft);
      navigateToRuntime(response.runtime);
    } catch (error) {
      console.error("Could not create local case.", error);
      setNewCaseError(text(locale, "newCaseCreateFailed"));
      setStatusKey("newCaseCreateFailed");
    } finally {
      setIsCaseCreating(false);
    }
  }

  async function submitParticipant() {
    const name = participantDraft.trim();
    if (!name || isParticipantSubmitting) {
      return;
    }
    setIsParticipantSubmitting(true);
    try {
      const response = await addCaseParticipant(config, { name });
      setCaseParticipants(response.participants);
      setParticipantDraft("");
      setStatusKey("participantAdded");
    } catch (error) {
      console.error("Could not add participant.", error);
      setStatusKey("participantAddFailed");
    } finally {
      setIsParticipantSubmitting(false);
    }
  }

  function openParticipantInterview(participantId: string) {
    if (!participantId || participantId === config.participantId) {
      return;
    }
    const nextUrl = new URL(window.location.href);
    const currentApiParam = new URLSearchParams(window.location.search).get("api");
    const stamp = Date.now();
    nextUrl.searchParams.set("case", config.caseId);
    nextUrl.searchParams.set("participant", participantId);
    nextUrl.searchParams.set("session", `${config.caseId}-session-${stamp}`);
    nextUrl.searchParams.set("workspace", config.workspaceId);
    if (currentApiParam) {
      nextUrl.searchParams.set("api", currentApiParam);
    }
    window.location.assign(nextUrl.toString());
  }

  function openCase(caseId: string) {
    if (caseId === config.caseId) {
      return;
    }

    const nextUrl = new URL(window.location.href);
    const currentApiParam = new URLSearchParams(window.location.search).get("api");
    const stamp = Date.now();
    nextUrl.searchParams.set("case", caseId);
    nextUrl.searchParams.set("session", `${caseId}-session-${stamp}`);
    nextUrl.searchParams.set("workspace", `${caseId}-workspace-${stamp}`);
    nextUrl.searchParams.set("participant", config.participantId);
    if (currentApiParam) {
      nextUrl.searchParams.set("api", currentApiParam);
    }
    window.location.assign(nextUrl.toString());
  }

  function startNewWorkflowSession() {
    const nextUrl = new URL(window.location.href);
    const stamp = Date.now();
    nextUrl.searchParams.set("session", `${config.caseId}-session-${stamp}`);
    nextUrl.searchParams.set("workspace", `${config.caseId}-workspace-${stamp}`);
    window.location.assign(nextUrl.toString());
  }

  async function copyWorkflowBrief() {
    const answeredCount = new Set(answerViews.map((answer) => answer.questionId)).size;
    const summary = buildWorkflowBriefText({
      locale,
      config,
      caseData,
      answeredCount,
      questionCount: questions.length,
      materialCount: workspaceMaterials.length,
      findingCount: visibleFindings.length,
      indicatorCount: visibleIndicators.length,
      evidenceBand: evidenceAlignment?.band ?? null,
      environmentState: environmentHealth?.state ?? null,
      modelProvider: localModelConfig?.effective_provider ?? null,
      groundedCount: groundedSuggestions.length,
      operatorDecisionCount: operatorActionDecisions.length,
      workspaceAuditValid: workspaceAudit?.chain_valid ?? null,
      workspaceAuditCount: workspaceAudit?.events.length ?? 0,
      sessionAuditCount: sessionAudit?.events.length ?? 0,
    });

    try {
      await navigator.clipboard.writeText(summary);
      setStatusKey("workflowBriefCopied");
    } catch {
      setStatusKey("workflowBriefCopyFailed");
    }
  }

  async function recordOperatorActionDecisionType(
    action: OperatorAction,
    decisionType: OperatorActionDecisionType,
    nextState: Record<string, unknown>,
  ) {
    if (apiMode !== "online") {
      return;
    }
    try {
      const response = await recordOperatorActionDecision(config, {
        action_id: action.id,
        action_kind: action.kind,
        action_title: action.title,
        action_detail: action.detail,
        action_priority: action.priority,
        target_question_id: action.targetQuestionId ?? null,
        target_tab: action.targetTab ?? null,
        source_object_ids: action.sourceObjectIds ?? [],
        decision_type: decisionType,
        before_state: {
          active_question_id: activeQuestionId,
          active_operations_tab: activeOperationsTab,
        },
        after_state: nextState,
        model_id: groundedSuggestionMeta?.model ?? "",
        prompt_version: groundedSuggestionMeta?.promptVersion ?? "",
        prompt_hash: groundedSuggestionMeta?.promptHash ?? "",
        context_hash: groundedSuggestionMeta?.contextHash ?? "",
        output_hash: groundedSuggestionMeta?.outputHash ?? "",
      });
      setOperatorActionDecisions((current) => [response.decision, ...current].slice(0, 8));
      void refreshAuditTrails();
    } catch (error) {
      console.warn("Could not audit operator action decision.", error);
    }
  }

  function runOperatorAction(action: OperatorAction) {
    const nextState = {
      active_question_id: action.targetQuestionId ?? activeQuestionId,
      active_operations_tab: action.targetTab ?? activeOperationsTab,
    };
    void recordOperatorActionDecisionType(action, "opened", nextState);
    if (action.targetQuestionId) {
      selectActiveQuestion(action.targetQuestionId);
    }
    if (action.targetTab) {
      setActiveWorkMode(action.targetTab);
      setActiveOperationsTab(action.targetTab);
    }
  }

  function markOperatorAction(action: OperatorAction, decisionType: "skipped" | "dismissed") {
    const nextState = {
      active_question_id: activeQuestionId,
      active_operations_tab: activeOperationsTab,
      hidden_action_id: action.id,
    };
    setDismissedOperatorActionIds((current) => new Set([...current, action.id]));
    void recordOperatorActionDecisionType(action, decisionType, nextState);
  }

  const answeredQuestionIds = useMemo(
    () => new Set(answerViews.map((answer) => answer.questionId)),
    [answerViews],
  );
  const answeredQuestionCount = answeredQuestionIds.size;
  const urgentOperatorActionCount = visibleOperatorActions.filter((action) => action.priority === "high").length;
  const questionCoverageLabel = `${answeredQuestionCount}/${questions.length}`;
  const topicCoverageLabel = useMemo(() => {
    const topicCount = caseData?.topics?.length ?? 0;
    if (!review || !topicCount) {
      return null;
    }
    return `${review.covered_topic_ids.length}/${topicCount}`;
  }, [caseData?.topics, review]);
  const sessionReportExportInput = useMemo<SessionReportExportInput | null>(() => {
    if (!reportMarkdown) {
      return null;
    }
    return {
      locale,
      config,
      caseData,
      materialCount: workspaceMaterials.length,
      groundedCount: groundedSuggestions.length,
      operatorDecisionCount: operatorActionDecisions.length,
      workspaceAuditValid: workspaceAudit?.chain_valid ?? null,
      workspaceAuditCount: workspaceAudit?.events.length ?? 0,
      sessionAuditCount: sessionAudit?.events.length ?? 0,
      modelProvider: localModelConfig?.effective_provider ?? null,
      environmentState: environmentHealth?.state ?? null,
      answerViews,
      questions,
      activeQuestionId,
      groundedSuggestions,
      suggestionDecisions,
      groundedModel: groundedSuggestionMeta?.model ?? null,
      groundedPromptVersion: groundedSuggestionMeta?.promptVersion ?? null,
      auditEvents: [...(workspaceAudit?.events ?? []), ...(sessionAudit?.events ?? [])],
      integrityManifest: null,
    };
  }, [
    activeQuestionId,
    answerViews,
    caseData,
    config,
    environmentHealth?.state,
    groundedSuggestionMeta?.model,
    groundedSuggestionMeta?.promptVersion,
    groundedSuggestions,
    locale,
    localModelConfig?.effective_provider,
    operatorActionDecisions.length,
    questions,
    reportMarkdown,
    sessionAudit?.events,
    suggestionDecisions,
    workspaceAudit?.chain_valid,
    workspaceAudit?.events,
    workspaceMaterials.length,
  ]);
  const topicsById = useMemo(
    () => new Map((caseData?.topics ?? []).map((topic) => [topic.id, topic])),
    [caseData],
  );
  const questionsById = useMemo(() => new Map(questions.map((question) => [question.id, question])), [questions]);
  const participantRoleLine = sessionRoleLine(config.caseId, locale);
  const assistantHints = useMemo(() => {
    if (visibleFindings.length) {
      return visibleFindings.slice(0, 2).map((finding) => ({
        title: findingTitle(finding, locale),
        detail: findingDetail(finding, locale),
      }));
    }
    return caseAssistantHints(config.caseId, locale);
  }, [config.caseId, locale, visibleFindings]);

  const operationsTabs: Array<{
    id: OperationsTab;
    label: string;
    value: string;
    icon: ReactNode;
  }> = [
    {
      id: "monitor",
      label: text(locale, "operationsMonitor"),
      value: environmentHealth
        ? environmentStateShortLabel(environmentHealth.state, locale)
        : apiMode === "connecting"
          ? "..."
          : apiMode,
      icon: <ShieldCheck size={15} />,
    },
    {
      id: "ai",
      label: text(locale, "operationsAi"),
      value: String(groundedSuggestions.length),
      icon: <Sparkles size={15} />,
    },
    {
      id: "materials",
      label: text(locale, "operationsMaterials"),
      value: String(workspaceMaterials.length),
      icon: <FolderArchive size={15} />,
    },
    {
      id: "review",
      label: text(locale, "operationsReview"),
      value: String(visibleFindings.length),
      icon: <ListChecks size={15} />,
    },
  ];
  const activeOperationsMode: OperationsTab = activeWorkMode === "interview" ? activeOperationsTab : activeWorkMode;
  const activeWorkModeLabel =
    activeWorkMode === "interview"
      ? text(locale, "workModeInterview")
      : activeWorkMode === "monitor"
        ? text(locale, "workModeSystem")
      : operationsTabs.find((tab) => tab.id === activeOperationsMode)?.label ?? text(locale, "operationsMonitor");
  const workModes: WorkModeDescriptor[] = [
    {
      id: "interview",
      label: text(locale, "workModeInterview"),
      detail: text(locale, "workModeInterviewDetail"),
      value: questionCoverageLabel,
      icon: <FileText size={16} />,
    },
    {
      id: "materials",
      label: text(locale, "operationsMaterials"),
      detail: text(locale, "workModeMaterialsDetail"),
      value: String(workspaceMaterials.length),
      icon: <FolderArchive size={16} />,
    },
    {
      id: "ai",
      label: text(locale, "operationsAi"),
      detail: text(locale, "workModeAiDetail"),
      value: String(groundedSuggestions.length),
      icon: <Sparkles size={16} />,
    },
    {
      id: "review",
      label: text(locale, "operationsReview"),
      detail: text(locale, "workModeReviewDetail"),
      value: String(visibleFindings.length),
      icon: <ListChecks size={16} />,
    },
    {
      id: "monitor",
      label: text(locale, "workModeSystem"),
      detail: text(locale, "workModeSystemDetail"),
      value: environmentHealth
        ? environmentStateShortLabel(environmentHealth.state, locale)
        : apiMode === "connecting"
          ? "..."
          : apiMode,
      icon: <ShieldCheck size={16} />,
    },
  ];
  const primaryGuidanceAction = visibleOperatorActions[0];
  const linkedActiveQuestionMaterials = activeQuestionId
    ? materialQuestionLinks
        .filter((link) => link.question_id === activeQuestionId)
        .map((link) => workspaceMaterials.find((material) => material.id === link.material_id))
        .filter((material): material is MaterialRecord => Boolean(material))
    : [];
  const firstGuidanceMaterial = linkedActiveQuestionMaterials[0] ?? workspaceMaterials[0];
  const operationsGuidanceActions: OperationsGuidanceAction[] = [
    primaryGuidanceAction
      ? {
          id: `priority-${primaryGuidanceAction.id}`,
          label: text(locale, "operationsActionPriority"),
          detail: `${primaryGuidanceAction.title}: ${primaryGuidanceAction.detail}`,
          icon: operatorActionIcon(primaryGuidanceAction.kind),
          onClick: () => runOperatorAction(primaryGuidanceAction),
          variant: "primary",
        }
      : {
          id: "priority-empty",
          label: text(locale, "operationsActionNoPriority"),
          detail: text(locale, "operationsActionNoPriorityDetail"),
          disabled: true,
          icon: <CheckCircle2 size={16} />,
          onClick: () => undefined,
          variant: "primary",
        },
    ...operationsTabQuickActions({
      activeTab: activeOperationsMode,
      firstMaterial: firstGuidanceMaterial,
      locale,
      onOpenAi: () => openWorkMode("ai"),
      onOpenMaterials: () => openWorkMode("materials"),
      onOpenMonitor: () => openWorkMode("monitor"),
      onOpenReview: () => openWorkMode("review"),
      onPreviewMaterial: (materialId) => void toggleMaterialPreview(materialId),
      onRegenerateAi: () => void refreshGroundedSuggestions(),
      starterMaterialsById,
    }),
  ];

  return (
    <div
      className="app-shell"
      data-density={uiDensity}
      data-perspective={workspacePerspective}
      data-theme={uiTheme}
      data-work-mode={activeWorkMode}
    >
      <header className="topbar" data-tutorial="topbar">
        <div className="brand-block">
          <img className="brand-mark" src="/brand/logo-mark.svg" alt="InterrogA(I)tion" width={44} height={44} />
          <div>
            <h1>InterrogA(I)tion</h1>
            <p>{caseData?.title ?? text(locale, "caseFallback")}</p>
            <p className="topbar-session-meta auditor-only">
              {config.caseId} · {config.sessionId} · {config.participantId}
            </p>
          </div>
        </div>

        <div className="topbar-actions">
          <button className="topbar-primary-action" type="button" onClick={() => setIsNewCaseOpen(true)}>
            <Plus size={15} />
            <span>{text(locale, "newCase")}</span>
          </button>
          <TutorialLaunchButton locale={locale} onStart={startTutorial} />
          <StatusStrip
            apiMode={apiMode}
            locale={locale}
            statusKey={statusKey}
            onReconnect={() => void initializeApiWorkflow()}
          />
          <div className="view-options-toggle" aria-label={text(locale, "viewOptions")}>
            <button
              title={text(locale, "commandPaletteHint")}
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
            >
              <MoreHorizontal size={15} />
              <span>{text(locale, "commandPalette")}</span>
            </button>
            <button
              aria-pressed={uiTheme === "dark"}
              title={text(locale, uiTheme === "dark" ? "themeLight" : "themeDark")}
              type="button"
              onClick={() => setUiTheme((current) => (current === "dark" ? "light" : "dark"))}
            >
              {uiTheme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
              <span>{text(locale, uiTheme === "dark" ? "themeLight" : "themeDark")}</span>
            </button>
            <button
              aria-pressed={uiDensity === "compact"}
              title={text(locale, uiDensity === "compact" ? "densityComfortable" : "densityCompact")}
              type="button"
              onClick={() => setUiDensity((current) => (current === "compact" ? "comfortable" : "compact"))}
            >
              <ListChecks size={15} />
              <span>{text(locale, uiDensity === "compact" ? "densityComfortable" : "densityCompact")}</span>
            </button>
          </div>
          <div className="perspective-toggle" aria-label={text(locale, "perspectiveToggle")}>
            <button
              aria-pressed={workspacePerspective === "operator"}
              className={workspacePerspective === "operator" ? "is-active" : ""}
              title={text(locale, "operatorPerspectiveDetail")}
              type="button"
              onClick={() => setWorkspacePerspective("operator")}
            >
              <Eye size={15} />
              {text(locale, "operatorPerspective")}
            </button>
            <button
              aria-pressed={workspacePerspective === "auditor"}
              className={workspacePerspective === "auditor" ? "is-active" : ""}
              title={text(locale, "auditorPerspectiveDetail")}
              type="button"
              onClick={() => setWorkspacePerspective("auditor")}
            >
              <Fingerprint size={15} />
              {text(locale, "auditorPerspective")}
            </button>
          </div>
          <div className="language-toggle" aria-label="Language">
            <button
              className={locale === "pl" ? "is-active" : ""}
              type="button"
              onClick={() => changeLocale("pl")}
            >
              <Languages size={15} />
              PL
            </button>
            <button
              className={locale === "en" ? "is-active" : ""}
              type="button"
              onClick={() => changeLocale("en")}
            >
              <Languages size={15} />
              EN
            </button>
          </div>
        </div>
        <div className="sr-live-region" aria-live="polite" aria-atomic="true">
          {text(locale, statusKey)}
        </div>
      </header>

      <WorkModeNavigation
        activeMode={activeWorkMode}
        locale={locale}
        modes={workModes}
        onSelect={openWorkMode}
      />

      <main
        className="workspace"
        data-left-collapsed={leftRailCollapsed ? "true" : "false"}
        data-right-collapsed={rightRailCollapsed ? "true" : "false"}
        data-work-mode={activeWorkMode}
      >
        <WorkspaceZone
          collapsed={leftRailCollapsed}
          disclosureHint={text(locale, "expandWhenNeeded")}
          label={text(locale, "zoneCasePrep")}
          locale={locale}
          side="left"
          tutorialId="zone-left"
          onToggleCollapse={() => setLeftRailCollapsed((current) => !current)}
        >
          <aside className="case-sidebar">
            <WorkflowPathPanel
              checklist={workflowChecklist}
              compact={activeWorkMode === "interview"}
              locale={locale}
              onCopySummary={() => void copyWorkflowBrief()}
              onOpenAi={() => openWorkMode("ai")}
              onOpenMaterials={() => openWorkMode("materials")}
              onOpenMonitor={() => openWorkMode("monitor")}
              onOpenNextQuestion={() => {
                const answeredQuestionIds = new Set(answerViews.map((answer) => answer.questionId));
                const nextQuestion = questions.find((question) => !answeredQuestionIds.has(question.id));
                if (nextQuestion) {
                  setActiveWorkMode("interview");
                  selectActiveQuestion(nextQuestion.id);
                }
              }}
              onOpenReview={() => openWorkMode("review")}
              onStartFresh={startNewWorkflowSession}
            />
            {activeWorkMode !== "interview" ? (
              <>
                <CaseCatalogPanel
                  cases={caseCatalog}
                  currentCaseId={config.caseId}
                  locale={locale}
                  onCreateCase={() => setIsNewCaseOpen(true)}
                  onOpenCase={openCase}
                />
                <CaseDossierPanel
                  answerCount={answerViews.length}
                  caseData={caseData}
                  locale={locale}
                  review={review}
                  starterMaterials={caseStarterMaterials}
                  onOpenMaterials={() => openWorkMode("materials")}
                />
                <CaseParticipantsPanel
                  canEdit={config.caseId.startsWith("case-local-")}
                  currentParticipantId={config.participantId}
                  draft={participantDraft}
                  isSubmitting={isParticipantSubmitting}
                  locale={locale}
                  participants={caseParticipants}
                  onDraftChange={setParticipantDraft}
                  onInterviewParticipant={openParticipantInterview}
                  onSubmit={() => void submitParticipant()}
                />
              </>
            ) : null}
            <CollapsibleSection
              className="question-panel"
              hint={text(locale, "expandWhenNeeded")}
              meta={`${questionCoverageLabel} · ${formatCount(questions.length, locale, {
                singular: text(locale, "questionSingular"),
                pluralFew: text(locale, "questionPluralFew"),
                pluralMany: text(locale, "questionPluralMany"),
              })}`}
              title={text(locale, "questions")}
            >
              <div className="question-list">
                {questions.map((question, index) => (
                  <QuestionListItem
                    answered={answeredQuestionIds.has(question.id)}
                    index={index}
                    isActive={question.id === activeQuestionId}
                    key={question.id}
                    locale={locale}
                    question={question}
                    topicsById={topicsById}
                    onSelect={() => selectActiveQuestion(question.id)}
                  />
                ))}
              </div>
            </CollapsibleSection>
          </aside>
        </WorkspaceZone>

        <WorkspaceZone
          collapsed={false}
          label={activeWorkMode === "interview" ? text(locale, "zoneInterview") : activeWorkModeLabel}
          locale={locale}
          side="center"
          onToggleCollapse={() => undefined}
        >
          <section className="work-mode-canvas" data-mode={activeWorkMode}>
            {activeWorkMode === "interview" ? (
              <div className="interview-workspace">
            <InterviewContextStrip
              caseId={config.caseId}
              coverageLabel={questionCoverageLabel}
              locale={locale}
              participantId={config.participantId}
              roleLabel={participantRoleLine}
              sessionId={config.sessionId}
              topicCoverageLabel={topicCoverageLabel}
              urgentActionCount={urgentOperatorActionCount}
            />

            {visibleOperatorActions.length ? (
              <WorkspaceCard
                className="operator-queue-card operator-queue-card--banner"
                meta={`${visibleOperatorActions.length} · ${questionCoverageLabel}`}
                title={text(locale, "operatorQueue")}
              >
                <OperatorWorkflowPanel
                  actions={visibleOperatorActions}
                  answeredCount={answeredQuestionCount}
                  compact
                  embedded
                  findingCount={visibleFindings.length}
                  locale={locale}
                  materialCount={workspaceMaterials.length}
                  maxVisibleActions={1}
                  questionCount={questions.length}
                  recentDecisions={operatorActionDecisions.slice(0, 4)}
                  onAction={runOperatorAction}
                  onDecision={markOperatorAction}
                />
              </WorkspaceCard>
            ) : null}

            <WorkspaceCard
              className="active-question-card"
              highlight
              meta={
                activeQuestion
                  ? `${localize(activeQuestion.type, locale)} · ${
                      answeredQuestionIds.has(activeQuestion.id)
                        ? text(locale, "questionAnswered")
                        : text(locale, "questionPending")
                    }`
                  : ""
              }
              title={text(locale, "activeQuestion")}
              tutorialId="active-question"
            >
              <p className="active-question-text">{localize(activeQuestion?.text, locale)}</p>
              <LinkedMaterialStrip
                links={activeQuestionLinks}
                locale={locale}
                materialsById={materialsById}
                starterMaterialsById={starterMaterialsById}
              />
            </WorkspaceCard>

            <CollapsibleWorkspaceCard
              className="answer-history-card"
              meta={String(answerViews.length)}
              scrollable
              title={text(locale, "answerHistory")}
            >
              <div className="answer-stream">
                {answerViews.length ? (
                  answerViews.map((answer) => (
                    <AnswerHistoryCard
                      answer={answer}
                      key={answer.id}
                      locale={locale}
                      onEditClaim={(claim) => setClaimEditDraft({ answer, claim, value: claim.value })}
                      onReview={recordClaimReview}
                      question={questionsById.get(answer.questionId)}
                      reviewingClaimIds={reviewingClaimIds}
                    />
                  ))
                ) : (
                  <p className="empty-state">{text(locale, "noAnswers")}</p>
                )}
              </div>
            </CollapsibleWorkspaceCard>

            <WorkspaceCard sticky title={text(locale, "record")} tutorialId="answer-composer">
              <div className="answer-composer">
                <textarea
                  rows={3}
                  placeholder={text(locale, "answerPlaceholder")}
                  value={answerText}
                  onChange={(event) => setAnswerText(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                      void recordAnswer();
                    }
                  }}
                />
                <button type="button" disabled={isSubmitting} onClick={() => void recordAnswer()}>
                  <Send size={16} />
                  {isSubmitting ? "..." : text(locale, "record")}
                </button>
              </div>
                </WorkspaceCard>
              </div>
            ) : null}

            {activeWorkMode === "materials" ? (
              <>
                <WorkModeHeader
                  detail={text(locale, "workModeMaterialsDetail")}
                  icon={<FolderArchive size={18} />}
                  metrics={[
                    { label: text(locale, "materialRecordCount"), value: String(workspaceMaterials.length) },
                    { label: text(locale, "materialLinksShort"), value: String(materialQuestionLinks.length) },
                    { label: text(locale, "pendingLinks"), value: String(materialTasks.length) },
                  ]}
                  title={text(locale, "operationsMaterials")}
                />
                {apiMode !== "online" ? (
                  <WorkspaceEmptyState
                    detail={text(locale, "operationsOfflineDetail")}
                    locale={locale}
                    title={text(locale, "operationsOfflineTitle")}
                  />
                ) : (
                  <div className="mode-surface mode-surface--materials">
                    <MaterialsPanel
                      activePreviewId={activeMaterialPreviewId}
                      apiMode={apiMode}
                      bare
                      decisions={materialQuestionLinkDecisions}
                      draft={materialDraft}
                      isSubmitting={isMaterialSubmitting}
                      locale={locale}
                      links={materialQuestionLinks}
                      materials={workspaceMaterials}
                      starterMaterials={caseStarterMaterials}
                      tasks={materialTasks}
                      isQuestionDraftSubmitting={isQuestionDraftSubmitting}
                      previews={materialPreviews}
                      verifications={materialVerifications}
                      onDecideLink={(link, decision) => void decideMaterialQuestionLink(link, decision)}
                      onCreateQuestionDraft={(task) => void createQuestionDraftFromMaterialTask(task)}
                      onDraftChange={setMaterialDraft}
                      onOpenQuestion={(questionId) => {
                        setActiveWorkMode("interview");
                        selectActiveQuestion(questionId);
                      }}
                      onPreview={(materialId) => void toggleMaterialPreview(materialId)}
                      onSubmit={() => void registerMaterial()}
                      onVerify={(materialId) => void verifyMaterial(materialId)}
                    />
                  </div>
                )}
              </>
            ) : null}

            {activeWorkMode === "ai" ? (
              <>
                <WorkModeHeader
                  detail={text(locale, "workModeAiDetail")}
                  icon={<Sparkles size={18} />}
                  metrics={[
                    { label: text(locale, "operationsAi"), value: String(groundedSuggestions.length) },
                    { label: text(locale, "auditedAiDecisionsShort"), value: String(auditedGroundedDecisionCount) },
                    {
                      label: text(locale, "activeQuestion"),
                      value: activeQuestion ? `${activeQuestionIndex + 1}/${questions.length}` : "-",
                    },
                  ]}
                  title={text(locale, "groundedAi")}
                />
                {apiMode !== "online" ? (
                  <WorkspaceEmptyState
                    detail={text(locale, "operationsOfflineDetail")}
                    locale={locale}
                    title={text(locale, "operationsOfflineTitle")}
                  />
                ) : (
                  <div className="mode-grid mode-grid--ai">
                    <section className="mode-section mode-section--main">
                      <GroundedSuggestionsPanel
                        apiMode={apiMode}
                        bare
                        decisions={suggestionDecisions}
                        drafts={suggestionDrafts}
                        error={groundedSuggestionsError}
                        isLoading={isGroundedSuggestionsLoading}
                        locale={locale}
                        localModelConfig={localModelConfig}
                        meta={groundedSuggestionMeta}
                        suggestions={groundedSuggestions}
                        warnings={groundedSuggestionWarnings}
                        onDraftChange={(suggestionId, value) =>
                          setSuggestionDrafts((current) => ({ ...current, [suggestionId]: value }))
                        }
                        onEdit={startEditingSuggestion}
                        onRegenerate={() => void refreshGroundedSuggestions()}
                        onReject={rejectSuggestion}
                        onSaveEdit={saveEditedSuggestion}
                        onUse={(suggestion) => {
                          setActiveWorkMode("interview");
                          useSuggestion(suggestion);
                        }}
                      />
                    </section>
                    <div className="mode-side-stack">
                      <CollapsibleSection
                        accordionGroup="mode-ai"
                        className="mode-section auditor-only"
                        defaultOpen
                        hint={text(locale, "expandWhenNeeded")}
                        meta={text(locale, "developerPreview")}
                        title={text(locale, "groundingPack")}
                      >
                        <GroundingPackPanel
                          activeQuestionId={activeQuestionId}
                          apiMode={apiMode}
                          config={config}
                          locale={locale}
                          questions={questions}
                        />
                      </CollapsibleSection>
                      <CollapsibleSection
                        accordionGroup="mode-ai"
                        className="mode-section"
                        hint={text(locale, "expandWhenNeeded")}
                        meta={text(locale, "localOnly")}
                        title={text(locale, "assistant")}
                      >
                        <div className="suggestion-list">
                          {assistantHints.map((hint) => (
                            <SuggestionCard detail={hint.detail} key={hint.title} title={hint.title} />
                          ))}
                        </div>
                      </CollapsibleSection>
                    </div>
                  </div>
                )}
              </>
            ) : null}

            {activeWorkMode === "review" ? (
              <>
                <WorkModeHeader
                  detail={text(locale, "workModeReviewDetail")}
                  icon={<ListChecks size={18} />}
                  metrics={[
                    { label: text(locale, "caseQuality"), value: caseQuality ? `${caseQuality.quality_score}%` : "-" },
                    { label: text(locale, "findings"), value: String(visibleFindings.length) },
                    {
                      label: text(locale, "auditEvents"),
                      value: String((workspaceAudit?.events.length ?? 0) + (sessionAudit?.events.length ?? 0)),
                    },
                  ]}
                  title={text(locale, "operationsReview")}
                />
                {apiMode !== "online" ? (
                  <WorkspaceEmptyState
                    detail={text(locale, "operationsOfflineDetail")}
                    locale={locale}
                    title={text(locale, "operationsOfflineTitle")}
                  />
                ) : (
                  <div className="review-workbench">
                    <ReviewTabList
                      activeTab={activeReviewTab}
                      auditCount={(workspaceAudit?.events.length ?? 0) + (sessionAudit?.events.length ?? 0)}
                      findingCount={visibleFindings.length}
                      locale={locale}
                      qualityScore={caseQuality?.quality_score ?? null}
                      reportReady={Boolean(reportMarkdown)}
                      onSelect={setActiveReviewTab}
                    />
                    {activeReviewTab === "report" ? (
                      <section className="mode-section mode-section--main">
                        <PanelHeader title={text(locale, "sessionReport")} meta={text(locale, "sessionReportMeta")} compact />
                        <SessionReportPanel
                          apiMode={apiMode}
                          config={config}
                          exportInput={sessionReportExportInput}
                          locale={locale}
                          preview={reportMarkdown}
                          onExported={() => {
                            setSessionReportExported(true);
                            setStatusKey("sessionReportCopied");
                            void refreshAuditTrails();
                          }}
                        />
                      </section>
                    ) : null}
                    {activeReviewTab === "quality" ? (
                      <div className="review-tab-grid">
                        <section className="mode-section">
                          <PanelHeader
                            title={text(locale, "caseQuality")}
                            meta={caseQuality ? `${caseQuality.quality_score}%` : text(locale, "unknown")}
                            compact
                          />
                          <CaseQualityPanel bare locale={locale} report={caseQuality} />
                        </section>
                        <section className="mode-section">
                          <PanelHeader
                            title={text(locale, "workflowReadiness")}
                            meta={workflowReadiness ? environmentStateLabel(workflowReadiness.state, locale) : text(locale, "unknown")}
                            compact
                          />
                          <WorkflowReadinessPanel bare locale={locale} report={workflowReadiness} />
                        </section>
                      </div>
                    ) : null}
                    {activeReviewTab === "stop" ? (
                      <section className="mode-section">
                        <PanelHeader title={text(locale, "stopReadiness")} meta={text(locale, "noAutomatedVerdict")} compact />
                        <StopReadinessPanel
                          bare
                          encryptionStatus={encryptionStatus}
                          locale={locale}
                          localModelConfig={localModelConfig}
                          modelArtifactManifest={modelArtifactManifest}
                          sessionAudit={sessionAudit}
                          workspace={workspace}
                          workspaceAudit={workspaceAudit}
                        />
                      </section>
                    ) : null}
                    {activeReviewTab === "audit" ? (
                      <section className="mode-section auditor-only">
                        <PanelHeader
                          title={text(locale, "provenanceTimeline")}
                          meta={`${(workspaceAudit?.events.length ?? 0) + (sessionAudit?.events.length ?? 0)} ${text(locale, "auditEvents")}`}
                          compact
                        />
                        <ProvenanceTimelinePanel
                          bare
                          locale={locale}
                          sessionAudit={sessionAudit}
                          workspaceAudit={workspaceAudit}
                        />
                      </section>
                    ) : null}
                    {activeReviewTab === "analytics" ? (
                      <div className="review-tab-grid">
                        <section className="mode-section">
                          <PanelHeader title={text(locale, "investigativeBoard")} meta={text(locale, "reviewSignals")} compact />
                          <InvestigativeBoardPanel
                            bare
                            caseData={caseData}
                            evidenceMap={evidenceMap}
                            findings={visibleFindings}
                            locale={locale}
                            materialsById={materialsById}
                            starterMaterialsById={starterMaterialsById}
                          />
                        </section>
                        <section className="mode-section">
                          <PanelHeader title={text(locale, "indicators")} meta={text(locale, "visible")} compact />
                          <div className="indicator-list">
                            {visibleIndicators.map((indicator) => (
                              <IndicatorCard indicator={indicator} key={indicator.id} locale={locale} />
                            ))}
                          </div>
                        </section>
                        <section className="mode-section">
                          <PanelHeader
                            title={text(locale, "findings")}
                            meta={formatCount(visibleFindings.length, locale, {
                              singular: text(locale, "findingSingular"),
                              pluralFew: text(locale, "findingPluralFew"),
                              pluralMany: text(locale, "findingPluralMany"),
                            })}
                            compact
                          />
                          <div className="finding-list">
                            {visibleFindings.map((finding) => (
                              <FindingCard finding={finding} key={`${finding.category}-${finding.title}`} locale={locale} />
                            ))}
                          </div>
                        </section>
                      </div>
                    ) : null}
                  </div>
                )}
              </>
            ) : null}

            {activeWorkMode === "monitor" ? (
              <>
                <WorkModeHeader
                  detail={text(locale, "workModeSystemDetail")}
                  icon={<ShieldCheck size={18} />}
                  metrics={[
                    {
                      label: text(locale, "environmentHealth"),
                      value: environmentHealth ? environmentStateShortLabel(environmentHealth.state, locale) : "-",
                    },
                    { label: text(locale, "sourceMaterials"), value: String(workspaceMaterials.length) },
                    { label: text(locale, "workspaceAudit"), value: String(workspaceAudit?.events.length ?? 0) },
                  ]}
                  title={text(locale, "workModeSystem")}
                />
                {apiMode !== "online" ? (
                  <WorkspaceEmptyState
                    detail={text(locale, "operationsOfflineDetail")}
                    locale={locale}
                    title={text(locale, "operationsOfflineTitle")}
                  />
                ) : (
                  <div className="mode-grid mode-grid--system">
                    <section className="mode-section mode-section--main">
                      <PanelHeader
                        title={text(locale, "security")}
                        meta={workspace?.manifest?.status ?? text(locale, "unknown")}
                        compact
                      />
                      <SecurityPanel
                        accessDecision={workspaceAccess}
                        auditedGroundedDecisionCount={auditedGroundedDecisionCount}
                        bare
                        cachedGroundedQuestionCount={cachedGroundedQuestionCount}
                        encryptionStatus={encryptionStatus}
                        environmentHealth={environmentHealth}
                        groundedSuggestionCount={groundedSuggestions.length}
                        isArtifactIsolationSubmitting={isArtifactIsolationSubmitting}
                        isModelSmokeRunning={isModelSmokeRunning}
                        isStopReviewSubmitting={isStopReviewSubmitting}
                        locale={locale}
                        localModelConfig={localModelConfig}
                        localModelSmoke={localModelSmoke}
                        modelExperimentReadiness={modelExperimentReadiness}
                        modelArtifactManifest={modelArtifactManifest}
                        modelArtifactIsolation={modelArtifactIsolation}
                        materials={workspaceMaterials}
                        onArtifactIsolation={() => void initializeModelArtifactIsolation()}
                        onModelSmoke={(executeReal) => void smokeLocalModel(executeReal)}
                        onStopReviewDecision={(decision) => void submitStopReviewDecision(decision)}
                        stopReviewList={stopReviewList}
                        workspace={workspace}
                        workspaceAudit={workspaceAudit}
                        workspaceSecurity={workspaceSecurity}
                      />
                    </section>
                    <CollapsibleSection
                      accordionGroup="mode-system"
                      className="mode-section"
                      defaultOpen
                      hint={text(locale, "expandWhenNeeded")}
                      meta={evidenceMap ? String(evidenceMap.topic_nodes.length) : "0"}
                      title={text(locale, "caseMap")}
                    >
                      <EvidenceMapPanel
                        alignment={evidenceAlignment}
                        bare
                        evidenceMap={evidenceMap}
                        locale={locale}
                      />
                    </CollapsibleSection>
                  </div>
                )}
              </>
            ) : null}
          </section>
        </WorkspaceZone>

        <WorkspaceZone
          collapsed={rightRailCollapsed}
          disclosureHint={text(locale, "expandWhenNeeded")}
          label={text(locale, "zoneInspector")}
          locale={locale}
          side="right"
          tutorialId="zone-operations"
          onToggleCollapse={() => setRightRailCollapsed((current) => !current)}
        >
          <aside className="insight-panel contextual-inspector">
            <div className="inspector-toolbar">
              <div>
                <span>{text(locale, "modeInspector")}</span>
                <strong>{activeWorkModeLabel}</strong>
              </div>
              <span className="meta">{apiMode === "online" ? text(locale, "online") : text(locale, statusKey)}</span>
            </div>

            {apiMode === "online" ? (
              <OperationsGuidanceCard
                activeTab={activeOperationsMode}
                actions={operationsGuidanceActions}
                answeredCount={answeredQuestionCount}
                findingCount={visibleFindings.length}
                locale={locale}
                materialCount={workspaceMaterials.length}
                questionCount={questions.length}
                reportExported={sessionReportExported}
                suggestionCount={groundedSuggestions.length}
              />
            ) : (
              <WorkspaceEmptyState
                detail={text(locale, "operationsOfflineDetail")}
                locale={locale}
                title={text(locale, "operationsOfflineTitle")}
              />
            )}

            {activeWorkMode !== "interview" ? (
              <CollapsibleSection
                className="inspector-section"
                defaultOpen
                hint={text(locale, "expandWhenNeeded")}
                meta={activeQuestion?.id ?? text(locale, "unknown")}
                title={text(locale, "inspectorActiveQuestion")}
              >
                <div className="inspector-question">
                  <p>{localize(activeQuestion?.text, locale)}</p>
                  <LinkedMaterialStrip
                    links={activeQuestionLinks}
                    locale={locale}
                    materialsById={materialsById}
                    starterMaterialsById={starterMaterialsById}
                  />
                </div>
              </CollapsibleSection>
            ) : null}

            <CollapsibleSection
              className="inspector-section"
              defaultOpen={visibleOperatorActions.length > 0}
              hint={text(locale, "expandWhenNeeded")}
              meta={String(visibleOperatorActions.length)}
              title={text(locale, "inspectorSignals")}
            >
              <div className="inspector-signal-list">
                {visibleOperatorActions.length ? (
                  visibleOperatorActions.slice(0, 3).map((action) => (
                    <article key={action.id}>
                      <span data-priority={action.priority}>{action.priority}</span>
                      <strong>{action.title}</strong>
                      <p>{action.detail}</p>
                      <button type="button" onClick={() => runOperatorAction(action)}>
                        <CheckCircle2 size={14} />
                        {text(locale, "operationsActionPriority")}
                      </button>
                    </article>
                  ))
                ) : (
                  <p className="empty-state">{text(locale, "inspectorNoSignals")}</p>
                )}
              </div>
            </CollapsibleSection>
          </aside>
        </WorkspaceZone>
      </main>

      {isNewCaseOpen ? (
        <Modal
          locale={locale}
          subtitle={text(locale, "newCaseModalSubtitle")}
          title={text(locale, "newCaseModalTitle")}
          onClose={() => {
            if (!isCaseCreating) {
              setIsNewCaseOpen(false);
              setNewCaseError(null);
            }
          }}
        >
          <form
            className="new-case-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submitNewCase();
            }}
          >
            <label>
              <span>{text(locale, "newCaseTitle")}</span>
              <input
                autoFocus
                placeholder={text(locale, "newCaseTitlePlaceholder")}
                value={newCaseDraft.title}
                onChange={(event) => setNewCaseDraft((current) => ({ ...current, title: event.target.value }))}
              />
            </label>
            <label>
              <span>{text(locale, "newCaseDescription")}</span>
              <textarea
                placeholder={text(locale, "newCaseDescriptionPlaceholder")}
                rows={4}
                value={newCaseDraft.description}
                onChange={(event) =>
                  setNewCaseDraft((current) => ({ ...current, description: event.target.value }))
                }
              />
            </label>
            <label>
              <span>{text(locale, "firstParticipant")}</span>
              <input
                placeholder={text(locale, "firstParticipantPlaceholder")}
                value={newCaseDraft.participantName}
                onChange={(event) =>
                  setNewCaseDraft((current) => ({ ...current, participantName: event.target.value }))
                }
              />
            </label>
            {newCaseError ? <p className="form-error">{newCaseError}</p> : null}
            <div className="new-case-actions">
              <button disabled={isCaseCreating} type="button" onClick={() => setIsNewCaseOpen(false)}>
                <X size={14} />
                {text(locale, "closeModal")}
              </button>
              <button disabled={isCaseCreating || !newCaseDraft.title.trim()} type="submit">
                <Plus size={14} />
                {isCaseCreating ? text(locale, "creatingCase") : text(locale, "createCase")}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {activeMaterialPreviewId ? (
        <Modal
          locale={locale}
          subtitle={activeMaterialPreviewId}
          title={
            materialDisplayTitle(materialsById.get(activeMaterialPreviewId), starterMaterialsById) ??
            text(locale, "materialPreview")
          }
          onClose={() => setActiveMaterialPreviewId(null)}
        >
          <MaterialPreviewPanel locale={locale} preview={materialPreviews[activeMaterialPreviewId]} />
        </Modal>
      ) : null}

      {claimEditDraft ? (
        <Modal
          locale={locale}
          subtitle={claimEditDraft.claim.sourceText ?? text(locale, "claimReviewTitle")}
          title={text(locale, "claimReviewEdit")}
          onClose={() => setClaimEditDraft(null)}
        >
          <form
            className="claim-edit-form"
            onSubmit={(event) => {
              event.preventDefault();
              const value = claimEditDraft.value.trim();
              if (!value) {
                return;
              }
              void recordClaimReview(claimEditDraft.answer, claimEditDraft.claim, "edited", {
                ...claimEditDraft.claim,
                value,
              });
              setClaimEditDraft(null);
            }}
          >
            <label>
              <span>{text(locale, "claimReviewEditPrompt")}</span>
              <textarea
                autoFocus
                rows={5}
                value={claimEditDraft.value}
                onChange={(event) => setClaimEditDraft({ ...claimEditDraft, value: event.target.value })}
              />
            </label>
            <div className="claim-edit-actions">
              <button type="button" onClick={() => setClaimEditDraft(null)}>
                <X size={14} />
                {text(locale, "closeModal")}
              </button>
              <button disabled={!claimEditDraft.value.trim()} type="submit">
                <Check size={14} />
                {text(locale, "saveClaimEdit")}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {commandPaletteOpen ? (
        <Modal
          locale={locale}
          subtitle={text(locale, "commandPaletteHint")}
          title={text(locale, "commandPalette")}
          onClose={() => setCommandPaletteOpen(false)}
        >
          <div className="command-palette">
            <section>
              <span>{text(locale, "workModeNavigation")}</span>
              {workModes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => {
                    openWorkMode(mode.id);
                    setCommandPaletteOpen(false);
                  }}
                >
                  {mode.icon}
                  <strong>{mode.label}</strong>
                  <em>{mode.value}</em>
                </button>
              ))}
            </section>
            <section>
              <span>{text(locale, "operatorQueue")}</span>
              {operationsGuidanceActions.filter((action) => !action.disabled).slice(0, 5).map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => {
                    action.onClick();
                    setCommandPaletteOpen(false);
                  }}
                >
                  {action.icon}
                  <strong>{action.label}</strong>
                  <em>{action.detail}</em>
                </button>
              ))}
            </section>
          </div>
        </Modal>
      ) : null}

      {statusKey !== "localMode" ? (
        <div className="toast-stack" aria-live="polite" aria-atomic="true">
          <span data-state={apiMode}>{text(locale, statusKey)}</span>
        </div>
      ) : null}

      <TutorialTour
        active={tutorialActive}
        locale={locale}
        stepIndex={tutorialStepIndex}
        onClose={closeTutorial}
        onStepChange={setTutorialStepIndex}
        onStepEnter={handleTutorialStepEnter}
      />
    </div>
  );
}

function WorkModeNavigation({
  activeMode,
  locale,
  modes,
  onSelect,
}: {
  activeMode: WorkMode;
  locale: Locale;
  modes: WorkModeDescriptor[];
  onSelect: (mode: WorkMode) => void;
}) {
  return (
    <nav className="work-mode-nav" data-tutorial="work-mode-nav" aria-label={text(locale, "workModeNavigation")}>
      {modes.map((mode) => (
        <button
          aria-label={`${mode.label}: ${mode.value}`}
          aria-current={activeMode === mode.id ? "page" : undefined}
          className={activeMode === mode.id ? "is-active" : ""}
          data-tutorial={mode.id === "interview" ? "work-mode-interview" : `operations-tab-${mode.id}`}
          key={mode.id}
          title={`${mode.label}: ${mode.detail}`}
          type="button"
          onClick={() => onSelect(mode.id)}
        >
          <span className="work-mode-icon">{mode.icon}</span>
          <span className="work-mode-copy">
            <strong>{mode.label}</strong>
            <em>{mode.detail}</em>
          </span>
          <span className="work-mode-value">{mode.value}</span>
        </button>
      ))}
    </nav>
  );
}

function WorkModeHeader({
  detail,
  icon,
  metrics,
  title,
}: {
  detail: string;
  icon: ReactNode;
  metrics: Array<{ label: string; value: string }>;
  title: string;
}) {
  return (
    <header className="work-mode-header">
      <div className="work-mode-title">
        <span>{icon}</span>
        <div>
          <h2>{title}</h2>
          <p>{detail}</p>
        </div>
      </div>
      <div className="work-mode-metrics">
        {metrics.map((metric) => (
          <span key={metric.label}>
            <strong>{metric.value}</strong>
            <em>{metric.label}</em>
          </span>
        ))}
      </div>
    </header>
  );
}

function ReviewTabList({
  activeTab,
  auditCount,
  findingCount,
  locale,
  onSelect,
  qualityScore,
  reportReady,
}: {
  activeTab: ReviewTab;
  auditCount: number;
  findingCount: number;
  locale: Locale;
  onSelect: (tab: ReviewTab) => void;
  qualityScore: number | null;
  reportReady: boolean;
}) {
  const tabs: Array<{ id: ReviewTab; label: string; value: string }> = [
    { id: "report", label: text(locale, "reviewTabReport"), value: reportReady ? text(locale, "ready") : text(locale, "notReady") },
    { id: "quality", label: text(locale, "reviewTabQuality"), value: qualityScore === null ? "-" : `${qualityScore}%` },
    { id: "stop", label: text(locale, "reviewTabStop"), value: text(locale, "noAutomatedVerdict") },
    { id: "audit", label: text(locale, "reviewTabAudit"), value: String(auditCount) },
    { id: "analytics", label: text(locale, "reviewTabAnalytics"), value: String(findingCount) },
  ];

  return (
    <div className="review-tab-list" role="tablist" aria-label={text(locale, "operationsReview")}>
      {tabs.map((tab) => (
        <button
          aria-selected={activeTab === tab.id}
          className={activeTab === tab.id ? "is-active" : ""}
          key={tab.id}
          role="tab"
          type="button"
          onClick={() => onSelect(tab.id)}
        >
          <span>{tab.label}</span>
          <strong>{tab.value}</strong>
        </button>
      ))}
    </div>
  );
}

function OperationsGuidanceCard({
  activeTab,
  actions,
  answeredCount,
  findingCount,
  locale,
  materialCount,
  questionCount,
  reportExported,
  suggestionCount,
}: {
  activeTab: OperationsTab;
  actions: OperationsGuidanceAction[];
  answeredCount: number;
  findingCount: number;
  locale: Locale;
  materialCount: number;
  questionCount: number;
  reportExported: boolean;
  suggestionCount: number;
}) {
  const guidance: Record<OperationsTab, { detailKey: CopyKey; icon: ReactNode; titleKey: CopyKey }> = {
    monitor: {
      titleKey: "operationsGuideMonitorTitle",
      detailKey: "operationsGuideMonitorDetail",
      icon: <ShieldCheck size={17} />,
    },
    ai: {
      titleKey: "operationsGuideAiTitle",
      detailKey: "operationsGuideAiDetail",
      icon: <Sparkles size={17} />,
    },
    materials: {
      titleKey: "operationsGuideMaterialsTitle",
      detailKey: "operationsGuideMaterialsDetail",
      icon: <FolderOpen size={17} />,
    },
    review: {
      titleKey: "operationsGuideReviewTitle",
      detailKey: "operationsGuideReviewDetail",
      icon: <ListChecks size={17} />,
    },
  };
  const activeGuidance = guidance[activeTab];
  const guidanceDetailKey: CopyKey =
    activeTab === "review" && answeredCount > 0
      ? "operationsGuideReviewReadyDetail"
      : activeTab === "materials" && materialCount > 0
        ? "operationsGuideMaterialsReadyDetail"
        : activeTab === "ai" && suggestionCount > 0
          ? "operationsGuideAiReadyDetail"
          : activeGuidance.detailKey;
  const metrics = [
    {
      label: text(locale, "operatorAnswered"),
      value: `${answeredCount}/${questionCount}`,
    },
    {
      label: text(locale, "materialRecordCount"),
      value: String(materialCount),
    },
    {
      label: text(locale, "groundingSuggestionsShort"),
      value: String(suggestionCount),
    },
    {
      label: text(locale, "findingPluralMany"),
      value: String(findingCount),
    },
    {
      label: text(locale, "sessionReport"),
      value: reportExported ? text(locale, "ready") : text(locale, "notReady"),
    },
  ];
  const actionableActions = actions.filter((action) => !action.disabled);
  const primaryAction = actionableActions.find((action) => action.variant === "primary") ?? actionableActions[0];
  const secondaryActions = actionableActions.filter((action) => action !== primaryAction);

  return (
    <div className="operations-guidance-card" data-tutorial="operations-guidance">
      <div className="operations-guidance-main">
        <span aria-hidden="true">{activeGuidance.icon}</span>
        <div>
          <small>{text(locale, "operationsGuideLabel")}</small>
          <strong>{text(locale, activeGuidance.titleKey)}</strong>
          <p>{text(locale, guidanceDetailKey)}</p>
        </div>
      </div>
      {primaryAction ? (
        <button
          className="operations-guidance-action operations-guidance-action--focus"
          data-variant={primaryAction.variant ?? "secondary"}
          disabled={primaryAction.disabled}
          title={primaryAction.detail}
          type="button"
          onClick={primaryAction.onClick}
        >
          <span aria-hidden="true">{primaryAction.icon}</span>
          <span>
            <strong>{primaryAction.label}</strong>
            <em>{primaryAction.detail}</em>
          </span>
        </button>
      ) : null}
      {!primaryAction ? <p className="empty-state">{text(locale, "operatorNoActions")}</p> : null}
      <details className="operations-guidance-details">
        <summary>
          <MoreHorizontal size={14} />
          {text(locale, "moreActions")}
        </summary>
        <div className="operations-guidance-metrics" aria-label={text(locale, "operationsGuideMetrics")}>
          {metrics.map((metric) => (
            <span key={metric.label}>
              <strong>{metric.value}</strong>
              {metric.label}
            </span>
          ))}
        </div>
        <div className="operations-guidance-actions" aria-label={text(locale, "operationsGuideActions")}>
          {secondaryActions.map((action) => (
          <button
            className="operations-guidance-action"
            data-variant={action.variant ?? "secondary"}
            disabled={action.disabled}
            key={action.id}
            title={action.detail}
            type="button"
            onClick={action.onClick}
          >
            <span aria-hidden="true">{action.icon}</span>
            <span>
              <strong>{action.label}</strong>
              <em>{action.detail}</em>
            </span>
          </button>
          ))}
        </div>
      </details>
    </div>
  );
}

function operationsTabQuickActions({
  activeTab,
  firstMaterial,
  locale,
  onOpenAi,
  onOpenMaterials,
  onOpenMonitor,
  onOpenReview,
  onPreviewMaterial,
  onRegenerateAi,
  starterMaterialsById,
}: {
  activeTab: OperationsTab;
  firstMaterial: MaterialRecord | undefined;
  locale: Locale;
  onOpenAi: () => void;
  onOpenMaterials: () => void;
  onOpenMonitor: () => void;
  onOpenReview: () => void;
  onPreviewMaterial: (materialId: string) => void;
  onRegenerateAi: () => void;
  starterMaterialsById: Map<string, StarterMaterial>;
}): OperationsGuidanceAction[] {
  const openMaterialsAction: OperationsGuidanceAction = {
    id: "open-materials",
    label: text(locale, "operationsActionOpenMaterials"),
    detail: text(locale, "operationsActionOpenMaterialsDetail"),
    icon: <FolderOpen size={16} />,
    onClick: onOpenMaterials,
  };
  const openAiAction: OperationsGuidanceAction = {
    id: "open-ai",
    label: text(locale, "operationsActionOpenAi"),
    detail: text(locale, "operationsActionOpenAiDetail"),
    icon: <Sparkles size={16} />,
    onClick: onOpenAi,
  };
  const openReviewAction: OperationsGuidanceAction = {
    id: "open-review",
    label: text(locale, "operationsActionOpenReview"),
    detail: text(locale, "operationsActionOpenReviewDetail"),
    icon: <ListChecks size={16} />,
    onClick: onOpenReview,
  };
  const openMonitorAction: OperationsGuidanceAction = {
    id: "open-monitor",
    label: text(locale, "operationsActionOpenMonitor"),
    detail: text(locale, "operationsActionOpenMonitorDetail"),
    icon: <ShieldCheck size={16} />,
    onClick: onOpenMonitor,
  };
  const previewMaterialAction: OperationsGuidanceAction = {
    id: firstMaterial ? `preview-${firstMaterial.id}` : "preview-empty",
    label: text(locale, "operationsActionPreviewMaterial"),
    detail:
      materialDisplayTitle(firstMaterial, starterMaterialsById) ??
      text(locale, "operationsActionPreviewMaterialUnavailable"),
    disabled: !firstMaterial,
    icon: <Eye size={16} />,
    onClick: () => {
      if (firstMaterial) {
        onPreviewMaterial(firstMaterial.id);
      }
    },
  };

  if (activeTab === "monitor") {
    return [openAiAction, openMaterialsAction];
  }
  if (activeTab === "ai") {
    return [
      {
        id: "regenerate-ai",
        label: text(locale, "operationsActionRegenerateAi"),
        detail: text(locale, "operationsActionRegenerateAiDetail"),
        icon: <RefreshCw size={16} />,
        onClick: onRegenerateAi,
      },
      openMaterialsAction,
    ];
  }
  if (activeTab === "materials") {
    return [previewMaterialAction, openReviewAction];
  }
  return [openMonitorAction, openAiAction];
}

function OperatorWorkflowPanel({
  actions,
  answeredCount,
  compact = false,
  embedded = false,
  findingCount,
  locale,
  materialCount,
  maxVisibleActions,
  onAction,
  onDecision,
  questionCount,
  recentDecisions,
}: {
  actions: OperatorAction[];
  answeredCount: number;
  compact?: boolean;
  embedded?: boolean;
  findingCount: number;
  locale: Locale;
  materialCount: number;
  maxVisibleActions?: number;
  onAction: (action: OperatorAction) => void;
  onDecision: (action: OperatorAction, decisionType: "skipped" | "dismissed") => void;
  questionCount: number;
  recentDecisions: OperatorActionDecision[];
}) {
  const visibleActions =
    maxVisibleActions && maxVisibleActions > 0 ? actions.slice(0, maxVisibleActions) : actions;
  const hiddenActions =
    maxVisibleActions && maxVisibleActions > 0 ? actions.slice(maxVisibleActions) : [];
  const hiddenActionCount = Math.max(actions.length - visibleActions.length, 0);
  const renderActionRow = (action: OperatorAction) => {
    const priorityLabel = operatorPriorityLabel(action.priority, locale);
    return (
      <div className="operator-action-row" key={action.id}>
        <button
          aria-label={`${action.title}: ${action.detail} (${priorityLabel})`}
          className="operator-action"
          data-action-id={action.id}
          data-kind={action.kind}
          data-priority={action.priority}
          data-target-question-id={action.targetQuestionId}
          type="button"
          onClick={() => onAction(action)}
        >
          <span className="operator-action-icon">{operatorActionIcon(action.kind)}</span>
          <span className="operator-action-body">
            <strong>{action.title}</strong>
            <em>{action.detail}</em>
          </span>
          <span className="operator-action-priority">{priorityLabel}</span>
        </button>
        <div className="operator-action-controls">
          <button type="button" onClick={() => onDecision(action, "skipped")}>
            {text(locale, "operatorSkipAction")}
          </button>
          <button
            aria-label={`${text(locale, "operatorDismissAction")}: ${action.title}`}
            type="button"
            onClick={() => onDecision(action, "dismissed")}
          >
            <X size={13} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <section className={`operator-workflow ${embedded ? "is-embedded" : ""} ${compact ? "is-compact" : ""}`}>
      {compact ? null : (
      <div className="operator-workflow-header">
        <div>
          <span>{text(locale, "operatorQueue")}</span>
          <strong>{text(locale, "operatorQueueDetail")}</strong>
        </div>
        <div className="operator-workflow-metrics">
          <span>
            {answeredCount}/{questionCount} {text(locale, "operatorAnswered")}
          </span>
          <span>
            {materialCount} {text(locale, "materialRecordCount")}
          </span>
          <span>
            {findingCount} {text(locale, "findingPluralMany")}
          </span>
        </div>
      </div>
      )}
      <div className="operator-action-list">
        {visibleActions.length ? (
          visibleActions.map(renderActionRow)
        ) : (
          <p className="empty-state">{text(locale, "operatorNoActions")}</p>
        )}
      </div>
      {hiddenActionCount > 0 ? (
        <details className="operator-action-more">
          <summary>
            +{hiddenActionCount} {text(locale, "operatorMoreActions")}
          </summary>
          <div className="operator-action-list operator-action-list--secondary">
            {hiddenActions.map(renderActionRow)}
          </div>
        </details>
      ) : null}
      {!compact && recentDecisions.length ? (
        <div className="operator-decision-trail">
          <span>{text(locale, "operatorDecisionTrail")}</span>
          {recentDecisions.map((decision) => (
            <article key={decision.decision_id}>
              <strong>{operatorDecisionLabel(decision.decision_type, locale)}</strong>
              <em>{decision.action_title}</em>
              <small>{formatDecisionTime(decision.created_at)}</small>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function CaseQualityPanel({
  bare = false,
  locale,
  report,
}: {
  bare?: boolean;
  locale: Locale;
  report: CaseQualityReport | null;
}) {
  const state = report?.state ?? "unknown";
  const visibleRecommendedActions =
    report?.recommended_actions.filter(
      (action) => !(action.id === "session_capture" && Boolean(report.session_id)),
    ) ?? [];
  async function copyBrief() {
    if (!report) {
      return;
    }
    await navigator.clipboard.writeText(buildCaseQualityBrief(report, locale));
  }

  const body = report ? (
    <div className="case-quality-body">
      <p>{text(locale, "caseQualityAdvisory")}</p>
      <div className="case-quality-toolbar">
        <div className="case-quality-score">
          <strong>{report.quality_score}%</strong>
          <span>{text(locale, "caseQualityScore")}</span>
        </div>
        <button type="button" onClick={() => void copyBrief()}>
          <ClipboardCopy size={14} />
          {text(locale, "caseQualityCopyBrief")}
        </button>
      </div>
      <div className="case-quality-summary">
        <span>{text(locale, "ready")}: {report.summary.ready ?? 0}</span>
        <span>{text(locale, "warning")}: {report.summary.warning ?? 0}</span>
        <span>{text(locale, "blocked")}: {report.summary.blocked ?? 0}</span>
      </div>
      {visibleRecommendedActions.length ? (
        <div className="case-quality-actions">
          <span>{text(locale, "caseQualityNextActions")}</span>
          {visibleRecommendedActions.map((action) => (
            <article data-state={action.state} key={action.id}>
              <strong>{action.label}</strong>
              <p>{action.action}</p>
            </article>
          ))}
        </div>
      ) : null}
      <div className="security-list">
        {report.dimensions.map((dimension) => (
          <SecurityItem
            detail={dimension.detail}
            icon={caseQualityDimensionIcon(dimension.id)}
            key={dimension.id}
            state={dimension.state}
            title={dimension.label}
            value={environmentStateLabel(dimension.state, locale)}
          />
        ))}
      </div>
    </div>
  ) : (
    <div className="case-quality-body">
      <p className="empty-state">{text(locale, "caseQualityUnavailable")}</p>
    </div>
  );

  if (bare) {
    return (
      <div className="case-quality-panel is-bare" data-state={state}>
        {body}
      </div>
    );
  }

  return (
    <section className="case-quality-panel" data-state={state}>
      <PanelHeader title={text(locale, "caseQuality")} meta={environmentStateLabel(state, locale)} compact />
      {body}
    </section>
  );
}

function caseQualityDimensionIcon(dimensionId: string): ReactNode {
  const icons: Record<string, ReactNode> = {
    ai_trace: <Sparkles size={15} />,
    audit_export: <FileCheck2 size={15} />,
    case_scope: <FolderOpen size={15} />,
    claim_provenance: <Fingerprint size={15} />,
    claim_review: <CheckCircle2 size={15} />,
    evidence_coverage: <ListChecks size={15} />,
    material_grounding: <FolderArchive size={15} />,
    operator_decisions: <Activity size={15} />,
    session_capture: <FileText size={15} />,
    workspace_security: <ShieldCheck size={15} />,
  };
  return icons[dimensionId] ?? <ListChecks size={15} />;
}

function buildCaseQualityBrief(report: CaseQualityReport, locale: Locale): string {
  const lines = [
    text(locale, "caseQuality"),
    `${text(locale, "caseLabel")}: ${report.case_id}`,
    `${text(locale, "workspaceLabel")}: ${report.workspace_id}`,
    `${text(locale, "session")}: ${report.session_id ?? text(locale, "unknown")}`,
    `${text(locale, "status")}: ${environmentStateLabel(report.state, locale)}`,
    `${text(locale, "caseQualityScore")}: ${report.quality_score}%`,
    "",
    `${text(locale, "ready")}: ${report.summary.ready ?? 0} / ${text(locale, "warning")}: ${
      report.summary.warning ?? 0
    } / ${text(locale, "blocked")}: ${report.summary.blocked ?? 0}`,
    "",
    text(locale, "caseQualityNextActions"),
  ];
  if (report.recommended_actions.length) {
    report.recommended_actions.forEach((action) => {
      lines.push(`- ${action.label}: ${action.action}`);
    });
  } else {
    lines.push(`- ${text(locale, "caseQualityNoActions")}`);
  }
  return lines.join("\n");
}

function WorkflowReadinessPanel({
  bare = false,
  locale,
  report,
}: {
  bare?: boolean;
  locale: Locale;
  report: WorkflowReadinessReport | null;
}) {
  const state = report?.state ?? "unknown";
  async function copyBrief() {
    if (!report) {
      return;
    }
    await navigator.clipboard.writeText(buildWorkflowReadinessBrief(report, locale));
  }

  const body = report ? (
    <div className="workflow-readiness-body">
      <p>{text(locale, "workflowReadinessAdvisory")}</p>
      <div className="workflow-readiness-toolbar">
        <button type="button" onClick={() => void copyBrief()}>
          <ClipboardCopy size={14} />
          {text(locale, "workflowReadinessCopyBrief")}
        </button>
      </div>
      <div className="workflow-readiness-summary">
        <span>{text(locale, "ready")}: {report.summary.ready ?? 0}</span>
        <span>{text(locale, "warning")}: {report.summary.warning ?? 0}</span>
        <span>{text(locale, "blocked")}: {report.summary.blocked ?? 0}</span>
      </div>
      {report.recommended_actions.length ? (
        <div className="workflow-readiness-actions">
          <span>{text(locale, "workflowReadinessNextActions")}</span>
          {report.recommended_actions.map((action) => (
            <article data-state={action.state} key={action.id}>
              <strong>{action.label}</strong>
              <p>{action.action}</p>
            </article>
          ))}
        </div>
      ) : null}
      <div className="security-list">
        {report.checks.map((check) => (
          <SecurityItem
            detail={check.detail}
            icon={workflowReadinessCheckIcon(check.id)}
            key={check.id}
            state={check.state}
            title={check.label}
            value={environmentStateLabel(check.state, locale)}
          />
        ))}
      </div>
    </div>
  ) : (
    <div className="workflow-readiness-body">
      <p className="empty-state">{text(locale, "workflowReadinessUnavailable")}</p>
    </div>
  );

  if (bare) {
    return (
      <div className="workflow-readiness-panel is-bare" data-state={state}>
        {body}
      </div>
    );
  }

  return (
    <section className="workflow-readiness-panel" data-state={state}>
      <PanelHeader title={text(locale, "workflowReadiness")} meta={environmentStateLabel(state, locale)} compact />
      {body}
    </section>
  );
}

function workflowReadinessCheckIcon(checkId: string): ReactNode {
  const icons: Record<string, ReactNode> = {
    audit_chain: <Fingerprint size={15} />,
    export_bundle: <FileDown size={15} />,
    model_artifacts: <FolderArchive size={15} />,
    model_experiment_stop: <Network size={15} />,
    session_capture: <FileText size={15} />,
    workspace: <Database size={15} />,
    workspace_security: <ShieldCheck size={15} />,
  };
  return icons[checkId] ?? <ListChecks size={15} />;
}

function buildWorkflowReadinessBrief(report: WorkflowReadinessReport, locale: Locale): string {
  const lines = [
    text(locale, "workflowReadiness"),
    `${text(locale, "caseLabel")}: ${report.case_id}`,
    `${text(locale, "workspaceLabel")}: ${report.workspace_id}`,
    `${text(locale, "session")}: ${report.session_id ?? text(locale, "unknown")}`,
    `${text(locale, "status")}: ${environmentStateLabel(report.state, locale)}`,
    "",
    `${text(locale, "ready")}: ${report.summary.ready ?? 0} / ${text(locale, "warning")}: ${
      report.summary.warning ?? 0
    } / ${text(locale, "blocked")}: ${report.summary.blocked ?? 0}`,
    "",
    text(locale, "workflowReadinessNextActions"),
  ];
  if (report.recommended_actions.length) {
    report.recommended_actions.forEach((action) => {
      lines.push(`- ${action.label}: ${action.action}`);
    });
  } else {
    lines.push(`- ${text(locale, "workflowReadinessNoActions")}`);
  }
  return lines.join("\n");
}

function StopReadinessPanel({
  bare = false,
  encryptionStatus,
  locale,
  localModelConfig,
  modelArtifactManifest,
  sessionAudit,
  workspace,
  workspaceAudit,
}: {
  bare?: boolean;
  encryptionStatus: EncryptionStatus | null;
  locale: Locale;
  localModelConfig: LocalModelConfig | null;
  modelArtifactManifest: ModelArtifactManifest | null;
  sessionAudit: SessionAuditResponse | null;
  workspace: WorkspaceResponse | null;
  workspaceAudit: WorkspaceAuditResponse | null;
}) {
  const manifest = workspace?.manifest;
  const isSynthetic = manifest?.data_sensitivity === "synthetic";
  const encryptionReady = encryptionStatus?.available === true || manifest?.storage_mode === "encrypted_required";
  const liveModelEnabled = localModelConfig?.live_output_enabled === true;
  const auditReady = workspaceAudit?.chain_valid === true && sessionAudit?.chain_valid === true;
  const artifactReady = modelArtifactManifest?.chain_valid === true;
  const readyCount = [
    isSynthetic,
    encryptionReady,
    !liveModelEnabled,
    auditReady,
    artifactReady,
    true,
  ].filter(Boolean).length;

  const gates: StopReadinessGate[] = [
    {
      id: "data-posture",
      label: text(locale, "stopGateData"),
      detail: text(locale, isSynthetic ? "stopGateDataReady" : "stopGateDataWarning"),
      state: isSynthetic ? "ready" : "warning",
      icon: <Database size={15} />,
    },
    {
      id: "encrypted-storage",
      label: text(locale, "stopGateEncryption"),
      detail: text(locale, encryptionReady ? "stopGateEncryptionReady" : "stopGateEncryptionWarning"),
      state: encryptionReady ? "ready" : "warning",
      icon: <KeyRound size={15} />,
    },
    {
      id: "model-output",
      label: text(locale, "stopGateModel"),
      detail: text(locale, liveModelEnabled ? "stopGateModelWarning" : "stopGateModelReady"),
      state: liveModelEnabled ? "warning" : "ready",
      icon: <Network size={15} />,
    },
    {
      id: "audit-chain",
      label: text(locale, "stopGateAudit"),
      detail: text(locale, auditReady ? "stopGateAuditReady" : "stopGateAuditWarning"),
      state: auditReady ? "ready" : "unknown",
      icon: <Fingerprint size={15} />,
    },
    {
      id: "model-artifacts",
      label: text(locale, "stopGateArtifacts"),
      detail: text(locale, artifactReady ? "stopGateArtifactsReady" : "stopGateArtifactsWarning"),
      state: artifactReady ? "ready" : "warning",
      icon: <FileCheck2 size={15} />,
    },
    {
      id: "human-authority",
      label: text(locale, "stopGateHuman"),
      detail: text(locale, "stopGateHumanReady"),
      state: "ready",
      icon: <ShieldCheck size={15} />,
    },
  ];

  const body = (
    <div className="stop-readiness-body">
      <p>{text(locale, "stopReadinessAdvisory")}</p>
      <div className="stop-gate-grid">
        {gates.map((gate) => (
          <article className="stop-gate-card" data-state={gate.state} key={gate.id}>
            <span className="stop-gate-icon">{gate.icon}</span>
            <span>
              <strong>{gate.label}</strong>
              <em>{environmentStateShortLabel(gate.state, locale)}</em>
            </span>
            <p>{gate.detail}</p>
          </article>
        ))}
      </div>
    </div>
  );

  if (bare) {
    return <div className="stop-readiness-panel is-bare">{body}</div>;
  }

  return (
    <section className="stop-readiness-panel">
      <PanelHeader
        title={text(locale, "stopReadiness")}
        meta={`${readyCount}/${gates.length} ${text(locale, "ready")}`}
        compact
      />
      {body}
    </section>
  );
}

function InvestigativeBoardPanel({
  bare = false,
  caseData,
  evidenceMap,
  findings,
  locale,
  materialsById,
  starterMaterialsById,
}: {
  bare?: boolean;
  caseData: CaseData | null;
  evidenceMap: EvidenceMap | null;
  findings: ReviewFinding[];
  locale: Locale;
  materialsById: Map<string, MaterialRecord>;
  starterMaterialsById: Map<string, StarterMaterial>;
}) {
  const timelineItems = buildTimelineItems(caseData);
  const clarificationItems = findings
    .filter((finding) => finding.category === "potential_inconsistency" || finding.category === "missing_topic")
    .slice(0, 4);
  const materialLeads = (evidenceMap?.topic_nodes ?? [])
    .filter((node) => node.status === "material_only" || node.status === "contested" || node.status === "missing")
    .slice(0, 4);
  const boardCount = timelineItems.length + clarificationItems.length + materialLeads.length;

  const body = (
    <div className="investigative-board-grid">
      <div className="investigative-board-column">
        <span>{text(locale, "narrativeTimeline")}</span>
        {timelineItems.length ? (
          timelineItems.map((item) => (
            <article className="timeline-item" key={`${item.answerId}-${item.claimId}`}>
              <strong>{item.value}</strong>
              <p>{item.sourceText}</p>
              <em>
                {item.answerId} / {item.attribute}
              </em>
            </article>
          ))
        ) : (
          <p className="empty-state">{text(locale, "noTimelineSignals")}</p>
        )}
      </div>

      <div className="investigative-board-column">
        <span>{text(locale, "clarificationTargets")}</span>
        {clarificationItems.length ? (
          clarificationItems.map((finding) => (
            <article className="clarification-item" data-severity={finding.severity} key={`${finding.category}-${finding.title}`}>
              <strong>{findingTitle(finding, locale)}</strong>
              <p>{findingDetail(finding, locale)}</p>
              <em>{uniqueIds(finding.linked_ids).join(", ")}</em>
            </article>
          ))
        ) : (
          <p className="empty-state">{text(locale, "noClarificationTargets")}</p>
        )}
      </div>

      <div className="investigative-board-column">
        <span>{text(locale, "materialLeads")}</span>
        {materialLeads.length ? (
          materialLeads.map((node) => (
            <article className="material-lead-item" data-state={node.status} key={node.topic_id}>
              <strong>{node.label}</strong>
              <p>{evidenceStatusLabel(node.status, locale)}</p>
              <div>
                {node.material_ids.slice(0, 3).map((materialId) => (
                  <em key={materialId}>
                    {materialDisplayTitle(materialsById.get(materialId), starterMaterialsById) ?? materialId}
                  </em>
                ))}
              </div>
            </article>
          ))
        ) : (
          <p className="empty-state">{text(locale, "noMaterialLeads")}</p>
        )}
      </div>
    </div>
  );

  if (bare) {
    return <div className="investigative-board-panel is-bare">{body}</div>;
  }

  return (
    <section className="investigative-board-panel">
      <PanelHeader
        title={text(locale, "investigativeBoard")}
        meta={`${boardCount} ${text(locale, "reviewSignals")}`}
        compact
      />
      {body}
    </section>
  );
}

type TimelineItem = {
  answerId: string;
  attribute: string;
  claimId: string;
  sourceText: string;
  value: string;
};

function buildTimelineItems(caseData: CaseData | null): TimelineItem[] {
  if (!caseData) {
    return [];
  }

  return caseData.answers
    .flatMap((answer) =>
      (answer.claims ?? [])
        .filter((claim) => isTimelineClaim(claim.attribute, claim.value))
        .map((claim) => ({
          answerId: answer.id,
          attribute: claim.attribute.replaceAll("_", " "),
          claimId: claim.id,
          sourceText: claim.source_text || answer.text,
          value: claim.value,
        })),
    )
    .slice(0, 5);
}

function isTimelineClaim(attribute: string, value: string): boolean {
  return attribute.toLowerCase().includes("time") || /\b\d{1,2}:\d{2}\b/.test(value);
}

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

function ProvenanceTimelinePanel({
  bare = false,
  locale,
  sessionAudit,
  workspaceAudit,
}: {
  bare?: boolean;
  locale: Locale;
  sessionAudit: SessionAuditResponse | null;
  workspaceAudit: WorkspaceAuditResponse | null;
}) {
  const events = [
    ...(workspaceAudit?.events ?? []).map((event) => ({ event, scope: "workspace" as const })),
    ...(sessionAudit?.events ?? []).map((event) => ({ event, scope: "session" as const })),
  ]
    .sort((left, right) => Date.parse(right.event.timestamp) - Date.parse(left.event.timestamp))
    .slice(0, 10);
  const totalEvents = (workspaceAudit?.events.length ?? 0) + (sessionAudit?.events.length ?? 0);

  const body = (
    <>
      <div className="provenance-summary">
        <AuditChainSummaryCard
          chainValid={workspaceAudit?.chain_valid}
          count={workspaceAudit?.events.length ?? 0}
          icon={<Fingerprint size={15} />}
          label={text(locale, "workspaceAudit")}
          locale={locale}
        />
        <AuditChainSummaryCard
          chainValid={sessionAudit?.chain_valid}
          count={sessionAudit?.events.length ?? 0}
          icon={<History size={15} />}
          label={text(locale, "sessionAudit")}
          locale={locale}
        />
      </div>
      <div className="provenance-timeline">
        {events.length ? (
          events.map(({ event, scope }) => (
            <article className="audit-event-card" data-actor={event.actor} key={`${scope}-${event.id}`}>
              <span className="audit-event-icon">
                {event.actor === "human" ? <Activity size={14} /> : <History size={14} />}
              </span>
              <div className="audit-event-body">
                <div className="audit-event-header">
                  <strong>{auditActionLabel(event.action, locale)}</strong>
                  <span>{formatDecisionTime(event.timestamp)}</span>
                </div>
                <p>
                  {auditScopeLabel(scope, locale)} / {event.object_type} / {event.object_id}
                </p>
                <div className="audit-event-details">
                  {auditEventDetailPairs(event).map(([key, value]) => (
                    <span key={`${event.id}-${key}`}>
                      {auditDetailLabel(key, locale)}: <strong>{formatAuditDetailValue(value)}</strong>
                    </span>
                  ))}
                </div>
                <div className="audit-event-footer">
                  <span>{auditActorLabel(event.actor, locale)}</span>
                  {event.event_hash ? <span>{shortHash(event.event_hash)}</span> : null}
                </div>
              </div>
            </article>
          ))
        ) : (
          <p className="empty-state">{text(locale, "noAuditEvents")}</p>
        )}
      </div>
    </>
  );

  if (bare) {
    return <div className="provenance-panel is-bare">{body}</div>;
  }

  return (
    <section className="provenance-panel">
      <PanelHeader
        title={text(locale, "provenanceTimeline")}
        meta={`${totalEvents} ${text(locale, "auditEvents")}`}
        compact
      />
      {body}
    </section>
  );
}

function AuditChainSummaryCard({
  chainValid,
  count,
  icon,
  label,
  locale,
}: {
  chainValid: boolean | undefined;
  count: number;
  icon: ReactNode;
  label: string;
  locale: Locale;
}) {
  const state = chainValid === undefined ? "unknown" : chainValid ? "ready" : "blocked";
  return (
    <article className="audit-chain-card" data-state={state}>
      <span>{icon}</span>
      <div>
        <strong>{label}</strong>
        <em>{auditChainLabel(chainValid, locale)}</em>
      </div>
      <b>{count}</b>
    </article>
  );
}

function auditEventDetailPairs(event: AuditEvent): Array<[string, unknown]> {
  const preferredKeys = [
    "case_id",
    "session_id",
    "participant_id",
    "question_id",
    "target_question_id",
    "target_tab",
    "material_id",
    "export_id",
    "filename",
    "manifest_hash",
    "bundle_sha256",
    "bundle_size_bytes",
    "verification_verified",
    "json_included",
    "model_artifacts_included",
    "gate_id",
    "readiness_state",
    "issue_codes",
    "ok",
    "real_model_invoked",
    "result_model",
    "response_preview_hash",
    "decision",
    "decision_type",
    "created_by",
    "rationale",
    "checklist",
    "action_title",
    "model_id",
    "prompt_version",
    "prompt_hash",
    "context_hash",
    "output_hash",
    "artifact_warning",
    "finding_count",
    "indicator_count",
  ];
  return preferredKeys
    .filter((key) => event.details[key] !== undefined && event.details[key] !== null && event.details[key] !== "")
    .slice(0, 5)
    .map((key) => [key, event.details[key]]);
}

function auditActionLabel(action: string, locale: Locale): string {
  const labels: Record<Locale, Record<string, string>> = {
    pl: {
      session_started: "Rozpoczęto sesję",
      answer_added: "Dodano odpowiedź",
      review_refreshed: "Odświeżono przegląd",
      material_question_link_accepted: "Zaakceptowano link materiału",
      material_question_link_rejected: "Odrzucono link materiału",
      grounded_suggestions_generated: "Wygenerowano sugestie ze źródłami",
      grounded_suggestion_accepted: "Zaakceptowano sugestię AI",
      grounded_suggestion_edited: "Edytowano sugestię AI",
      grounded_suggestion_rejected: "Odrzucono sugestię AI",
      operator_action_opened: "Otwarto akcję operatora",
      operator_action_skipped: "Pominięto akcję operatora",
      operator_action_dismissed: "Zamknięto akcję operatora",
      stop_review_approved: "Zatwierdzono STOP",
      stop_review_rejected: "Odrzucono STOP",
      local_model_smoke_blocked: "Zablokowano smoke modelu",
      local_model_smoke_completed: "Wykonano smoke modelu",
      local_model_smoke_failed: "Smoke modelu nieudany",
      export_bundle_created: "Utworzono paczkę eksportu",
    },
    en: {
      session_started: "Session started",
      answer_added: "Answer added",
      review_refreshed: "Review refreshed",
      material_question_link_accepted: "Material link accepted",
      material_question_link_rejected: "Material link rejected",
      grounded_suggestions_generated: "Grounded suggestions generated",
      grounded_suggestion_accepted: "AI suggestion accepted",
      grounded_suggestion_edited: "AI suggestion edited",
      grounded_suggestion_rejected: "AI suggestion rejected",
      operator_action_opened: "Operator action opened",
      operator_action_skipped: "Operator action skipped",
      operator_action_dismissed: "Operator action dismissed",
      stop_review_approved: "STOP approved",
      stop_review_rejected: "STOP rejected",
      local_model_smoke_blocked: "Model smoke blocked",
      local_model_smoke_completed: "Model smoke completed",
      local_model_smoke_failed: "Model smoke failed",
      export_bundle_created: "Export bundle created",
    },
  };
  return labels[locale][action] ?? action.replaceAll("_", " ");
}

function auditActorLabel(actor: AuditEvent["actor"], locale: Locale): string {
  const labels: Record<Locale, Record<AuditEvent["actor"], string>> = {
    pl: {
      ai: "AI",
      human: "człowiek",
      system: "system",
    },
    en: {
      ai: "AI",
      human: "human",
      system: "system",
    },
  };
  return labels[locale][actor];
}

function auditScopeLabel(scope: "workspace" | "session", locale: Locale): string {
  const labels: Record<Locale, Record<"workspace" | "session", string>> = {
    pl: {
      session: "sesja",
      workspace: "obszar roboczy",
    },
    en: {
      session: "session",
      workspace: "workspace",
    },
  };
  return labels[locale][scope];
}

function auditChainLabel(chainValid: boolean | undefined, locale: Locale): string {
  if (chainValid === undefined) {
    return text(locale, "unknown");
  }
  return chainValid ? text(locale, "chainValid") : text(locale, "chainInvalid");
}

function auditDetailLabel(key: string, locale: Locale): string {
  const labels: Record<Locale, Record<string, string>> = {
    pl: {
      action_title: "akcja",
      artifact_warning: "artefakty",
      bundle_sha256: "bundle",
      bundle_size_bytes: "rozmiar",
      case_id: "sprawa",
      context_hash: "context",
      created_by: "operator",
      decision: "decyzja",
      decision_type: "typ decyzji",
      export_id: "export",
      filename: "plik",
      finding_count: "ustalenia",
      gate_id: "bramka",
      issue_codes: "blokady",
      indicator_count: "wskaźniki",
      json_included: "JSON",
      manifest_hash: "manifest",
      checklist: "checklista",
      material_id: "materiał",
      model_artifacts_included: "artefakty modelu",
      model_id: "model",
      ok: "wynik",
      output_hash: "output",
      participant_id: "osoba",
      prompt_hash: "prompt",
      prompt_version: "wersja promptu",
      question_id: "pytanie",
      rationale: "uzasadnienie",
      readiness_state: "readiness",
      real_model_invoked: "realny model",
      response_preview_hash: "preview",
      result_model: "model",
      session_id: "sesja",
      target_question_id: "cel pytania",
      target_tab: "zakładka",
      verification_verified: "weryfikacja",
    },
    en: {
      action_title: "action",
      artifact_warning: "artifacts",
      bundle_sha256: "bundle",
      bundle_size_bytes: "size",
      case_id: "case",
      context_hash: "context",
      created_by: "operator",
      decision: "decision",
      decision_type: "decision type",
      export_id: "export",
      filename: "file",
      finding_count: "findings",
      gate_id: "gate",
      issue_codes: "blocks",
      indicator_count: "indicators",
      json_included: "JSON",
      manifest_hash: "manifest",
      checklist: "checklist",
      material_id: "material",
      model_artifacts_included: "model artifacts",
      model_id: "model",
      ok: "result",
      output_hash: "output",
      participant_id: "participant",
      prompt_hash: "prompt",
      prompt_version: "prompt version",
      question_id: "question",
      rationale: "rationale",
      readiness_state: "readiness",
      real_model_invoked: "real model",
      response_preview_hash: "preview",
      result_model: "model",
      session_id: "session",
      target_question_id: "target question",
      target_tab: "tab",
      verification_verified: "verification",
    },
  };
  return labels[locale][key] ?? key.replaceAll("_", " ");
}

function formatAuditDetailValue(value: unknown): string {
  if (typeof value === "string") {
    return value.length === 64 ? shortHash(value) : truncateAuditText(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return truncateAuditText(value.join(", "));
  }
  return truncateAuditText(JSON.stringify(value) ?? String(value));
}

function truncateAuditText(value: string): string {
  return value.length > 72 ? `${value.slice(0, 72)}...` : value;
}

function operatorDecisionLabel(decision: OperatorActionDecision["decision_type"], locale: Locale): string {
  const labels: Record<Locale, Record<OperatorActionDecision["decision_type"], string>> = {
    pl: {
      opened: "otwarte",
      accepted: "zaakceptowane",
      edited: "edytowane",
      rejected: "odrzucone",
      skipped: "pominięte",
      dismissed: "zamknięte",
      converted_to_question: "zamienione w pytanie",
    },
    en: {
      opened: "opened",
      accepted: "accepted",
      edited: "edited",
      rejected: "rejected",
      skipped: "skipped",
      dismissed: "dismissed",
      converted_to_question: "converted to question",
    },
  };
  return labels[locale][decision];
}

function operatorActionIcon(kind: OperatorActionKind): ReactNode {
  if (kind === "materials") {
    return <FolderArchive size={15} />;
  }
  if (kind === "review") {
    return <ListChecks size={15} />;
  }
  return <Send size={15} />;
}

function operatorPriorityLabel(priority: OperatorAction["priority"], locale: Locale): string {
  const labels: Record<Locale, Record<OperatorAction["priority"], string>> = {
    pl: {
      high: "pilne",
      medium: "ważne",
      low: "kolejne",
    },
    en: {
      high: "urgent",
      medium: "important",
      low: "next",
    },
  };
  return labels[locale][priority];
}

function topicPriorityLabel(topic: CaseTopic, locale: Locale): string {
  const labels: Record<Locale, Record<CaseTopic["priority"], string>> = {
    pl: {
      high: "wysoki",
      medium: "średni",
      low: "niski",
    },
    en: {
      high: "high",
      medium: "medium",
      low: "low",
    },
  };
  return labels[locale][topic.priority];
}

function buildMaterialTasks({
  caseStarterMaterials,
  decisions,
  evidenceMap,
  links,
  locale,
  materials,
  questions,
  verifications,
}: {
  caseStarterMaterials: StarterMaterial[];
  decisions: Record<string, MaterialQuestionLinkDecision>;
  evidenceMap: EvidenceMap | null;
  links: MaterialQuestionLink[];
  locale: Locale;
  materials: MaterialRecord[];
  questions: QuestionView[];
  verifications: Record<string, MaterialVerification>;
}): MaterialTask[] {
  const materialsById = new Map(materials.map((material) => [material.id, material]));
  const starterMaterialsById = new Map(caseStarterMaterials.map((material) => [material.id, material]));
  const questionsById = new Map(questions.map((question) => [question.id, question]));
  const tasks: MaterialTask[] = [];

  const pendingLink = [...links]
    .filter((link) => !decisions[materialQuestionLinkKey(link)])
    .sort((left, right) => right.confidence - left.confidence)[0];
  if (pendingLink) {
    const material = materialsById.get(pendingLink.material_id);
    const question = questionsById.get(pendingLink.question_id);
    tasks.push({
      id: `review-link-${pendingLink.material_id}-${pendingLink.question_id}`,
      kind: "review_link",
      title: text(locale, "materialTaskReviewLink"),
      detail: `${materialDisplayTitle(material, starterMaterialsById) ?? pendingLink.material_id} -> ${
        question?.id ?? pendingLink.question_id
      } (${text(locale, "confidenceShort")} ${pendingLink.confidence.toFixed(2)})`,
      priority: pendingLink.confidence >= 0.85 ? "high" : "medium",
      materialId: pendingLink.material_id,
      questionId: pendingLink.question_id,
      sourceObjectIds: [pendingLink.material_id, pendingLink.question_id, ...pendingLink.topic_ids],
      link: pendingLink,
    });
  }

  const unverifiedMaterial = materials.find(
    (material) => materialVerificationState(verifications[material.id]) !== "ready",
  );
  if (unverifiedMaterial) {
    tasks.push({
      id: `verify-${unverifiedMaterial.id}`,
      kind: "verify_material",
      title: text(locale, "materialTaskVerifyIntegrity"),
      detail: `${materialDisplayTitle(unverifiedMaterial, starterMaterialsById)} / ${materialSourceLabel(
        unverifiedMaterial.source_type,
        locale,
      )}`,
      priority: "medium",
      materialId: unverifiedMaterial.id,
      sourceObjectIds: [unverifiedMaterial.id],
    });
  }

  const materialOnlyTopic = firstEvidenceTopicByStatus(evidenceMap, "material_only");
  if (materialOnlyTopic) {
    tasks.push({
      id: `material-only-${materialOnlyTopic.topic_id}`,
      kind: "material_only",
      title: text(locale, "materialTaskMaterialOnlyTopic"),
      detail: buildEvidenceTopicTaskDetail(materialOnlyTopic, materialsById, starterMaterialsById),
      priority: "medium",
      materialId: materialOnlyTopic.material_ids[0],
      questionId: materialOnlyTopic.question_ids[0],
      topicId: materialOnlyTopic.topic_id,
      sourceObjectIds: [
        materialOnlyTopic.topic_id,
        ...materialOnlyTopic.material_ids,
        ...materialOnlyTopic.question_ids,
      ],
    });
  }

  const contestedTopic = firstEvidenceTopicByStatus(evidenceMap, "contested");
  if (contestedTopic) {
    tasks.push({
      id: `contested-${contestedTopic.topic_id}`,
      kind: "contested_topic",
      title: text(locale, "materialTaskContestedTopic"),
      detail: buildEvidenceTopicTaskDetail(contestedTopic, materialsById, starterMaterialsById),
      priority: contestedTopic.priority === "high" ? "high" : "medium",
      materialId: contestedTopic.material_ids[0],
      questionId: contestedTopic.question_ids[0],
      topicId: contestedTopic.topic_id,
      sourceObjectIds: [
        contestedTopic.topic_id,
        ...contestedTopic.material_ids,
        ...contestedTopic.question_ids,
      ],
    });
  }

  const uniqueTasks = new Map<string, MaterialTask>();
  for (const task of tasks) {
    uniqueTasks.set(task.id, task);
  }

  return Array.from(uniqueTasks.values())
    .sort((left, right) => priorityRank(left.priority) - priorityRank(right.priority))
    .slice(0, 4);
}

function firstEvidenceTopicByStatus(
  evidenceMap: EvidenceMap | null,
  status: EvidenceTopicStatus,
): EvidenceTopicNode | undefined {
  return evidenceMap?.topic_nodes
    .filter((node) => node.status === status)
    .sort(
      (left, right) =>
        priorityRank(evidenceTopicPriorityToOperatorPriority(left.priority)) -
        priorityRank(evidenceTopicPriorityToOperatorPriority(right.priority)),
    )[0];
}

function evidenceTopicPriorityToOperatorPriority(priority: string): OperatorAction["priority"] {
  if (priority === "high" || priority === "medium" || priority === "low") {
    return priority;
  }
  return "medium";
}

function buildEvidenceTopicTaskDetail(
  node: EvidenceTopicNode,
  materialsById: Map<string, MaterialRecord>,
  starterMaterialsById: Map<string, StarterMaterial>,
): string {
  const materialTitles = node.material_ids
    .slice(0, 2)
    .map((materialId) => materialDisplayTitle(materialsById.get(materialId), starterMaterialsById) ?? materialId)
    .join(", ");
  return materialTitles ? `${node.label}: ${materialTitles}` : node.label;
}

function materialDisplayTitle(
  material: MaterialRecord | undefined,
  starterMaterialsById: Map<string, StarterMaterial>,
): string | undefined {
  if (!material) {
    return undefined;
  }
  return starterMaterialsById.get(material.id)?.title ?? material.title;
}

function materialDisplayDescription(
  material: MaterialRecord,
  starterMaterialsById: Map<string, StarterMaterial>,
): string {
  return starterMaterialsById.get(material.id)?.description ?? material.description;
}

function buildOperatorActions({
  activeQuestionId,
  answerViews,
  caseStarterMaterials,
  evidenceMap,
  findings,
  links,
  locale,
  materialTasks,
  materials,
  questions,
}: {
  activeQuestionId: string | undefined;
  answerViews: AnswerView[];
  caseStarterMaterials: StarterMaterial[];
  evidenceMap: EvidenceMap | null;
  findings: ReviewFinding[];
  links: MaterialQuestionLink[];
  locale: Locale;
  materialTasks: MaterialTask[];
  materials: MaterialRecord[];
  questions: QuestionView[];
}): OperatorAction[] {
  const actions: OperatorAction[] = [];
  const answeredQuestionIds = new Set(answerViews.map((answer) => answer.questionId));
  const starterMaterialsById = new Map(caseStarterMaterials.map((material) => [material.id, material]));
  const nextUnansweredQuestion = questions.find((question) => !answeredQuestionIds.has(question.id));
  if (nextUnansweredQuestion) {
    actions.push({
      id: `ask-${nextUnansweredQuestion.id}`,
      kind: "ask",
      title: text(locale, "operatorAskNext"),
      detail: localize(nextUnansweredQuestion.text, locale),
      priority: "high",
      targetQuestionId: nextUnansweredQuestion.id,
      sourceObjectIds: [nextUnansweredQuestion.id, ...nextUnansweredQuestion.topicIds],
    });
  }

  const activeQuestionLinks = activeQuestionId
    ? links.filter((link) => link.question_id === activeQuestionId)
    : [];
  if (activeQuestionLinks.length) {
    const linkedMaterialTitles = activeQuestionLinks
      .slice(0, 2)
      .map(
        (link) =>
          materialDisplayTitle(
            materials.find((material) => material.id === link.material_id),
            starterMaterialsById,
          ) ?? link.material_id,
      )
      .join(", ");
    actions.push({
      id: `materials-${activeQuestionId}`,
      kind: "materials",
      title: text(locale, "operatorCheckSources"),
      detail: linkedMaterialTitles || text(locale, "groundedMaterials"),
      priority: nextUnansweredQuestion ? "medium" : "high",
      targetTab: "materials",
      sourceObjectIds: [
        ...(activeQuestionId ? [activeQuestionId] : []),
        ...activeQuestionLinks.flatMap((link) => [link.material_id, ...link.topic_ids]),
      ],
    });
  }

  const urgentFinding = findings.find((finding) => finding.severity === "high") ?? findings[0];
  if (urgentFinding) {
    const targetQuestionId = urgentFinding.linked_ids.find((linkedId) =>
      questions.some((question) => question.id === linkedId),
    );
    const targetTopicId = urgentFinding.linked_ids.find((linkedId) => linkedId.startsWith("topic-"));
    const questionForTopic = targetTopicId
      ? questions.find((question) => question.topicIds.includes(targetTopicId))
      : undefined;
    actions.push({
      id: `finding-${urgentFinding.category}-${urgentFinding.title}`,
      kind: "review",
      title: text(locale, "operatorResolveFinding"),
      detail: findingTitle(urgentFinding, locale),
      priority: urgentFinding.severity === "high" ? "high" : "medium",
      targetQuestionId: targetQuestionId ?? questionForTopic?.id,
      targetTab: targetQuestionId || questionForTopic ? undefined : "review",
      sourceObjectIds: urgentFinding.linked_ids,
    });
  }

  const priorityMaterialTask = materialTasks[0];
  if (priorityMaterialTask) {
    actions.push({
      id: `material-task-${priorityMaterialTask.id}`,
      kind: "materials",
      title: priorityMaterialTask.title,
      detail: priorityMaterialTask.detail,
      priority: priorityMaterialTask.priority,
      targetQuestionId: priorityMaterialTask.questionId,
      targetTab: "materials",
      sourceObjectIds: priorityMaterialTask.sourceObjectIds,
    });
  }

  const uniqueActions = new Map<string, OperatorAction>();
  for (const action of actions) {
    uniqueActions.set(action.id, action);
  }

  return Array.from(uniqueActions.values())
    .sort((left, right) => priorityRank(left.priority) - priorityRank(right.priority))
    .slice(0, 4);
}

function priorityRank(priority: OperatorAction["priority"]): number {
  if (priority === "high") {
    return 0;
  }
  if (priority === "medium") {
    return 1;
  }
  return 2;
}

function CaseCatalogPanel({
  cases,
  currentCaseId,
  locale,
  onCreateCase,
  onOpenCase,
}: {
  cases: CaseCatalogItem[];
  currentCaseId: string;
  locale: Locale;
  onCreateCase: () => void;
  onOpenCase: (caseId: string) => void;
}) {
  return (
    <CollapsibleSection
      className="case-catalog-panel"
      hint={text(locale, "expandWhenNeeded")}
      meta={formatCount(cases.length, locale, {
        singular: text(locale, "caseSingular"),
        pluralFew: text(locale, "casePluralFew"),
        pluralMany: text(locale, "casePluralMany"),
      })}
      title={text(locale, "caseCatalog")}
    >
      <button className="case-catalog-create" type="button" onClick={onCreateCase}>
        <Plus size={15} />
        <span>{text(locale, "newCase")}</span>
      </button>
      <div className="case-catalog-list">
        {cases.map((caseItem) => {
          const isActive = caseItem.id === currentCaseId;
          return (
            <button
              aria-current={isActive ? "page" : undefined}
              className={`case-catalog-item ${isActive ? "is-active" : ""}`}
              key={caseItem.id}
              type="button"
              onClick={() => onOpenCase(caseItem.id)}
            >
              <span className="case-catalog-icon">
                {isActive ? <FolderOpen size={16} /> : <FolderArchive size={16} />}
              </span>
              <span className="case-catalog-body">
                <span className="case-catalog-kicker">
                  {caseItem.id}
                  <em>{isActive ? text(locale, "currentCase") : text(locale, "openCase")}</em>
                </span>
                <CaseCatalogBadges caseId={caseItem.id} locale={locale} source={caseItem.source} />
                <strong>{caseItem.title}</strong>
                <span className="case-catalog-description">{caseItem.description}</span>
                <span className="case-catalog-stats">
                  <span>
                    {caseItem.topic_count} {text(locale, "topics")}
                  </span>
                  <span>
                    {caseItem.high_priority_topic_count} {text(locale, "highPriorityShort")}
                  </span>
                  <span>
                    {caseItem.question_count} {text(locale, "questionPluralMany")}
                  </span>
                  <span>
                    {caseItem.answered_question_count}/{caseItem.answer_count} {text(locale, "answered")}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </CollapsibleSection>
  );
}

function CaseDossierPanel({
  answerCount,
  caseData,
  locale,
  review,
  starterMaterials,
  onOpenMaterials,
}: {
  answerCount: number;
  caseData: CaseData | null;
  locale: Locale;
  review: InterviewReview | null;
  starterMaterials: StarterMaterial[];
  onOpenMaterials: () => void;
}) {
  if (!caseData) {
    return null;
  }

  const topics = caseData.topics ?? [];
  const coveredTopicIds = new Set(review?.covered_topic_ids ?? []);
  const missingTopicIds = new Set(review?.missing_topic_ids ?? []);
  const highPriorityTopics = topics.filter((topic) => topic.priority === "high");
  const missingHighPriorityTopics = highPriorityTopics.filter((topic) => missingTopicIds.has(topic.id));
  const focusTopics = (missingHighPriorityTopics.length
    ? missingHighPriorityTopics
    : topics.filter((topic) => missingTopicIds.has(topic.id))
  ).slice(0, 4);
  const coverageLabel = topics.length
    ? `${coveredTopicIds.size}/${topics.length}`
    : text(locale, "alignmentNotAvailable");
  const visibleMaterials = starterMaterials.slice(0, 3);

  const dossierMeta = `${caseData.id} · ${coverageLabel} · ${missingHighPriorityTopics.length} ${text(locale, "priorityGaps")}`;

  return (
    <CollapsibleSection
      className="case-dossier-panel"
      hint={text(locale, "expandWhenNeeded")}
      meta={dossierMeta}
      title={text(locale, "caseDossier")}
      tutorialId="case-dossier"
    >
      <div className="case-dossier-body">
        <p>{caseData.description}</p>

        <div className="case-dossier-metrics">
          <span>
            <ListChecks size={14} />
            <strong>{coverageLabel}</strong>
            {text(locale, "plannedScope")}
          </span>
          <span>
            <AlertTriangle size={14} />
            <strong>{missingHighPriorityTopics.length}</strong>
            {text(locale, "priorityGaps")}
          </span>
          <span>
            <FileText size={14} />
            <strong>{starterMaterials.length}</strong>
            {text(locale, "starterPack")}
          </span>
          <span>
            <Check size={14} />
            <strong>{answerCount}</strong>
            {text(locale, "answeredShort")}
          </span>
        </div>

        <div className="case-dossier-section">
          <span>{text(locale, "priorityFocus")}</span>
          {focusTopics.length ? (
            <div className="topic-chip-list">
              {focusTopics.map((topic) => (
                <span data-priority={topic.priority} key={topic.id}>
                  {domainLabel(topic.label, locale)}
                  <em>{topicPriorityLabel(topic, locale)}</em>
                </span>
              ))}
            </div>
          ) : (
            <strong>{text(locale, "noPriorityGaps")}</strong>
          )}
        </div>

        <div className="case-dossier-section">
          <span>{text(locale, "starterMaterials")}</span>
          {visibleMaterials.length ? (
            <div className="starter-material-mini-list">
              {visibleMaterials.map((material) => (
                <article key={material.id}>
                  <strong>{material.title}</strong>
                  <em>{materialSourceLabel(material.source_type, locale)}</em>
                </article>
              ))}
            </div>
          ) : (
            <strong>{text(locale, "noStarterMaterials")}</strong>
          )}
          <button type="button" onClick={onOpenMaterials}>
            <FolderOpen size={14} />
            {text(locale, "openMaterialsTab")}
          </button>
        </div>
      </div>
    </CollapsibleSection>
  );
}

function CaseParticipantsPanel({
  canEdit,
  currentParticipantId,
  draft,
  isSubmitting,
  locale,
  participants,
  onDraftChange,
  onInterviewParticipant,
  onSubmit,
}: {
  canEdit: boolean;
  currentParticipantId: string;
  draft: string;
  isSubmitting: boolean;
  locale: Locale;
  participants: CaseParticipant[];
  onDraftChange: (value: string) => void;
  onInterviewParticipant: (participantId: string) => void;
  onSubmit: () => void;
}) {
  return (
    <CollapsibleSection
      className="case-participants-panel"
      hint={canEdit ? text(locale, "caseParticipantsHint") : text(locale, "caseParticipantsReadOnly")}
      meta={formatCount(participants.length, locale, {
        singular: text(locale, "participantSingular"),
        pluralFew: text(locale, "participantPluralFew"),
        pluralMany: text(locale, "participantPluralMany"),
      })}
      title={text(locale, "caseParticipants")}
    >
      {participants.length ? (
        <div className="case-participant-list">
          {participants.map((participant) => (
            <article
              className="case-participant-item"
              data-active={participant.id === currentParticipantId}
              key={participant.id}
            >
              <strong>{participant.name}</strong>
              <span>{participant.id === currentParticipantId ? text(locale, "currentParticipant") : participant.role}</span>
              {participant.notes ? <p>{participant.notes}</p> : null}
              {canEdit && participant.id !== currentParticipantId ? (
                <button type="button" onClick={() => onInterviewParticipant(participant.id)}>
                  <Send size={13} />
                  {text(locale, "interviewParticipant")}
                </button>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">{text(locale, "caseParticipantsEmpty")}</p>
      )}
      {canEdit ? (
        <form
          className="case-participant-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <label>
            <span>{text(locale, "participantName")}</span>
            <input
              placeholder={text(locale, "participantNamePlaceholder")}
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
            />
          </label>
          <button disabled={isSubmitting || !draft.trim()} type="submit">
            <Plus size={14} />
            {text(locale, "addParticipant")}
          </button>
        </form>
      ) : null}
    </CollapsibleSection>
  );
}

type WorkflowChecklistItem = {
  id: string;
  label: string;
  done: boolean;
};

function WorkflowPathPanel({
  checklist,
  compact = false,
  locale,
  onCopySummary,
  onOpenAi,
  onOpenMaterials,
  onOpenMonitor,
  onOpenNextQuestion,
  onOpenReview,
  onStartFresh,
}: {
  checklist: WorkflowChecklistItem[];
  compact?: boolean;
  locale: Locale;
  onCopySummary: () => void;
  onOpenAi: () => void;
  onOpenMaterials: () => void;
  onOpenMonitor: () => void;
  onOpenNextQuestion: () => void;
  onOpenReview: () => void;
  onStartFresh: () => void;
}) {
  const steps = [
    {
      id: "question",
      icon: <Send size={14} />,
      label: text(locale, "workflowPathStepQuestion"),
      detail: text(locale, "workflowPathStepQuestionDetail"),
      onClick: onOpenNextQuestion,
    },
    {
      id: "local-ai",
      icon: <Network size={14} />,
      label: text(locale, "workflowPathStepLocalAi"),
      detail: text(locale, "workflowPathStepLocalAiDetail"),
      onClick: onOpenMonitor,
    },
    {
      id: "materials",
      icon: <FolderArchive size={14} />,
      label: text(locale, "workflowPathStepMaterials"),
      detail: text(locale, "workflowPathStepMaterialsDetail"),
      onClick: onOpenMaterials,
    },
    {
      id: "grounded-ai",
      icon: <Sparkles size={14} />,
      label: text(locale, "workflowPathStepGroundedAi"),
      detail: text(locale, "workflowPathStepGroundedAiDetail"),
      onClick: onOpenAi,
    },
    {
      id: "review",
      icon: <Fingerprint size={14} />,
      label: text(locale, "workflowPathStepReview"),
      detail: text(locale, "workflowPathStepReviewDetail"),
      onClick: onOpenReview,
    },
  ];

  const checklistDoneCount = checklist.filter((item) => item.done).length;
  const checklistProgress = checklist.length ? Math.round((checklistDoneCount / checklist.length) * 100) : 0;
  const nextStep = steps[Math.min(checklistDoneCount, steps.length - 1)];
  const remainingCount = Math.max(checklist.length - checklistDoneCount, 0);

  return (
    <CollapsibleSection
      className={`workflow-path-panel ${compact ? "is-compact" : ""}`}
      defaultOpen={compact}
      hint={compact ? text(locale, "workflowPathCompactHint") : text(locale, "expandWhenNeeded")}
      meta={`${checklistDoneCount}/${checklist.length} · ${text(locale, "workflowPathReady")}`}
      title={text(locale, "workflowPath")}
      tutorialId="workflow-path"
    >
      <div className="workflow-progress-meter" aria-label={text(locale, "workflowChecklist")}>
        <span style={{ width: `${checklistProgress}%` }} />
      </div>
      {compact ? (
        <button className="workflow-next-step" type="button" onClick={nextStep.onClick}>
          <span>{nextStep.icon}</span>
          <strong>{nextStep.label}</strong>
          <em>
            {remainingCount} {text(locale, "workflowPathRemaining")}
          </em>
        </button>
      ) : null}
      <div className="workflow-tool-row">
        <button type="button" onClick={onStartFresh} title={text(locale, "workflowNewSessionDetail")}>
          <RefreshCw size={14} />
          {text(locale, "workflowNewSession")}
        </button>
        <button type="button" onClick={onCopySummary}>
          <ClipboardCopy size={14} />
          {text(locale, "workflowCopyBrief")}
        </button>
      </div>
      <div className={`workflow-checklist ${compact ? "auditor-only" : ""}`}>
        <span>
          {text(locale, "workflowChecklist")} ({checklistDoneCount}/{checklist.length})
        </span>
        <ul>
          {checklist.map((item) => (
            <li key={item.id} data-done={item.done ? "true" : "false"}>
              {item.done ? <CheckCircle2 size={13} /> : <ListChecks size={13} />}
              {item.label}
            </li>
          ))}
        </ul>
      </div>
      <div className={`workflow-step-list ${compact ? "auditor-only" : ""}`}>
        {steps.map((step) => (
          <button key={step.id} type="button" onClick={step.onClick}>
            <span>{step.icon}</span>
            <strong>{step.label}</strong>
            <em>{step.detail}</em>
          </button>
        ))}
      </div>
    </CollapsibleSection>
  );
}

type WorkflowBriefInput = {
  locale: Locale;
  config: RuntimeConfig;
  caseData: CaseData | null;
  answeredCount: number;
  questionCount: number;
  materialCount: number;
  findingCount: number;
  indicatorCount: number;
  evidenceBand: string | null;
  environmentState: EnvironmentHealthState | null;
  modelProvider: string | null;
  groundedCount: number;
  operatorDecisionCount: number;
  workspaceAuditValid: boolean | null;
  workspaceAuditCount: number;
  sessionAuditCount: number;
};

function buildWorkflowBriefText(input: WorkflowBriefInput): string {
  const lines = [
    text(input.locale, "workflowBriefTitle"),
    "---",
    `${text(input.locale, "caseCatalog")}: ${input.config.caseId}`,
    input.caseData ? localize(input.caseData.title, input.locale) : "",
    `${text(input.locale, "session")}: ${input.config.sessionId}`,
    `${text(input.locale, "workspaceLabel")}: ${input.config.workspaceId}`,
    "",
    `${text(input.locale, "questions")}: ${input.answeredCount}/${input.questionCount} ${text(input.locale, "answered")}`,
    `${text(input.locale, "sourceMaterials")}: ${input.materialCount}`,
    `${text(input.locale, "operationsReview")}: ${input.findingCount} ${text(input.locale, "findingPluralMany")}, ${input.indicatorCount} ${text(input.locale, "indicators")}`,
    input.evidenceBand ? `${text(input.locale, "evidenceAlignment")}: ${input.evidenceBand}` : "",
    input.environmentState
      ? `${text(input.locale, "environmentHealth")}: ${environmentStateShortLabel(input.environmentState, input.locale)}`
      : "",
    input.modelProvider ? `${text(input.locale, "localModelRuntime")}: ${input.modelProvider}` : "",
    `${text(input.locale, "operationsAi")}: ${input.groundedCount} ${
      input.locale === "pl" ? "sugestii" : "grounded suggestions"
    }`,
    `${text(input.locale, "operatorDecisionTrail")}: ${input.operatorDecisionCount}`,
    `${text(input.locale, "workspaceAudit")}: ${input.workspaceAuditCount} ${
      input.locale === "pl" ? "zdarzeń" : "events"
    }${
      input.workspaceAuditValid === null
        ? ""
        : ` (${input.workspaceAuditValid ? text(input.locale, "chainValid") : text(input.locale, "chainInvalid")})`
    }`,
    `${text(input.locale, "sessionAudit")}: ${input.sessionAuditCount} ${
      input.locale === "pl" ? "zdarzeń" : "events"
    }`,
    "",
    text(input.locale, "workflowBriefBoundary"),
  ];

  return lines.filter((line) => line.length > 0).join("\n");
}

function LinkedMaterialStrip({
  links,
  locale,
  materialsById,
  starterMaterialsById,
}: {
  links: MaterialQuestionLink[];
  locale: Locale;
  materialsById: Map<string, MaterialRecord>;
  starterMaterialsById: Map<string, StarterMaterial>;
}) {
  if (!links.length) {
    return (
      <div className="linked-material-strip">
        <span>{text(locale, "groundedMaterials")}</span>
        <strong>{text(locale, "noGrounding")}</strong>
      </div>
    );
  }

  return (
    <div className="linked-material-strip">
      <span>{text(locale, "groundedMaterials")}</span>
      <div className="linked-material-list">
        {links.map((link) => {
          const material = materialsById.get(link.material_id);
          return (
            <span key={`${link.material_id}-${link.question_id}`}>
              {materialDisplayTitle(material, starterMaterialsById) ?? link.material_id}
              <em>{link.confidence.toFixed(2)}</em>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function EvidenceMapPanel({
  bare = false,
  evidenceMap,
  alignment,
  locale,
}: {
  bare?: boolean;
  evidenceMap: EvidenceMap | null;
  alignment: EvidenceAlignment | null;
  locale: Locale;
}) {
  if (!evidenceMap) {
    const empty = <p className="evidence-map-empty">{text(locale, "noEvidenceMap")}</p>;
    if (bare) {
      return <div className="evidence-map-panel is-bare">{empty}</div>;
    }
    return (
      <section>
        <PanelHeader title={text(locale, "caseMap")} meta={text(locale, "unknown")} compact />
        {empty}
      </section>
    );
  }

  const summary = evidenceMap.summary;

  const body = (
    <>
      <EvidenceAlignmentBar alignment={alignment} locale={locale} />
      <div className="evidence-map">
        <div className="evidence-map-summary">
          <EvidenceMapMetric
            label={text(locale, "answeredShort")}
            value={`${summary.answered_questions}/${summary.total_questions}`}
          />
          <EvidenceMapMetric
            label={text(locale, "materialsShort")}
            value={String(summary.total_materials)}
          />
          <EvidenceMapMetric
            label={text(locale, "claimsShort")}
            value={String(summary.total_claims)}
          />
          <EvidenceMapMetric
            label={text(locale, "findings")}
            value={String(summary.total_findings)}
          />
        </div>
        <div className="evidence-topic-list">
          {evidenceMap.topic_nodes.map((node) => (
            <article className="evidence-topic" data-state={node.status} key={node.topic_id}>
              <div className="evidence-topic-header">
                <span className="evidence-topic-status">
                  <Network size={13} />
                  {evidenceStatusLabel(node.status, locale)}
                </span>
                <span className="meta">{node.priority}</span>
              </div>
              <strong>{domainLabel(node.label, locale)}</strong>
              <div className="evidence-topic-counts">
                <span>Q {node.question_ids.length}</span>
                <span>A {node.answer_ids.length}</span>
                <span>M {node.material_ids.length}</span>
                <span>C {node.claim_ids.length}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  );

  if (bare) {
    return <div className="evidence-map-panel is-bare">{body}</div>;
  }

  return (
    <section>
      <PanelHeader
        title={text(locale, "caseMap")}
        meta={`${summary.covered_topics}/${summary.total_topics} ${text(locale, "topicsShort")}`}
        compact
      />
      {body}
    </section>
  );
}

function EvidenceMapMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="evidence-map-metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function EvidenceAlignmentBar({
  alignment,
  locale,
}: {
  alignment: EvidenceAlignment | null;
  locale: Locale;
}) {
  if (!alignment) {
    return null;
  }

  const insufficient = alignment.band === "insufficient_review";
  const percent = insufficient || alignment.score === null
    ? 0
    : Math.round(alignment.score * 100);
  const valueLabel = insufficient || alignment.score === null
    ? text(locale, "alignmentNotAvailable")
    : `${percent}%`;

  return (
    <div className="evidence-alignment" data-band={alignment.band}>
      <div className="evidence-alignment-header">
        <span className="evidence-alignment-title">{text(locale, "evidenceAlignment")}</span>
        <span className="evidence-alignment-band">{alignmentBandLabel(alignment.band, locale)}</span>
      </div>
      <div className="evidence-alignment-track" role="img" aria-label={valueLabel}>
        <div className="evidence-alignment-fill" style={{ width: `${percent}%` }} />
        <span className="evidence-alignment-value">{valueLabel}</span>
      </div>
      <div className="evidence-alignment-meta">
        <span>
          {text(locale, "alignmentReviewed")}: {alignment.reviewed_links}/{alignment.total_proposed_links}
        </span>
        <span>
          {text(locale, "alignmentConfidence")}: {alignment.confidence.toFixed(2)}
        </span>
      </div>
      <ul className="evidence-alignment-explanation">
        {alignment.explanation.map((bullet, index) => (
          <li key={index}>{bullet}</li>
        ))}
      </ul>
      <p className="evidence-alignment-disclaimer">{text(locale, "alignmentAdvisory")}</p>
    </div>
  );
}

function alignmentBandLabel(band: EvidenceAlignment["band"], locale: Locale): string {
  const keys: Record<EvidenceAlignment["band"], CopyKey> = {
    insufficient_review: "alignmentInsufficient",
    low: "alignmentLow",
    medium: "alignmentMedium",
    high: "alignmentHigh",
  };

  return text(locale, keys[band]);
}

function MaterialsPanel({
  activePreviewId,
  apiMode,
  bare = false,
  decisions,
  draft,
  isSubmitting,
  links,
  locale,
  materials,
  starterMaterials,
  tasks,
  isQuestionDraftSubmitting,
  onDecideLink,
  onCreateQuestionDraft,
  onDraftChange,
  onOpenQuestion,
  onPreview,
  onSubmit,
  onVerify,
  previews,
  verifications,
}: {
  activePreviewId: string | null;
  apiMode: ApiMode;
  bare?: boolean;
  decisions: Record<string, MaterialQuestionLinkDecision>;
  draft: MaterialDraft;
  isSubmitting: boolean;
  links: MaterialQuestionLink[];
  locale: Locale;
  materials: MaterialRecord[];
  starterMaterials: StarterMaterial[];
  tasks: MaterialTask[];
  isQuestionDraftSubmitting: boolean;
  onDecideLink: (link: MaterialQuestionLink, decision: MaterialQuestionLinkDecision) => void;
  onCreateQuestionDraft: (task: MaterialTask) => void;
  onDraftChange: (draft: MaterialDraft) => void;
  onOpenQuestion: (questionId: string) => void;
  onPreview: (materialId: string) => void;
  onSubmit: () => void;
  onVerify: (materialId: string) => void;
  previews: Record<string, MaterialPreview>;
  verifications: Record<string, MaterialVerification>;
}) {
  const [activeMaterialView, setActiveMaterialView] = useState<"tasks" | "register" | "add">("tasks");
  const disabled = apiMode !== "online" || isSubmitting;
  const acceptedLinkCount = Object.values(decisions).filter((decision) => decision === "accepted").length;
  const pendingLinkCount = Math.max(0, links.length - Object.keys(decisions).length);
  const starterMaterialsById = new Map(starterMaterials.map((material) => [material.id, material]));
  const verifiedMaterialCount = materials.filter(
    (material) => materialVerificationState(verifications[material.id]) === "ready",
  ).length;

  const body = (
    <>
      <div className="material-overview">
        <strong>{text(locale, "materialOverview")}</strong>
        <div className="material-overview-grid">
          <span>
            <FileText size={14} />
            {materials.length} {text(locale, "materialRecordCount")}
          </span>
          <span>
            <Network size={14} />
            {links.length} {text(locale, "materialLinksShort")}
          </span>
          <span>
            <CheckCircle2 size={14} />
            {acceptedLinkCount} {text(locale, "acceptedLinks")}
          </span>
          <span>
            <ShieldQuestion size={14} />
            {pendingLinkCount} {text(locale, "pendingLinks")}
          </span>
          <span>
            <ShieldCheck size={14} />
            {verifiedMaterialCount} {text(locale, "verifiedMaterials")}
          </span>
        </div>
      </div>

      <div className="material-view-tabs" role="tablist" aria-label={text(locale, "materialWorkspace")}>
        {[
          { id: "tasks" as const, label: text(locale, "materialTasks"), value: String(tasks.length) },
          { id: "register" as const, label: text(locale, "materialRegister"), value: String(materials.length) },
          { id: "add" as const, label: text(locale, "addOwnMaterial"), value: "+" },
        ].map((tab) => (
          <button
            aria-selected={activeMaterialView === tab.id}
            className={activeMaterialView === tab.id ? "is-active" : ""}
            key={tab.id}
            role="tab"
            type="button"
            onClick={() => setActiveMaterialView(tab.id)}
          >
            <span>{tab.label}</span>
            <strong>{tab.value}</strong>
          </button>
        ))}
      </div>

      {activeMaterialView === "tasks" ? (
        <MaterialTasksPanel
          locale={locale}
          tasks={tasks}
          isQuestionDraftSubmitting={isQuestionDraftSubmitting}
          onDecideLink={onDecideLink}
          onCreateQuestionDraft={onCreateQuestionDraft}
          onOpenQuestion={onOpenQuestion}
          onPreview={onPreview}
        />
      ) : null}

      {activeMaterialView === "register" ? (
        <div className="material-list">
          {materials.length ? (
            materials.map((material) => (
              <MaterialCard
                decisions={decisions}
                key={material.id}
                links={links.filter((link) => link.material_id === material.id)}
                locale={locale}
                material={material}
                starterMaterialsById={starterMaterialsById}
                onDecideLink={onDecideLink}
                onPreview={onPreview}
                onVerify={onVerify}
                verification={verifications[material.id]}
              />
            ))
          ) : (
            <p className="empty-state">{text(locale, "noMaterials")}</p>
          )}
        </div>
      ) : null}

      {activeMaterialView === "add" ? (
        <section className="material-add-panel">
          <div className="material-add-header">
            <Plus size={15} />
            <span>{text(locale, "addOwnMaterial")}</span>
            <em>{text(locale, "syntheticTextOnly")}</em>
          </div>
        <form
          className="material-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <label>
            <span>{text(locale, "materialTitle")}</span>
            <input
              disabled={disabled}
              placeholder={text(locale, "materialTitlePlaceholder")}
              value={draft.title}
              onChange={(event) => onDraftChange({ ...draft, title: event.target.value })}
            />
          </label>
          <label>
            <span>{text(locale, "materialType")}</span>
            <select
              disabled={disabled}
              value={draft.sourceType}
              onChange={(event) =>
                onDraftChange({ ...draft, sourceType: event.target.value as MaterialSourceType })
              }
            >
              {materialSourceTypes.map((sourceType) => (
                <option key={sourceType} value={sourceType}>
                  {materialSourceLabel(sourceType, locale)}
                </option>
              ))}
            </select>
          </label>
          <label className="material-form-wide">
            <span>{text(locale, "materialContent")}</span>
            <textarea
              disabled={disabled}
              placeholder={text(locale, "materialContentPlaceholder")}
              rows={4}
              value={draft.content}
              onChange={(event) => onDraftChange({ ...draft, content: event.target.value })}
            />
          </label>
          <label className="material-form-wide">
            <span>{text(locale, "materialTags")}</span>
            <input
              disabled={disabled}
              placeholder={text(locale, "materialTagsPlaceholder")}
              value={draft.tags}
              onChange={(event) => onDraftChange({ ...draft, tags: event.target.value })}
            />
          </label>
          <button disabled={disabled} type="submit">
            <Plus size={15} />
            {isSubmitting ? "..." : text(locale, "addMaterial")}
          </button>
        </form>
        </section>
      ) : null}
    </>
  );

  if (bare) {
    return <div className="materials-panel is-bare">{body}</div>;
  }

  return (
    <section>
      <PanelHeader
        title={text(locale, "materialRegister")}
        meta={`${materials.length} ${text(locale, "registered")}`}
        compact
      />
      {body}
    </section>
  );
}

function MaterialTasksPanel({
  locale,
  tasks,
  isQuestionDraftSubmitting,
  onDecideLink,
  onCreateQuestionDraft,
  onOpenQuestion,
  onPreview,
}: {
  locale: Locale;
  tasks: MaterialTask[];
  isQuestionDraftSubmitting: boolean;
  onDecideLink: (link: MaterialQuestionLink, decision: MaterialQuestionLinkDecision) => void;
  onCreateQuestionDraft: (task: MaterialTask) => void;
  onOpenQuestion: (questionId: string) => void;
  onPreview: (materialId: string) => void;
}) {
  return (
    <section className="material-task-panel">
      <div className="material-task-header">
        <div>
          <strong>{text(locale, "materialTasks")}</strong>
          <span>{text(locale, "materialTasksDetail")}</span>
        </div>
        <em>
          {formatCount(tasks.length, locale, {
            singular: text(locale, "materialTaskCountOne"),
            pluralFew: text(locale, "materialTaskCountFew"),
            pluralMany: text(locale, "materialTaskCountMany"),
          })}
        </em>
      </div>
      {tasks.length ? (
        <div className="material-task-list">
          {tasks.map((task) => {
            const actions = buildMaterialTaskActions({
              isQuestionDraftSubmitting,
              locale,
              onCreateQuestionDraft,
              onDecideLink,
              onOpenQuestion,
              onPreview,
              task,
            });
            const primaryAction = actions.find((action) => action.isPrimary) ?? actions[0];
            const secondaryActions = actions.filter((action) => action.key !== primaryAction?.key);

            return (
              <article className="material-task-card" data-priority={task.priority} key={task.id}>
                <div className="material-task-card-main">
                  <span className="material-task-icon">{materialTaskIcon(task.kind)}</span>
                  <div>
                    <strong>{task.title}</strong>
                    <p>{task.detail}</p>
                    <em>{operatorPriorityLabel(task.priority, locale)}</em>
                  </div>
                </div>
                <div className="material-task-actions">
                  {primaryAction ? (
                    <button
                      className="material-task-primary-action"
                      type="button"
                      disabled={primaryAction.disabled}
                      onClick={primaryAction.onClick}
                    >
                      {primaryAction.icon}
                      {primaryAction.label}
                    </button>
                  ) : null}
                  {secondaryActions.length ? (
                    <details className="material-task-more">
                      <summary aria-label={text(locale, "moreActions")} title={text(locale, "moreActions")}>
                        <MoreHorizontal size={14} />
                      </summary>
                      <div>
                        {secondaryActions.map((action) => (
                          <button
                            type="button"
                            disabled={action.disabled}
                            key={action.key}
                            onClick={action.onClick}
                          >
                            {action.icon}
                            {action.label}
                          </button>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="empty-state">{text(locale, "noMaterialTasks")}</p>
      )}
    </section>
  );
}

type MaterialTaskAction = {
  disabled?: boolean;
  icon: ReactNode;
  isPrimary?: boolean;
  key: string;
  label: string;
  onClick: () => void;
};

type ClaimEditDraft = {
  answer: AnswerView;
  claim: ClaimView;
  value: string;
} | null;

function buildMaterialTaskActions({
  isQuestionDraftSubmitting,
  locale,
  onCreateQuestionDraft,
  onDecideLink,
  onOpenQuestion,
  onPreview,
  task,
}: {
  isQuestionDraftSubmitting: boolean;
  locale: Locale;
  onCreateQuestionDraft: (task: MaterialTask) => void;
  onDecideLink: (link: MaterialQuestionLink, decision: MaterialQuestionLinkDecision) => void;
  onOpenQuestion: (questionId: string) => void;
  onPreview: (materialId: string) => void;
  task: MaterialTask;
}): MaterialTaskAction[] {
  const actions: MaterialTaskAction[] = [];

  if (task.questionId) {
    actions.push({
      icon: <Send size={13} />,
      isPrimary: !task.link,
      key: "open-question",
      label: text(locale, "materialTaskOpenQuestion"),
      onClick: () => onOpenQuestion(task.questionId!),
    });
  }

  if (canCreateQuestionFromMaterialTask(task)) {
    actions.push({
      disabled: isQuestionDraftSubmitting,
      icon: <Pencil size={13} />,
      isPrimary: !task.questionId && !task.link,
      key: "create-question",
      label: text(locale, "materialTaskCreateQuestion"),
      onClick: () => onCreateQuestionDraft(task),
    });
  }

  if (task.materialId) {
    actions.push({
      icon: <Eye size={13} />,
      isPrimary: !task.questionId && !task.link && !canCreateQuestionFromMaterialTask(task),
      key: "preview-material",
      label: text(locale, "previewMaterial"),
      onClick: () => onPreview(task.materialId!),
    });
  }

  if (task.link) {
    actions.push(
      {
        icon: <Check size={13} />,
        isPrimary: true,
        key: "accept-link",
        label: text(locale, "acceptLink"),
        onClick: () => onDecideLink(task.link!, "accepted"),
      },
      {
        icon: <X size={13} />,
        key: "reject-link",
        label: text(locale, "rejectLink"),
        onClick: () => onDecideLink(task.link!, "rejected"),
      },
    );
  }

  return actions;
}

function materialTaskIcon(kind: MaterialTaskKind): ReactNode {
  if (kind === "verify_material") {
    return <ShieldCheck size={15} />;
  }
  if (kind === "contested_topic") {
    return <AlertTriangle size={15} />;
  }
  if (kind === "material_only") {
    return <Plus size={15} />;
  }
  return <Network size={15} />;
}

function canCreateQuestionFromMaterialTask(task: MaterialTask): boolean {
  return Boolean(
    task.materialId &&
      (task.kind === "material_only" || task.kind === "contested_topic"),
  );
}

function MaterialCard({
  decisions,
  links,
  locale,
  material,
  starterMaterialsById,
  onDecideLink,
  onPreview,
  onVerify,
  verification,
}: {
  decisions: Record<string, MaterialQuestionLinkDecision>;
  links: MaterialQuestionLink[];
  locale: Locale;
  material: MaterialRecord;
  starterMaterialsById: Map<string, StarterMaterial>;
  onDecideLink: (link: MaterialQuestionLink, decision: MaterialQuestionLinkDecision) => void;
  onPreview: (materialId: string) => void;
  onVerify: (materialId: string) => void;
  verification: MaterialVerification | undefined;
}) {
  const state = materialVerificationState(verification);
  const displayTitle = materialDisplayTitle(material, starterMaterialsById) ?? material.title;
  const displayDescription = materialDisplayDescription(material, starterMaterialsById);
  const acceptedCount = links.filter((link) => decisions[materialQuestionLinkKey(link)] === "accepted").length;
  const proposedCount = links.filter((link) => !decisions[materialQuestionLinkKey(link)]).length;
  const primaryLinks = links.slice(0, 3);
  const hiddenLinkCount = Math.max(0, links.length - primaryLinks.length);

  return (
    <article className="material-card" data-state={state}>
      <div className="material-card-header">
        <span className="security-icon">
          <FileText size={15} />
        </span>
        <div>
          <strong>{displayTitle}</strong>
          <span className="material-meta">
            <span className="auditor-only-inline">{material.id} / </span>
            {materialSourceLabel(material.source_type, locale)}
          </span>
        </div>
        <span className="material-status-pill" data-state={state}>
          <ShieldQuestion size={13} />
          {materialVerificationLabel(verification, locale)}
        </span>
      </div>
      {displayDescription ? (
        <p className="material-description">{displayDescription}</p>
      ) : null}

      <div className="material-card-summary">
        <span>
          <Network size={13} />
          <strong>{links.length}</strong>
          {text(locale, "materialLinksShort")}
        </span>
        <span>
          <CheckCircle2 size={13} />
          <strong>{acceptedCount}</strong>
          {text(locale, "acceptedLinks")}
        </span>
        <span>
          <ShieldQuestion size={13} />
          <strong>{proposedCount}</strong>
          {text(locale, "pendingLinks")}
        </span>
      </div>

      {primaryLinks.length ? (
        <div className="material-primary-links" aria-label={text(locale, "groundedQuestions")}>
          {primaryLinks.map((link) => {
            const decision = decisions[materialQuestionLinkKey(link)];
            return (
              <span data-state={decision ?? "proposed"} key={materialQuestionLinkKey(link)}>
                {link.question_id}
                <em>{link.confidence.toFixed(2)}</em>
              </span>
            );
          })}
          {hiddenLinkCount ? <span className="is-more">+{hiddenLinkCount}</span> : null}
        </div>
      ) : null}

      <details className="material-context-window">
        <summary>
          <Network size={14} />
          <span>{text(locale, "materialConnections")}</span>
          <em>{links.length ? `${links.length} ${text(locale, "materialLinksShort")}` : text(locale, "noGrounding")}</em>
        </summary>
        <MaterialQuestionChips
          decisions={decisions}
          links={links}
          locale={locale}
          onDecideLink={onDecideLink}
        />
      </details>

      <details className="material-context-window auditor-only">
        <summary>
          <Database size={14} />
          <span>{text(locale, "materialTechnicalDetails")}</span>
          <em>{shortHash(material.sha256)}</em>
        </summary>
        <div className="material-facts">
          <span>
            {text(locale, "size")}: <strong>{formatBytes(material.size_bytes)}</strong>
          </span>
          <span>
            {text(locale, "hash")}: <strong>{shortHash(material.sha256)}</strong>
          </span>
          <span>
            {text(locale, "materialType")}: <strong>{materialSourceLabel(material.source_type, locale)}</strong>
          </span>
        </div>
        {material.tags.length ? (
          <div className="material-tags">
            {material.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        ) : null}
      </details>

      <div className="material-card-footer">
        <button className="material-card-primary-action" type="button" onClick={() => onPreview(material.id)}>
          <Eye size={14} />
          {text(locale, "previewMaterial")}
        </button>
        <details className="material-card-more">
          <summary aria-label={text(locale, "moreActions")} title={text(locale, "moreActions")}>
            <MoreHorizontal size={14} />
          </summary>
          <div>
            <button type="button" onClick={() => onVerify(material.id)}>
              <CheckCircle2 size={14} />
              {text(locale, "verifyMaterial")}
            </button>
          </div>
        </details>
      </div>
    </article>
  );
}

function MaterialQuestionChips({
  decisions,
  links,
  locale,
  onDecideLink,
}: {
  decisions: Record<string, MaterialQuestionLinkDecision>;
  links: MaterialQuestionLink[];
  locale: Locale;
  onDecideLink: (link: MaterialQuestionLink, decision: MaterialQuestionLinkDecision) => void;
}) {
  if (!links.length) {
    return (
      <div className="material-grounding is-empty">
        <span>{text(locale, "grounding")}</span>
        <strong>{text(locale, "noGrounding")}</strong>
      </div>
    );
  }

  return (
    <div className="material-grounding">
      <span>{text(locale, "groundedQuestions")}</span>
      <div className="material-question-chips">
        {links.map((link) => {
          const decision = decisions[materialQuestionLinkKey(link)];
          return (
            <span data-state={decision ?? "proposed"} key={materialQuestionLinkKey(link)}>
              {link.question_id}
              <em>
                {text(locale, "confidenceShort")} {link.confidence.toFixed(2)}
              </em>
              {decision ? <strong>{materialQuestionLinkDecisionLabel(decision, locale)}</strong> : null}
              <button
                aria-label={`${text(locale, "acceptLink")} ${link.question_id}`}
                type="button"
                onClick={() => onDecideLink(link, "accepted")}
              >
                <Check size={12} />
              </button>
              <button
                aria-label={`${text(locale, "rejectLink")} ${link.question_id}`}
                type="button"
                onClick={() => onDecideLink(link, "rejected")}
              >
                <X size={12} />
              </button>
            </span>
          );
        })}
      </div>
      <div className="material-link-audit">
        {links.map((link) => (
          <details key={`${materialQuestionLinkKey(link)}-audit`}>
            <summary>
              {link.question_id} / {text(locale, "matchedTerms")}
            </summary>
            <div className="matched-term-list">
              {link.matched_terms.length ? (
                link.matched_terms.map((term, index) => (
                  <span key={`${materialQuestionLinkKey(link)}-${term}-${index}`}>{term}</span>
                ))
              ) : (
                <em>{text(locale, "noMatchedTerms")}</em>
              )}
            </div>
            <p>{link.rationale}</p>
          </details>
        ))}
      </div>
    </div>
  );
}

function MaterialPreviewPanel({
  locale,
  preview,
}: {
  locale: Locale;
  preview: MaterialPreview | undefined;
}) {
  if (!preview) {
    return (
      <div className="material-preview">
        <strong>{text(locale, "materialPreview")}</strong>
        <p>{text(locale, "loadingPreview")}</p>
      </div>
    );
  }

  return (
    <div className="material-preview">
      <div className="material-preview-header">
        <strong>{text(locale, "materialPreview")}</strong>
        <span>
          {preview.line_count} {text(locale, "linesShort")} / {preview.char_count} {text(locale, "charsShort")}
        </span>
      </div>
      <pre>{preview.text_preview}</pre>
      {preview.truncated ? <p>{text(locale, "previewTruncated")}</p> : null}
    </div>
  );
}

function materialQuestionLinkKey(link: MaterialQuestionLink): string {
  return `${link.material_id}:${link.question_id}`;
}

function questionDraftToMaterialLinks(draft: QuestionDraft): MaterialQuestionLink[] {
  return draft.source_material_ids.map((materialId) => ({
    material_id: materialId,
    question_id: draft.id,
    topic_ids: draft.topic_ids,
    matched_terms: [],
    confidence: 1,
    rationale: draft.rationale,
  }));
}

function mergeMaterialQuestionLinks(
  primary: MaterialQuestionLink[],
  secondary: MaterialQuestionLink[],
): MaterialQuestionLink[] {
  const linksByKey = new Map<string, MaterialQuestionLink>();
  for (const link of [...primary, ...secondary]) {
    linksByKey.set(materialQuestionLinkKey(link), link);
  }
  return Array.from(linksByKey.values());
}

function materialQuestionLinkDecisionLabel(
  decision: MaterialQuestionLinkDecision,
  locale: Locale,
): string {
  return text(locale, decision === "accepted" ? "linkAcceptedLabel" : "linkRejectedLabel");
}

function SecurityPanel({
  accessDecision,
  auditedGroundedDecisionCount,
  bare = false,
  cachedGroundedQuestionCount,
  encryptionStatus,
  environmentHealth,
  groundedSuggestionCount,
  isArtifactIsolationSubmitting,
  isModelSmokeRunning,
  isStopReviewSubmitting,
  locale,
  localModelConfig,
  localModelSmoke,
  modelExperimentReadiness,
  modelArtifactManifest,
  modelArtifactIsolation,
  materials,
  onArtifactIsolation,
  onModelSmoke,
  onStopReviewDecision,
  stopReviewList,
  workspace,
  workspaceAudit,
  workspaceSecurity,
}: {
  accessDecision: WorkspaceAccessDecision | null;
  auditedGroundedDecisionCount: number;
  bare?: boolean;
  cachedGroundedQuestionCount: number;
  encryptionStatus: EncryptionStatus | null;
  environmentHealth: EnvironmentHealth | null;
  groundedSuggestionCount: number;
  isArtifactIsolationSubmitting: boolean;
  isModelSmokeRunning: boolean;
  isStopReviewSubmitting: boolean;
  locale: Locale;
  localModelConfig: LocalModelConfig | null;
  localModelSmoke: LocalModelSmokeResult | null;
  modelExperimentReadiness: ModelExperimentReadiness | null;
  modelArtifactManifest: ModelArtifactManifest | null;
  modelArtifactIsolation: ModelArtifactIsolationStatus | null;
  materials: MaterialRecord[];
  onArtifactIsolation: () => void;
  onModelSmoke: (executeReal: boolean) => void;
  onStopReviewDecision: (decision: StopReviewDecisionType) => void;
  stopReviewList: StopReviewListResponse | null;
  workspace: WorkspaceResponse | null;
  workspaceAudit: WorkspaceAuditResponse | null;
  workspaceSecurity: WorkspaceSecurityReport | null;
}) {
  const manifest = workspace?.manifest;
  const encryptionReady = encryptionStatus?.available === true;
  const accessReady = accessDecision?.allowed === true;
  const workspaceState = manifest ? "ready" : "unknown";
  const workspaceSecurityState = workspaceSecurity?.state ?? "unknown";
  const storageState = !manifest
    ? "unknown"
    : manifest.storage_mode === "encrypted_required"
      ? "ready"
      : "warning";
  const encryptionState = encryptionStatus ? (encryptionReady ? "ready" : "warning") : "unknown";
  const accessState = accessDecision ? (accessReady ? "ready" : "blocked") : "unknown";
  const exportState = manifest ? "ready" : "unknown";
  const materialsState = manifest ? "ready" : "unknown";
  const experimentState = modelExperimentReadiness?.state ?? "unknown";
  const modelState = localModelConfig
    ? localModelConfig.real_model_enabled
      ? "warning"
      : "ready"
    : "unknown";
  const storageDetail = manifest
    ? text(locale, manifest.storage_mode === "encrypted_required" ? "encryptionRequired" : "prototypeMode")
    : text(locale, "unknown");
  const encryptionDetail = encryptionStatus
    ? text(locale, encryptionReady ? "ready" : "notReady")
    : text(locale, "unknown");
  const accessDetail = accessDecision
    ? text(locale, accessReady ? "allowed" : "blocked")
    : text(locale, "unknown");
  const exportDetail = manifest ? text(locale, "manifestReady") : text(locale, "unknown");
  const materialsDetail = manifest ? text(locale, "registered") : text(locale, "unknown");
  const workspaceSecurityDetail = workspaceSecurity
    ? workspaceSecurity.issue_count
      ? workspaceSecurity.issues[0]?.detail ?? text(locale, "blocked")
      : text(locale, workspaceSecurity.allows_sensitive_material ? "sensitiveReady" : "syntheticOnly")
    : text(locale, "unknown");
  const experimentDetail = modelExperimentReadiness
    ? modelExperimentReadiness.issue_count
      ? modelExperimentReadiness.issues[0]?.detail ?? text(locale, "blocked")
      : text(locale, "controlledSmokeReady")
    : text(locale, "unknown");
  const modelDetail = localModelConfig
    ? localModelConfig.live_output_enabled
      ? text(locale, "liveModelEnabled")
      : text(locale, "liveModelBlocked")
    : text(locale, "unknown");
  const modelSmokeAuditEvents = [...(workspaceAudit?.events ?? [])]
    .filter((event) => event.object_type === "model_smoke")
    .reverse();

  const body = (
    <>
      <EnvironmentHealthPanel health={environmentHealth} locale={locale} />
      <div className="security-list">
        <SecurityItem
          detail={manifest?.data_sensitivity ?? text(locale, "unknown")}
          icon={<ShieldCheck size={15} />}
          state={workspaceState}
          title={text(locale, "workspaceLabel")}
          value={manifest?.workspace_id ?? config.workspaceId}
        />
        <SecurityItem
          detail={materialsDetail}
          icon={<FolderArchive size={15} />}
          state={materialsState}
          title={text(locale, "sourceMaterials")}
          value={String(materials.length)}
        />
        <SecurityItem
          detail={storageDetail}
          icon={<Database size={15} />}
          state={storageState}
          title={text(locale, "storageMode")}
          value={storageModeLabel(manifest?.storage_mode, locale)}
        />
        <SecurityItem
          detail={workspaceSecurityDetail}
          icon={<ShieldQuestion size={15} />}
          state={workspaceSecurityState}
          title={text(locale, "workspaceSecurity")}
          value={workspaceSecurity ? text(locale, workspaceSecurity.requires_encrypted_storage ? "encryptedRequired" : "syntheticOnly") : text(locale, "unknown")}
        />
        <SecurityItem
          detail={encryptionDetail}
          icon={<KeyRound size={15} />}
          state={encryptionState}
          title={text(locale, "encryption")}
          value={encryptionStatus?.version ?? encryptionStatus?.backend ?? text(locale, "unknown")}
        />
        <SecurityItem
          detail={accessDetail}
          icon={<CheckCircle2 size={15} />}
          state={accessState}
          title={text(locale, "access")}
          value={accessDecision ? `${accessDecision.role} / ${accessDecision.action}` : text(locale, "unknown")}
        />
        <SecurityItem
          detail={exportDetail}
          icon={<FileCheck2 size={15} />}
          state={exportState}
          title={text(locale, "exportIntegrity")}
          value={manifest ? text(locale, "ready") : text(locale, "unknown")}
        />
        <SecurityItem
          detail={experimentDetail}
          icon={<Sparkles size={15} />}
          state={experimentState}
          title={text(locale, "modelExperimentGate")}
          value={modelExperimentReadiness?.can_run_real_smoke ? text(locale, "controlledSmokeReady") : text(locale, "stopReviewRequired")}
        />
      </div>
      <AiRuntimeStatusCard
        auditedDecisionCount={auditedGroundedDecisionCount}
        cachedQuestionCount={cachedGroundedQuestionCount}
        locale={locale}
        localModelConfig={localModelConfig}
        localModelSmoke={localModelSmoke}
        visibleSuggestionCount={groundedSuggestionCount}
      />
      <StopReviewPanel
        isSubmitting={isStopReviewSubmitting}
        locale={locale}
        modelExperimentReadiness={modelExperimentReadiness}
        onDecision={onStopReviewDecision}
        stopReviewList={stopReviewList}
      />
      <ModelSmokeAuditPanel
        events={modelSmokeAuditEvents}
        locale={locale}
      />
      <div className="model-runtime-panel" data-state={modelState}>
        <div className="model-runtime-header">
          <span className="security-icon">
            <Network size={15} />
          </span>
          <div>
            <span className="security-label">{text(locale, "localModelRuntime")}</span>
            <strong>{localModelConfig?.configured_model ?? text(locale, "unknown")}</strong>
            <span className="security-detail">
              {localModelConfig?.effective_provider ?? text(locale, "unknown")} / {modelDetail}
            </span>
          </div>
        </div>
        {localModelConfig?.restrictions.length ? (
          <ul>
            {localModelConfig.restrictions.slice(0, 3).map((restriction) => (
              <li key={restriction}>{restriction}</li>
            ))}
          </ul>
        ) : null}
        {localModelSmoke ? (
          <p>
            {localModelSmoke.ok ? text(locale, "modelSmokeOk") : text(locale, "modelSmokeFailed")}
            {" / "}
            {localModelSmoke.model}
            {" / "}
            {localModelSmoke.real_model_invoked ? text(locale, "realModelInvoked") : text(locale, "noRealModel")}
          </p>
        ) : null}
        <div className="model-smoke-actions">
          <button disabled={!localModelConfig || isModelSmokeRunning} type="button" onClick={() => onModelSmoke(false)}>
            <Activity size={14} />
            {isModelSmokeRunning ? "..." : text(locale, "runModelSmoke")}
          </button>
          <button
            disabled={
              !localModelConfig ||
              isModelSmokeRunning ||
              !["ollama", "bridge"].includes(localModelConfig.provider) ||
              !localModelConfig.real_model_enabled ||
              modelExperimentReadiness?.can_run_real_smoke !== true
            }
            type="button"
            onClick={() => onModelSmoke(true)}
          >
            <Sparkles size={14} />
            {isModelSmokeRunning ? "..." : text(locale, "runModelSmokeReal")}
          </button>
        </div>
        {localModelConfig && !localModelConfig.live_output_enabled ? (
          <p className="local-ai-setup-hint">{text(locale, "localAiSetupHint")}</p>
        ) : null}
      </div>
      <ModelArtifactIsolationPanel
        isSubmitting={isArtifactIsolationSubmitting}
        manifest={modelArtifactManifest}
        isolation={modelArtifactIsolation}
        locale={locale}
        onInitialize={onArtifactIsolation}
      />
    </>
  );

  if (bare) {
    return <div className="security-panel is-bare">{body}</div>;
  }

  return (
    <section>
      <PanelHeader
        title={text(locale, "security")}
        meta={manifest?.status ?? text(locale, "unknown")}
        compact
      />
      {body}
    </section>
  );
}

function StopReviewPanel({
  isSubmitting,
  locale,
  modelExperimentReadiness,
  onDecision,
  stopReviewList,
}: {
  isSubmitting: boolean;
  locale: Locale;
  modelExperimentReadiness: ModelExperimentReadiness | null;
  onDecision: (decision: StopReviewDecisionType) => void;
  stopReviewList: StopReviewListResponse | null;
}) {
  const latest = stopReviewList?.latest ?? null;
  const state: EnvironmentHealthState =
    latest?.decision === "approved"
      ? "ready"
      : latest?.decision === "rejected"
        ? "blocked"
        : "warning";
  const stopIssue =
    modelExperimentReadiness?.issues.find((issue) => issue.code === "stop_review_required")
    ?? modelExperimentReadiness?.issues[0]
    ?? null;
  const decisionLabel = latest
    ? stopReviewDecisionLabel(latest.decision, locale)
    : text(locale, "stopReviewMissing");
  const latestMeta: ReactNode = latest ? (
    <>
      {latest.created_by} / {formatDecisionTime(latest.created_at)}
      {latest.event_hash ? <span className="auditor-only-inline"> / {shortHash(latest.event_hash)}</span> : null}
    </>
  ) : (
    text(locale, "stopReviewMissingDetail")
  );

  return (
    <div className="stop-review-panel" data-state={state}>
      <div className="model-runtime-header">
        <span className="security-icon">
          <ListChecks size={15} />
        </span>
        <div>
          <span className="security-label">{text(locale, "stopReviewRecord")}</span>
          <strong>{decisionLabel}</strong>
          <span className="security-detail">{latestMeta}</span>
        </div>
      </div>
      <p>{latest?.rationale ?? stopIssue?.detail ?? text(locale, "stopReviewMissingDetail")}</p>
      {latest?.checklist.length ? (
        <ul>
          {latest.checklist.slice(0, 3).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {stopReviewList?.decisions.length ? (
        <div className="stop-review-history">
          <span>{text(locale, "stopReviewHistory")}</span>
          {stopReviewList.decisions.slice(0, 3).map((decision) => (
            <article data-decision={decision.decision} key={decision.decision_id}>
              <History size={13} />
              <strong>{stopReviewDecisionLabel(decision.decision, locale)}</strong>
              <em>{formatDecisionTime(decision.created_at)}</em>
              {decision.event_hash ? <small className="auditor-only-inline">{shortHash(decision.event_hash)}</small> : null}
            </article>
          ))}
        </div>
      ) : null}
      <div className="stop-review-actions">
        <button
          disabled={isSubmitting || latest?.decision === "approved"}
          type="button"
          onClick={() => onDecision("approved")}
        >
          <Check size={14} />
          {isSubmitting ? "..." : text(locale, "approveStopReview")}
        </button>
        <button
          disabled={isSubmitting || latest?.decision === "rejected"}
          type="button"
          onClick={() => onDecision("rejected")}
        >
          <X size={14} />
          {isSubmitting ? "..." : text(locale, "rejectStopReview")}
        </button>
      </div>
    </div>
  );
}

function ModelSmokeAuditPanel({
  events,
  locale,
}: {
  events: AuditEvent[];
  locale: Locale;
}) {
  const latest = events[0] ?? null;
  const latestDetail = latest?.details ?? {};
  const state: EnvironmentHealthState = latest
    ? latest.action === "local_model_smoke_completed" && latestDetail.ok === true
      ? "ready"
      : "blocked"
    : "unknown";
  const issueCodes = Array.isArray(latestDetail.issue_codes)
    ? latestDetail.issue_codes.filter((value): value is string => typeof value === "string")
    : [];
  const latestMeta: ReactNode = latest ? (
    <>
      {formatDecisionTime(latest.timestamp)}
      {latest.event_hash ? <span className="auditor-only-inline"> / {shortHash(latest.event_hash)}</span> : null}
    </>
  ) : (
    text(locale, "modelSmokeAuditEmpty")
  );
  const latestModel = typeof latestDetail.result_model === "string" && latestDetail.result_model
    ? latestDetail.result_model
    : typeof latestDetail.configured_model === "string" && latestDetail.configured_model
      ? latestDetail.configured_model
      : text(locale, "unknown");
  const invoked = latestDetail.real_model_invoked === true;

  return (
    <div className="model-smoke-audit-panel" data-state={state}>
      <div className="model-runtime-header">
        <span className="security-icon">
          <Activity size={15} />
        </span>
        <div>
          <span className="security-label">{text(locale, "modelSmokeAudit")}</span>
          <strong>{latest ? auditActionLabel(latest.action, locale) : text(locale, "modelSmokeAuditEmpty")}</strong>
          <span className="security-detail">{latestMeta}</span>
        </div>
      </div>
      {latest ? (
        <>
          <p>
            {latestModel} / {invoked ? text(locale, "realModelInvoked") : text(locale, "noRealModel")}
          </p>
          {issueCodes.length ? (
            <p>
              {text(locale, "modelSmokeAuditBlocks")}: {issueCodes.join(", ")}
            </p>
          ) : null}
          <div className="model-smoke-audit-list">
            <span>{text(locale, "modelSmokeAuditHistory")}</span>
            {events.slice(0, 3).map((event) => (
              <article data-action={event.action} key={event.id}>
                <History size={13} />
                <strong>{auditActionLabel(event.action, locale)}</strong>
                <em>{formatDecisionTime(event.timestamp)}</em>
                {event.event_hash ? <small className="auditor-only-inline">{shortHash(event.event_hash)}</small> : null}
              </article>
            ))}
          </div>
        </>
      ) : (
        <p>{text(locale, "modelSmokeAuditEmpty")}</p>
      )}
    </div>
  );
}

function ModelArtifactIsolationPanel({
  isSubmitting,
  manifest,
  isolation,
  locale,
  onInitialize,
}: {
  isSubmitting: boolean;
  manifest: ModelArtifactManifest | null;
  isolation: ModelArtifactIsolationStatus | null;
  locale: Locale;
  onInitialize: () => void;
}) {
  const state = isolation?.state ?? "unknown";
  const lastRecord = manifest?.records.length ? manifest.records[manifest.records.length - 1] : null;
  return (
    <div className="model-artifact-panel" data-state={state}>
      <div className="model-runtime-header">
        <span className="security-icon">
          <FolderArchive size={15} />
        </span>
        <div>
          <span className="security-label">{text(locale, "modelArtifacts")}</span>
          <strong>{isolation?.policy_exists ? text(locale, "ready") : text(locale, "notReady")}</strong>
          <span className="security-detail">
            {isolation ? `${isolation.directory_count}/5 ${text(locale, "artifactDirs")}` : text(locale, "unknown")}
            {" / "}
            {manifest?.record_count ?? 0} {text(locale, "artifactRecords")}
          </span>
        </div>
      </div>
      {isolation ? (
        <>
          <p>{isolation.detail}</p>
          {isolation.warnings.length ? (
            <ul>
              {isolation.warnings.slice(0, 3).map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          {isolation.missing_directories.length ? (
            <p>
              {text(locale, "missingArtifactDirs")}: {isolation.missing_directories.join(", ")}
            </p>
          ) : null}
          {lastRecord ? (
            <p>
              {text(locale, "lastArtifact")}: {lastRecord.artifact_type}
              <span className="auditor-only-inline"> / {shortHash(lastRecord.sha256)}</span>
            </p>
          ) : null}
          {manifest ? (
            <p>
              {text(locale, "artifactChain")}:{" "}
              {manifest.chain_valid ? text(locale, "chainValid") : text(locale, "chainInvalid")}
              {manifest.latest_record_hash ? (
                <span className="auditor-only-inline"> / {shortHash(manifest.latest_record_hash)}</span>
              ) : null}
            </p>
          ) : null}
        </>
      ) : null}
      <button disabled={isSubmitting} type="button" onClick={onInitialize}>
        <FolderArchive size={14} />
        {isSubmitting ? "..." : text(locale, "initializeArtifacts")}
      </button>
    </div>
  );
}

function EnvironmentHealthPanel({
  health,
  locale,
}: {
  health: EnvironmentHealth | null;
  locale: Locale;
}) {
  if (!health) {
    return (
      <div className="environment-health" data-state="unknown">
        <div className="environment-health-header">
          <strong>{text(locale, "environmentHealth")}</strong>
          <span>{text(locale, "unknown")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="environment-health" data-state={health.state}>
      <div className="environment-health-header">
        <strong>{text(locale, "environmentHealth")}</strong>
        <span>{environmentStateLabel(health.state, locale)}</span>
      </div>
      <div className="environment-health-summary">
        <span>{text(locale, "ready")}: {health.summary.ready ?? 0}</span>
        <span>{text(locale, "warning")}: {health.summary.warning ?? 0}</span>
        <span>{text(locale, "blocked")}: {health.summary.blocked ?? 0}</span>
      </div>
      <div className="environment-health-checks">
        {health.checks.map((check) => (
          <details data-state={check.state} key={check.id}>
            <summary>
              <span>{environmentCheckLabel(check.id, check.label, locale)}</span>
              <em>{environmentStateLabel(check.state, locale)}</em>
            </summary>
            <p title={check.detail}>
              <span className="operator-only-inline">{compactDiagnosticText(check.detail, locale)}</span>
              <span className="auditor-only-inline">{check.detail}</span>
            </p>
            {check.remediation ? (
              <p title={check.remediation}>
                <span className="operator-only-inline">{compactDiagnosticText(check.remediation, locale)}</span>
                <span className="auditor-only-inline">{check.remediation}</span>
              </p>
            ) : null}
          </details>
        ))}
      </div>
    </div>
  );
}

function compactDiagnosticText(value: string, locale: Locale): string {
  const operatorText = localizeDiagnosticText(value, locale);
  const pathLabel = text(locale, "localPathHidden");
  return operatorText
    .replace(/[A-Za-z]:[\\/][^\s,;)]+/g, pathLabel)
    .replace(/\\\\[^\s,;)]+/g, pathLabel)
    .replace(/\b\/(?:Users|home|tmp|var|opt|mnt)\/[^\s,;)]+/g, pathLabel);
}

function localizeDiagnosticText(value: string, locale: Locale): string {
  if (locale !== "pl") {
    return value;
  }

  return value
    .replace(/^Local API process is responding\.$/, "Lokalne API odpowiada.")
    .replace(/^Synthetic case root does not exist:/, "Brakuje katalogu spraw syntetycznych:")
    .replace(/^No synthetic case\.json files found under/, "Nie znaleziono plików case.json w")
    .replace(/^(\d+) synthetic case fixture\(s\) available\.$/, "Dostępne sprawy syntetyczne: $1.")
    .replace(/^Workspace root exists:/, "Katalog obszaru roboczego istnieje:")
    .replace(/^Workspace root is not created yet:/, "Katalog obszaru roboczego nie został jeszcze utworzony:")
    .replace(/^Workspace parent does not exist:/, "Katalog nadrzędny obszaru roboczego nie istnieje:")
    .replace(
      /^Restore data\/synthetic before running prototype workflows\.$/,
      "Przywróć dane syntetyczne przed uruchomieniem workflow prototypu.",
    )
    .replace(
      /^Create or open a workspace to initialize the directory\.$/,
      "Utwórz albo otwórz obszar roboczy, aby zainicjalizować katalog.",
    )
    .replace(
      /^Create the local data directory before workspace operations\.$/,
      "Utwórz lokalny katalog danych przed operacjami obszaru roboczego.",
    )
    .replace(/^Encrypted storage is unavailable:/, "Szyfrowane dane są niedostępne:")
    .replace(
      /^Use synthetic\/plain prototype data only, or install SQLCipher before sensitive imports\.$/,
      "Używaj tylko syntetycznych danych prototypowych albo zainstaluj SQLCipher przed importem danych wrażliwych.",
    )
    .replace(
      /^Real model live output is enabled before institutional STOP review\.$/,
      "Wyjście realnego modelu live jest włączone przed przeglądem STOP.",
    )
    .replace(
      /^Disable live model output until the STOP review is complete\.$/,
      "Wyłącz wyjście modelu live do czasu zakończenia przeglądu STOP.",
    )
    .replace(/^(.+) real-model execution is enabled for (.+)\.$/, "Realny model ($1) jest włączony dla $2.")
    .replace(
      /^Use only smoke tests until model governance and evaluation are reviewed\.$/,
      "Używaj tylko testów smoke do czasu przeglądu governance i ewaluacji modelu.",
    )
    .replace(/^(.+) runtime active; live real-model output is blocked\.$/, "Aktywny runtime: $1; wyjście live jest zablokowane.");
}

function environmentCheckLabel(id: string, fallback: string, locale: Locale): string {
  const labels: Record<Locale, Record<string, string>> = {
    pl: {
      api: "Lokalne API",
      synthetic_cases: "Sprawy syntetyczne",
      workspace_root: "Katalog obszaru roboczego",
      encryption: "Szyfrowane dane",
      local_model: "Runtime modelu lokalnego",
    },
    en: {
      api: "Local API",
      synthetic_cases: "Synthetic cases",
      workspace_root: "Workspace root",
      encryption: "Encrypted storage",
      local_model: "Local model runtime",
    },
  };
  return labels[locale][id] ?? fallback;
}

function SecurityItem({
  detail,
  icon,
  state,
  title,
  value,
}: {
  detail: string;
  icon: ReactNode;
  state: "ready" | "warning" | "blocked" | "unknown";
  title: string;
  value: string;
}) {
  return (
    <article className="security-item" data-state={state}>
      <span className="security-icon">{icon}</span>
      <div>
        <span className="security-label">{title}</span>
        <strong>{value}</strong>
        <span className="security-detail">{detail}</span>
      </div>
    </article>
  );
}

function environmentStateLabel(state: EnvironmentHealthState, locale: Locale): string {
  const keys: Record<EnvironmentHealthState, CopyKey> = {
    blocked: "blocked",
    ready: "ready",
    unknown: "unknown",
    warning: "warning",
  };
  return text(locale, keys[state]);
}

function environmentStateShortLabel(state: EnvironmentHealthState, locale: Locale): string {
  const labels: Record<Locale, Record<EnvironmentHealthState, string>> = {
    pl: {
      blocked: "blokada",
      ready: "OK",
      unknown: "n/d",
      warning: "uwaga",
    },
    en: {
      blocked: "blocked",
      ready: "OK",
      unknown: "n/a",
      warning: "warn",
    },
  };
  return labels[locale][state];
}

function stopReviewDecisionLabel(decision: StopReviewDecisionType, locale: Locale): string {
  const labels: Record<StopReviewDecisionType, CopyKey> = {
    approved: "stopReviewDecisionApproved",
    rejected: "stopReviewDecisionRejected",
  };
  return text(locale, labels[decision]);
}

function storageModeLabel(
  mode: WorkspaceResponse["manifest"]["storage_mode"] | undefined,
  locale: Locale,
): string {
  if (mode === "encrypted_required") {
    return text(locale, "encryptedRequired");
  }
  if (mode === "plain_sqlite_prototype") {
    return text(locale, "plainPrototype");
  }
  return text(locale, "unknown");
}

function materialSourceLabel(sourceType: MaterialSourceType, locale: Locale): string {
  const labels: Record<MaterialSourceType, CopyKey> = {
    audio_transcript: "audioTranscript",
    case_protocol: "caseProtocol",
    external_document: "externalDocument",
    text_note: "textNote",
    user_note: "userNote",
  };
  return text(locale, labels[sourceType]);
}

function materialVerificationState(
  verification: MaterialVerification | undefined,
): "ready" | "warning" | "blocked" | "unknown" {
  if (!verification) {
    return "unknown";
  }
  if (verification.verified) {
    return "ready";
  }
  if (!verification.exists) {
    return "blocked";
  }
  return "warning";
}

function materialVerificationLabel(
  verification: MaterialVerification | undefined,
  locale: Locale,
): string {
  if (!verification) {
    return text(locale, "unknown");
  }
  if (verification.verified) {
    return text(locale, "verified");
  }
  if (!verification.exists) {
    return text(locale, "missing");
  }
  return text(locale, "changed");
}

function parseTags(value: string): string[] {
  const tags = value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  return Array.from(new Set(tags));
}

function createMaterialId(): string {
  return `material-${Date.now()}`;
}

function questionDraftToQuestionView(draft: QuestionDraft, locale: Locale): QuestionView {
  return {
    id: draft.id,
    text: { [draft.locale]: draft.text, [locale]: draft.text },
    type: questionTypeLabelFromDraft(draft.question_type, locale),
    topicIds: draft.topic_ids,
    source: draft.source,
  };
}

function questionTypeLabelFromDraft(questionType: string, locale: Locale): Record<Locale, string> {
  const fallback = questionType || "clarifying";
  if (fallback === "clarifying") {
    return {
      en: "clarifying",
      pl: "doprecyzowujące",
    };
  }
  return {
    en: fallback,
    pl: locale === "pl" ? fallback : fallback,
  };
}

function mergeQuestionViews(
  baseQuestions: QuestionView[],
  dynamicQuestions: QuestionView[],
): QuestionView[] {
  const byId = new Map<string, QuestionView>();
  for (const question of [...baseQuestions, ...dynamicQuestions]) {
    byId.set(question.id, question);
  }
  return Array.from(byId.values());
}

function upsertQuestionDraft(current: QuestionDraft[], draft: QuestionDraft): QuestionDraft[] {
  const withoutDraft = current.filter((item) => item.id !== draft.id);
  return [...withoutDraft, draft];
}

function sortQuestionDrafts(drafts: QuestionDraft[]): QuestionDraft[] {
  return [...drafts].sort((left, right) => {
    const rightTime = Date.parse(right.created_at);
    const leftTime = Date.parse(left.created_at);
    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }
    return left.id.localeCompare(right.id);
  });
}

function sortMaterials(materials: MaterialRecord[]): MaterialRecord[] {
  return [...materials].sort((left, right) => {
    const rightTime = Date.parse(right.created_at);
    const leftTime = Date.parse(left.created_at);
    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }
    return left.id.localeCompare(right.id);
  });
}

function shortHash(value: string): string {
  return value.length > 12 ? `${value.slice(0, 12)}...` : value;
}

function formatDecisionTime(value: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }
  return `${(value / 1024).toFixed(1)} KB`;
}

function StatusStrip({
  apiMode,
  locale,
  onReconnect,
  statusKey,
}: {
  apiMode: ApiMode;
  locale: Locale;
  onReconnect: () => void;
  statusKey: CopyKey;
}) {
  return (
    <div className="status-strip">
      <span className="chip">
        <Activity size={14} />
        {text(locale, "live")}
      </span>
      <span className="chip">
        <ShieldCheck size={14} />
        {text(locale, "airgapped")}
      </span>
      <span className="chip">{text(locale, "witness")}</span>
      <span className="chip" data-state={apiMode}>
        {apiMode === "online" ? <Wifi size={14} /> : <WifiOff size={14} />}
        {text(locale, statusKey)}
      </span>
      <span className="chip">
        <CheckCircle2 size={14} />
        {text(locale, "noAutomatedVerdict")}
      </span>
      {apiMode === "offline" ? (
        <button className="status-action" type="button" onClick={onReconnect}>
          <RefreshCw size={14} />
          {text(locale, "reconnect")}
        </button>
      ) : null}
    </div>
  );
}

function QuestionListItem({
  answered,
  index,
  isActive,
  locale,
  onSelect,
  question,
  topicsById,
}: {
  answered: boolean;
  index: number;
  isActive: boolean;
  locale: Locale;
  onSelect: () => void;
  question: QuestionView;
  topicsById: Map<string, CaseTopic>;
}) {
  const sourceLabel = questionSourceLabel(question.source);
  const topicLabels = question.topicIds
    .slice(0, 2)
    .map((topicId) => domainLabel(topicsById.get(topicId)?.label ?? topicId, locale));

  return (
    <button
      className={`question-item ${isActive ? "is-active" : ""}`}
      data-answered={answered ? "true" : "false"}
      type="button"
      onClick={onSelect}
    >
      <span className="question-item-index">{index + 1}</span>
      <span className="question-item-body">
        <span className="question-item-meta">
          <span className="question-type">{localize(question.type, locale)}</span>
          <span className={`question-status ${answered ? "is-answered" : "is-pending"}`}>
            {text(locale, answered ? "questionAnswered" : "questionPending")}
          </span>
          {sourceLabel ? <span className="question-source">{localize(sourceLabel, locale)}</span> : null}
        </span>
        <strong>{localize(question.text, locale)}</strong>
        {topicLabels.length ? (
          <span className="question-topic-strip">
            {topicLabels.map((label) => (
              <em key={`${question.id}-${label}`}>{label}</em>
            ))}
          </span>
        ) : null}
        {question.risk ? <span className="risk-tag">{localize(question.risk, locale)}</span> : null}
      </span>
    </button>
  );
}

function AnswerHistoryCard({
  answer,
  locale,
  onEditClaim,
  onReview,
  question,
  reviewingClaimIds,
}: {
  answer: AnswerView;
  locale: Locale;
  onEditClaim: (claim: ClaimView) => void;
  onReview: (
    answer: AnswerView,
    claim: ClaimView,
    decision: ClaimReviewStatus,
    finalClaim?: ClaimView,
  ) => void | Promise<void>;
  question: QuestionView | undefined;
  reviewingClaimIds: Set<string>;
}) {
  return (
    <article className="answer-card">
      <div className="answer-card-header">
        <strong>
          {text(locale, "answer")} {answer.id}
        </strong>
        <span className="meta">{answer.time}</span>
      </div>
      {question ? (
        <p className="answer-card-question">
          <span>{text(locale, "answerToQuestion")}</span>
          {localize(question.text, locale)}
        </p>
      ) : null}
      <p>{localize(answer.text, locale)}</p>
      {answer.claims?.length ? (
        <div className="claim-review-list">
          <div className="claim-review-list-header">
            <strong>{text(locale, "claimReviewTitle")}</strong>
            <span>{answer.claims.length}</span>
          </div>
          {answer.claims.map((claim) => {
            const disabled = reviewingClaimIds.has(claim.id);
            return (
              <div className="claim-review-item" data-state={claim.reviewStatus} key={claim.id}>
                <div className="claim-review-main">
                  <span className="claim-review-status">{claimReviewStatusLabel(claim.reviewStatus, locale)}</span>
                  <strong>
                    {domainLabel(claim.subject, locale)} / {domainLabel(claim.attribute.replaceAll("_", " "), locale)}
                  </strong>
                  <span>{domainLabel(claim.value, locale)}</span>
                  {claim.sourceText ? <em title={claim.sourceText}>{claim.sourceText}</em> : null}
                </div>
                <div className="claim-review-actions">
                  <button
                    type="button"
                    aria-label={`${text(locale, "claimReviewAccept")}: ${domainLabel(claim.value, locale)}`}
                    title={text(locale, "claimReviewAccept")}
                    disabled={disabled}
                    onClick={() => void onReview(answer, claim, "accepted")}
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label={`${text(locale, "claimReviewEdit")}: ${domainLabel(claim.value, locale)}`}
                    title={text(locale, "claimReviewEdit")}
                    disabled={disabled}
                    onClick={() => onEditClaim(claim)}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label={`${text(locale, "claimReviewReject")}: ${domainLabel(claim.value, locale)}`}
                    title={text(locale, "claimReviewReject")}
                    disabled={disabled}
                    onClick={() => void onReview(answer, claim, "rejected")}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </article>
  );
}

function claimReviewStatusLabel(status: ClaimReviewStatus, locale: Locale): string {
  const keys: Record<ClaimReviewStatus, CopyKey> = {
    pending: "claimReviewPending",
    accepted: "claimReviewAccepted",
    edited: "claimReviewEdited",
    rejected: "claimReviewRejected",
  };
  return text(locale, keys[status]);
}

function PanelHeader({
  compact = false,
  meta,
  title,
}: {
  compact?: boolean;
  meta: string;
  title: string;
}) {
  return (
    <div className={`panel-header ${compact ? "compact" : ""}`}>
      <h2>{title}</h2>
      <span>{meta}</span>
    </div>
  );
}

function IndicatorCard({ indicator, locale }: { indicator: Indicator; locale: Locale }) {
  return (
    <article className="indicator-card">
      <div className="indicator-header">
        <strong>{domainLabel(indicator.label, locale)}</strong>
        <span className="score">{indicator.score === null ? "n/a" : indicator.score.toFixed(2)}</span>
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: scorePercent(indicator.score) }} />
      </div>
      <div className="confidence-row">
        <span>{text(locale, "confidence")}</span>
        <strong>{indicator.confidence.toFixed(2)}</strong>
      </div>
      <div className="factor-list">
        {indicator.factors.map((factor) => (
          <div className="factor-row" key={factor.id}>
            <span>{domainLabel(factor.label, locale)}</span>
            <strong>{factor.value}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

function SuggestionCard({ detail, title }: { detail: string; title: string }) {
  return (
    <article className="suggestion-card">
      <strong>
        <ListChecks size={15} />
        {title}
      </strong>
      <p>{detail}</p>
    </article>
  );
}

function FindingCard({ finding, locale }: { finding: ReviewFinding; locale: Locale }) {
  return (
    <article className="finding-card" data-severity={finding.severity}>
      <strong>
        <AlertTriangle size={15} />
        {findingTitle(finding, locale)}
      </strong>
      <span className="finding-meta">{finding.severity}</span>
      <p>{findingDetail(finding, locale)}</p>
    </article>
  );
}

function findingTitle(finding: ReviewFinding, locale: Locale): string {
  if (locale === "en") {
    return finding.title;
  }

  if (finding.category === "missing_topic") {
    const topic =
      typeof finding.metadata?.topic_label === "string" ? domainLabel(finding.metadata.topic_label, locale) : "";
    return `${text(locale, "missingTopicTitlePrefix")}: ${topic}`.trim();
  }
  if (finding.category === "question_neutrality") {
    return text(locale, "questionNeutralityTitle");
  }
  if (finding.category === "potential_inconsistency") {
    const attribute =
      typeof finding.metadata?.attribute === "string" ? domainLabel(finding.metadata.attribute, locale) : "";
    return `${text(locale, "potentialInconsistencyTitlePrefix")}: ${attribute}`.trim();
  }

  return finding.title;
}

function findingDetail(finding: ReviewFinding, locale: Locale): string {
  if (locale === "en") {
    return finding.detail;
  }

  if (finding.category === "missing_topic") {
    return text(locale, "missingTopicDetail");
  }
  if (finding.category === "question_neutrality") {
    return text(locale, "questionNeutralityDetail");
  }
  if (finding.category === "potential_inconsistency") {
    return text(locale, "potentialInconsistencyDetail");
  }

  return finding.detail;
}
