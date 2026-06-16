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
  Network,
  Pencil,
  Plus,
  ClipboardCopy,
  RefreshCw,
  Send,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import {
  addAnswer,
  ensureModelArtifactIsolation,
  ensureWorkspace,
  loadCaseCatalog,
  loadCaseReview,
  loadCaseStarterMaterials,
  loadEncryptionStatus,
  loadEnvironmentHealth,
  loadEvidenceMap,
  loadGroundedSuggestions,
  loadLocalModelConfig,
  loadMaterialQuestionLinks,
  loadModelArtifactManifest,
  loadModelArtifactIsolation,
  loadOperatorActionDecisions,
  loadSessionAudit,
  loadWorkspaceMaterialPreview,
  loadSessionReview,
  loadWorkspaceAccess,
  loadWorkspaceAudit,
  loadWorkspaceMaterials,
  recordGroundedSuggestionDecision,
  recordMaterialQuestionLinkDecision,
  recordOperatorActionDecision,
  registerWorkspaceMaterial,
  runLocalModelSmoke,
  seedWorkspaceMaterials,
  startSession,
  verifyWorkspaceMaterial,
  type ApiError,
} from "./api";
import { AiRuntimeStatusCard } from "./ai-status-card";
import { CaseCatalogBadges, CaseWorkflowProgress, WorkspaceEmptyState, type CaseWorkflowStage } from "./case-workflow";
import { evidenceStatusLabel } from "./evidence-labels";
import { GroundingPackPanel } from "./grounding-pack-panel";
import {
  formatGroundedAiError,
  GroundedSuggestionsPanel,
} from "./grounded-ai-panel";
import { SessionReportPanel } from "./session-report-panel";
import type { SessionReportExportInput } from "./session-report";
import { seedAnswers, seedCaseCatalog, seedFindings, seedIndicators, seedQuestions } from "./demoData";
import { domainLabel, localize, text, type CopyKey } from "./i18n";
import type {
  Answer,
  AnswerView,
  ApiMode,
  AuditEvent,
  CaseCatalogItem,
  CaseData,
  CaseTopic,
  EncryptionStatus,
  EnvironmentHealth,
  EnvironmentHealthState,
  EvidenceAlignment,
  EvidenceMap,
  EvidenceTopicNode,
  EvidenceTopicStatus,
  GroundedSuggestionDecision,
  GroundedSuggestion,
  GroundedSuggestionsResponse,
  GroundedSuggestionWarning,
  Indicator,
  InterviewSession,
  InterviewReview,
  Locale,
  LocalModelConfig,
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
  QuestionView,
  ReviewFinding,
  RuntimeConfig,
  SessionAuditResponse,
  StarterMaterial,
  WorkspaceAccessDecision,
  WorkspaceAuditResponse,
  WorkspaceResponse,
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

type OperationsTab = "monitor" | "ai" | "materials" | "review";

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

const materialSourceTypes: MaterialSourceType[] = [
  "case_protocol",
  "text_note",
  "user_note",
  "audio_transcript",
  "external_document",
];

const config = runtimeConfig();

export function App() {
  const [locale, setLocale] = useState<Locale>("pl");
  const [apiMode, setApiMode] = useState<ApiMode>("offline");
  const [statusKey, setStatusKey] = useState<CopyKey>("localDemo");
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
  const [modelArtifactManifest, setModelArtifactManifest] = useState<ModelArtifactManifest | null>(null);
  const [modelArtifactIsolation, setModelArtifactIsolation] = useState<ModelArtifactIsolationStatus | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [workspaceAccess, setWorkspaceAccess] = useState<WorkspaceAccessDecision | null>(null);
  const [workspaceAudit, setWorkspaceAudit] = useState<WorkspaceAuditResponse | null>(null);
  const [sessionAudit, setSessionAudit] = useState<SessionAuditResponse | null>(null);
  const [workspaceMaterials, setWorkspaceMaterials] = useState<MaterialRecord[]>([]);
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
  } | null>(null);
  const [suggestionDrafts, setSuggestionDrafts] = useState<Record<string, string>>({});
  const [suggestionDecisions, setSuggestionDecisions] = useState<Record<string, GroundedSuggestionDecision>>({});
  const [isGroundedSuggestionsLoading, setIsGroundedSuggestionsLoading] = useState(false);
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
        } | null;
        decisions: Record<string, GroundedSuggestionDecision>;
        drafts: Record<string, string>;
      }
    >
  >({});
  const [materialDraft, setMaterialDraft] = useState<MaterialDraft>(emptyMaterialDraft);
  const [materialVerifications, setMaterialVerifications] = useState<Record<string, MaterialVerification>>({});
  const [activeQuestionId, setActiveQuestionId] = useState("q-001");
  const [activeOperationsTab, setActiveOperationsTab] = useState<OperationsTab>("monitor");
  const [dismissedOperatorActionIds, setDismissedOperatorActionIds] = useState<Set<string>>(new Set());
  const [answerText, setAnswerText] = useState("");
  const [localAnswers, setLocalAnswers] = useState<Answer[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMaterialSubmitting, setIsMaterialSubmitting] = useState(false);
  const [isArtifactIsolationSubmitting, setIsArtifactIsolationSubmitting] = useState(false);
  const [isModelSmokeRunning, setIsModelSmokeRunning] = useState(false);
  const didInitializeApi = useRef(false);
  const [demoReviewVisited, setDemoReviewVisited] = useState(false);
  const [leftRailCollapsed, setLeftRailCollapsed] = useState(false);
  const [rightRailCollapsed, setRightRailCollapsed] = useState(true);
  const [tutorialActive, setTutorialActive] = useState(false);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);

  const questions = useMemo<QuestionView[]>(() => {
    return caseData?.questions.length ? caseData.questions.map(toQuestionView) : seedQuestions;
  }, [caseData]);

  const activeQuestion = questions.find((question) => question.id === activeQuestionId) ?? questions[0];
  const materialsById = useMemo(() => {
    return new Map(workspaceMaterials.map((material) => [material.id, material]));
  }, [workspaceMaterials]);
  const activeQuestionLinks = useMemo(() => {
    return materialQuestionLinks.filter((link) => link.question_id === activeQuestion?.id);
  }, [activeQuestion?.id, materialQuestionLinks]);

  const answerViews = useMemo(() => {
    const base = caseData?.answers.length
      ? caseData.answers.map((answer) => toAnswerView(answer, locale))
      : seedAnswers;
    const sessionAnswers = session?.answers.map((answer) => toAnswerView(answer, locale)) ?? [];
    const localAnswerViews = localAnswers.map((answer) => toAnswerView(answer, locale));
    return [...base, ...localAnswerViews, ...sessionAnswers];
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
        decisions: materialQuestionLinkDecisions,
        evidenceMap,
        links: materialQuestionLinks,
        locale,
        materials: workspaceMaterials,
        questions,
        verifications: materialVerifications,
      }),
    [
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
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    if (activeOperationsTab === "review") {
      setDemoReviewVisited(true);
    }
  }, [activeOperationsTab]);

  const startTutorial = useCallback(() => {
    setLeftRailCollapsed(false);
    setTutorialStepIndex(0);
    setTutorialActive(true);
  }, []);

  const closeTutorial = useCallback(() => {
    setTutorialActive(false);
    setTutorialStepIndex(0);
  }, []);

  const handleTutorialStepEnter = useCallback((step: TutorialStepDefinition) => {
    if (step.id === "zone-left" || step.id === "case-dossier" || step.id === "demo-walkthrough") {
      setLeftRailCollapsed(false);
    }

    if (
      step.id === "zone-operations" ||
      step.id === "operations-tabs" ||
      step.id === "tab-monitor" ||
      step.id === "tab-ai" ||
      step.id === "tab-materials" ||
      step.id === "tab-review"
    ) {
      setRightRailCollapsed(false);
    }

    if (step.id === "tab-monitor") {
      setActiveOperationsTab("monitor");
    }
    if (step.id === "tab-ai") {
      setActiveOperationsTab("ai");
    }
    if (step.id === "tab-materials") {
      setActiveOperationsTab("materials");
    }
    if (step.id === "tab-review") {
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

  const demoChecklist = useMemo(() => {
    const answeredCount = new Set(answerViews.map((answer) => answer.questionId)).size;
    return [
      {
        id: "question",
        label: text(locale, "demoStepQuestion"),
        done: answeredCount > 0,
      },
      {
        id: "local-ai",
        label: text(locale, "demoStepLocalAi"),
        done: environmentHealth !== null || localModelConfig !== null,
      },
      {
        id: "materials",
        label: text(locale, "demoStepMaterials"),
        done: workspaceMaterials.length > 0,
      },
      {
        id: "grounded-ai",
        label: text(locale, "demoStepGroundedAi"),
        done: groundedSuggestions.length > 0,
      },
      {
        id: "review",
        label: text(locale, "demoStepReview"),
        done: demoReviewVisited,
      },
      {
        id: "report",
        label: text(locale, "demoStepReport"),
        done: sessionReportExported,
      },
    ];
  }, [
    answerViews,
    demoReviewVisited,
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

    setApiMode("connecting");
    setStatusKey("connecting");

    try {
      const [catalog, caseReview, starterMaterials] = await Promise.all([
        loadCaseCatalog(config, locale).catch(() => ({ cases: seedCaseCatalog[locale] })),
        loadCaseReview(config, locale),
        loadCaseStarterMaterials(config, locale).catch(() => ({ case_id: config.caseId, materials: [] })),
      ]);
      const firstQuestionId = caseReview.case.questions[0]?.id ?? activeQuestionId;
      setCaseCatalog(catalog.cases);
      setCaseData(caseReview.case);
      setCaseStarterMaterials(starterMaterials.materials);
      setActiveQuestionId(firstQuestionId);
      setIndicators(caseReview.indicators);
      setReview(caseReview.review);
      setFindings(caseReview.review.findings);
      await refreshSecurityState(firstQuestionId);
      await startOrResumeSession(config);
      const sessionReview = await loadSessionReview(config, locale);
      const nextSessionAudit = await loadSessionAuditOrNull();
      setSession(sessionReview.session);
      setSessionAudit(nextSessionAudit);
      setIndicators(sessionReview.indicators);
      setReview(sessionReview.snapshot.review);
      setFindings(sessionReview.snapshot.review.findings);
      setReportMarkdown(sessionReview.report_markdown);
      setApiMode("online");
      setStatusKey("online");
    } catch (error) {
      console.warn("Local API unavailable, using static demo data.", error);
      setCaseCatalog(seedCaseCatalog[locale]);
      setCaseStarterMaterials([]);
      setReview(null);
      setReportMarkdown(null);
      setApiMode("offline");
      setStatusKey("offline");
    }
  }

  async function refreshSecurityState(questionId = activeQuestionId) {
    try {
      const [security, health, modelConfig, ensuredWorkspace] = await Promise.all([
        loadEncryptionStatus(config),
        loadEnvironmentHealth(config),
        loadLocalModelConfig(config),
        ensureWorkspace(config),
      ]);
      await seedWorkspaceMaterials(config, locale).catch((error) => {
        console.warn("Could not seed starter materials.", error);
        return null;
      });
      const [
        access,
        artifactManifest,
        artifactIsolation,
        materialList,
        materialLinks,
        nextEvidenceMap,
        operatorDecisions,
        nextGroundedSuggestions,
      ] = await Promise.all([
        loadWorkspaceAccess(config),
        loadModelArtifactManifest(config),
        loadModelArtifactIsolation(config),
        loadWorkspaceMaterials(config),
        loadMaterialQuestionLinksOrEmpty(locale),
        loadEvidenceMapOrNull(locale),
        loadOperatorActionDecisionsOrEmpty(),
        loadGroundedSuggestionsOrEmpty(locale, questionId),
      ]);
      const auditTrail = await loadWorkspaceAuditOrNull();
      setEncryptionStatus(security);
      setEnvironmentHealth(health);
      setLocalModelConfig(modelConfig);
      setModelArtifactManifest(artifactManifest);
      setModelArtifactIsolation(artifactIsolation);
      setWorkspaceAudit(auditTrail);
      setWorkspace(ensuredWorkspace);
      setWorkspaceAccess(access);
      setWorkspaceMaterials(sortMaterials(materialList.materials));
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
      setModelArtifactManifest(null);
      setModelArtifactIsolation(null);
      setWorkspace(null);
      setWorkspaceAccess(null);
      setWorkspaceAudit(null);
      setSessionAudit(null);
      setWorkspaceMaterials([]);
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

  async function loadSessionAuditOrNull(): Promise<SessionAuditResponse | null> {
    try {
      return await loadSessionAudit(config);
    } catch (error) {
      console.warn("Could not refresh session audit trail.", error);
      return null;
    }
  }

  async function refreshAuditTrails() {
    const [nextWorkspaceAudit, nextSessionAudit] = await Promise.all([
      loadWorkspaceAuditOrNull(),
      loadSessionAuditOrNull(),
    ]);
    setWorkspaceAudit(nextWorkspaceAudit);
    setSessionAudit(nextSessionAudit);
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
    if (apiMode !== "online") {
      return;
    }

    setApiMode("connecting");
    setStatusKey("connecting");
    groundedCacheRef.current = {};
    setGroundedCacheTick((value) => value + 1);

    try {
      const [
        catalog,
        caseReview,
        starterMaterials,
        sessionReview,
        materialLinks,
        nextEvidenceMap,
        nextGroundedSuggestions,
      ] = await Promise.all([
        loadCaseCatalog(config, nextLocale).catch(() => ({ cases: seedCaseCatalog[nextLocale] })),
        loadCaseReview(config, nextLocale),
        loadCaseStarterMaterials(config, nextLocale).catch(() => ({ case_id: config.caseId, materials: [] })),
        loadSessionReview(config, nextLocale),
        loadMaterialQuestionLinksOrEmpty(nextLocale),
        loadEvidenceMapOrNull(nextLocale),
        loadGroundedSuggestionsOrEmpty(nextLocale, activeQuestionId),
      ]);
      setCaseCatalog(catalog.cases);
      setCaseData(caseReview.case);
      setCaseStarterMaterials(starterMaterials.materials);
      if (!caseReview.case.questions.some((question) => question.id === activeQuestionId)) {
        setActiveQuestionId(caseReview.case.questions[0]?.id ?? activeQuestionId);
      }
      setSession(sessionReview.session);
      setIndicators(sessionReview.indicators);
      setReview(sessionReview.snapshot.review);
      setFindings(sessionReview.snapshot.review.findings);
      setReportMarkdown(sessionReview.report_markdown);
      setMaterialQuestionLinks(materialLinks);
      setEvidenceMap(nextEvidenceMap);
      applyGroundedSuggestions(nextGroundedSuggestions);
      setApiMode("online");
      setStatusKey("reviewUpdated");
    } catch (error) {
      console.warn("Could not refresh localized API state.", error);
      setCaseCatalog(seedCaseCatalog[nextLocale]);
      setCaseStarterMaterials([]);
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
      const [health, manifest] = await Promise.all([
        loadEnvironmentHealth(config),
        loadModelArtifactManifest(config),
      ]);
      setModelArtifactIsolation(isolation);
      setModelArtifactManifest(manifest);
      setEnvironmentHealth(health);
      setStatusKey("artifactIsolationReady");
    } catch (error) {
      console.error("Could not initialize model artifact isolation.", error);
      setStatusKey("artifactIsolationFailed");
    } finally {
      setIsArtifactIsolationSubmitting(false);
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
    setLocale(nextLocale);
    if (apiMode !== "online") {
      setCaseCatalog(seedCaseCatalog[nextLocale]);
    }
    void refreshLocalizedApiState(nextLocale);
  }

  function navigateCaseWorkflow(stage: CaseWorkflowStage) {
    if (stage === "dossier" || stage === "interview") {
      setLeftRailCollapsed(false);
    }
    if (stage === "interview") {
      setRightRailCollapsed(true);
      return;
    }

    setRightRailCollapsed(false);
    if (stage === "materials") {
      setActiveOperationsTab("materials");
      return;
    }
    if (stage === "ai") {
      setActiveOperationsTab("ai");
      return;
    }
    setActiveOperationsTab("review");
    setDemoReviewVisited(true);
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

  function startFreshDemo() {
    const nextUrl = new URL(window.location.href);
    const stamp = Date.now();
    nextUrl.searchParams.set("session", `${config.caseId}-demo-${stamp}`);
    nextUrl.searchParams.set("workspace", `${config.caseId}-workspace-${stamp}`);
    window.location.assign(nextUrl.toString());
  }

  async function copyDemoSummary() {
    const answeredCount = new Set(answerViews.map((answer) => answer.questionId)).size;
    const summary = buildDemoSummaryText({
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
      setStatusKey("demoSummaryCopied");
    } catch {
      setStatusKey("demoSummaryCopyFailed");
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
      activeTab: activeOperationsTab,
      firstMaterial: firstGuidanceMaterial,
      locale,
      onOpenAi: () => setActiveOperationsTab("ai"),
      onOpenMaterials: () => setActiveOperationsTab("materials"),
      onOpenMonitor: () => setActiveOperationsTab("monitor"),
      onOpenReview: () => {
        setActiveOperationsTab("review");
        setDemoReviewVisited(true);
      },
      onPreviewMaterial: (materialId) => void toggleMaterialPreview(materialId),
      onRegenerateAi: () => void refreshGroundedSuggestions(),
    }),
  ];

  return (
    <div className="app-shell">
      <header className="topbar" data-tutorial="topbar">
        <div className="brand-block">
          <img className="brand-mark" src="/brand/logo-mark.svg" alt="InterrogA(I)tion" width={44} height={44} />
          <div>
            <h1>InterrogA(I)tion</h1>
            <p>{caseData?.title ?? text(locale, "caseFallback")}</p>
            <p className="topbar-session-meta">
              {config.caseId} · {config.sessionId} · {config.participantId}
            </p>
          </div>
        </div>

        <div className="topbar-actions">
          <TutorialLaunchButton locale={locale} onStart={startTutorial} />
          <StatusStrip
            apiMode={apiMode}
            locale={locale}
            statusKey={statusKey}
            onReconnect={() => void initializeApiWorkflow()}
          />
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
      </header>

      <main
        className="workspace"
        data-left-collapsed={leftRailCollapsed ? "true" : "false"}
        data-right-collapsed={rightRailCollapsed ? "true" : "false"}
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
            <CaseCatalogPanel
              cases={caseCatalog}
              currentCaseId={config.caseId}
              locale={locale}
              onOpenCase={openCase}
            />
            <CaseWorkflowProgress
              answerCount={answerViews.length}
              apiMode={apiMode}
              groundedCount={groundedSuggestions.length}
              locale={locale}
              materialCount={workspaceMaterials.length}
              reportExported={sessionReportExported}
              reviewVisited={demoReviewVisited}
              onNavigate={navigateCaseWorkflow}
            />
            <CaseDossierPanel
              answerCount={answerViews.length}
              caseData={caseData}
              locale={locale}
              review={review}
              starterMaterials={caseStarterMaterials}
              onOpenMaterials={() => setActiveOperationsTab("materials")}
            />
            <DemoWalkthroughPanel
              checklist={demoChecklist}
              locale={locale}
              onCopySummary={() => void copyDemoSummary()}
              onOpenAi={() => setActiveOperationsTab("ai")}
              onOpenMaterials={() => setActiveOperationsTab("materials")}
              onOpenMonitor={() => setActiveOperationsTab("monitor")}
              onOpenNextQuestion={() => {
                const answeredQuestionIds = new Set(answerViews.map((answer) => answer.questionId));
                const nextQuestion = questions.find((question) => !answeredQuestionIds.has(question.id));
                if (nextQuestion) {
                  selectActiveQuestion(nextQuestion.id);
                }
              }}
              onOpenReview={() => setActiveOperationsTab("review")}
              onStartFresh={startFreshDemo}
            />
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
          label={text(locale, "zoneInterview")}
          locale={locale}
          side="center"
          onToggleCollapse={() => undefined}
        >
          <section className="interview-workspace">
            <InterviewContextStrip
              activeQuestionLabel={localize(activeQuestion?.text, locale)}
              caseId={config.caseId}
              coverageLabel={questionCoverageLabel}
              locale={locale}
              participantId={config.participantId}
              roleLabel={participantRoleLine}
              sessionId={config.sessionId}
              topicCoverageLabel={topicCoverageLabel}
              urgentActionCount={urgentOperatorActionCount}
            />

            <CollapsibleWorkspaceCard
              defaultOpen={urgentOperatorActionCount > 0}
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
                questionCount={questions.length}
                recentDecisions={operatorActionDecisions.slice(0, 4)}
                onAction={runOperatorAction}
                onDecision={markOperatorAction}
              />
            </CollapsibleWorkspaceCard>

            <WorkspaceCard
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
              />
            </WorkspaceCard>

            <CollapsibleWorkspaceCard
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
                      question={questionsById.get(answer.questionId)}
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
          </section>
        </WorkspaceZone>

        <WorkspaceZone
          collapsed={rightRailCollapsed}
          disclosureHint={text(locale, "expandWhenNeeded")}
          label={text(locale, "zoneOperations")}
          locale={locale}
          side="right"
          tutorialId="zone-operations"
          onToggleCollapse={() => setRightRailCollapsed((current) => !current)}
        >
          <aside className="insight-panel">
          <div className="operations-rail-toolbar">
            <div className="operations-rail-header">
              <div>
                <span>{text(locale, "operationsRail")}</span>
                <strong>{operationsTabs.find((tab) => tab.id === activeOperationsTab)?.label ?? text(locale, "operationsMonitor")}</strong>
              </div>
              <span className="meta">{apiMode === "online" ? text(locale, "online") : text(locale, statusKey)}</span>
            </div>
            <div
              className="operations-tabs"
              data-tutorial="operations-tabs"
              role="tablist"
              aria-label={text(locale, "operationsRail")}
            >
              {operationsTabs.map((tab) => (
                <button
                  aria-selected={activeOperationsTab === tab.id}
                  className={activeOperationsTab === tab.id ? "is-active" : ""}
                  data-tutorial={`operations-tab-${tab.id}`}
                  key={tab.id}
                  role="tab"
                  type="button"
                  onClick={() => setActiveOperationsTab(tab.id)}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  <strong>{tab.value}</strong>
                </button>
              ))}
            </div>
          </div>

          <div className="operations-content" data-tab={activeOperationsTab}>
            {apiMode !== "online" ? (
              <WorkspaceEmptyState
                detail={text(locale, "operationsOfflineDetail")}
                locale={locale}
                title={text(locale, "operationsOfflineTitle")}
              />
            ) : null}
            {apiMode === "online" ? (
              <OperationsGuidanceCard
                activeTab={activeOperationsTab}
                actions={operationsGuidanceActions}
                answeredCount={answeredQuestionCount}
                findingCount={visibleFindings.length}
                locale={locale}
                materialCount={workspaceMaterials.length}
                questionCount={questions.length}
                reportExported={sessionReportExported}
                suggestionCount={groundedSuggestions.length}
              />
            ) : null}
            {activeOperationsTab === "monitor" ? (
              <>
                <CollapsibleSection
                  accordionGroup="ops-monitor"
                  className="operations-section"
                  defaultOpen
                  hint={text(locale, "expandWhenNeeded")}
                  meta={workspace?.manifest?.status ?? text(locale, "unknown")}
                  title={text(locale, "security")}
                >
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
                    locale={locale}
                    localModelConfig={localModelConfig}
                    localModelSmoke={localModelSmoke}
                    modelArtifactManifest={modelArtifactManifest}
                    modelArtifactIsolation={modelArtifactIsolation}
                    materials={workspaceMaterials}
                    onArtifactIsolation={() => void initializeModelArtifactIsolation()}
                    onModelSmoke={(executeReal) => void smokeLocalModel(executeReal)}
                    workspace={workspace}
                  />
                </CollapsibleSection>
                <CollapsibleSection
                  accordionGroup="ops-monitor"
                  className="operations-section"
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
              </>
            ) : null}

            {activeOperationsTab === "ai" ? (
              <>
                <CollapsibleSection
                  accordionGroup="ops-ai"
                  className="operations-section"
                  defaultOpen
                  hint={text(locale, "expandWhenNeeded")}
                  meta={String(groundedSuggestions.length)}
                  title={text(locale, "groundedAi")}
                >
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
                    onUse={useSuggestion}
                  />
                </CollapsibleSection>
                <CollapsibleSection
                  accordionGroup="ops-ai"
                  className="operations-section"
                  defaultOpen={false}
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
                  accordionGroup="ops-ai"
                  className="operations-section"
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
              </>
            ) : null}

            {activeOperationsTab === "materials" ? (
              <CollapsibleSection
                accordionGroup="ops-materials"
                className="operations-section"
                defaultOpen
                hint={text(locale, "expandWhenNeeded")}
                meta={`${workspaceMaterials.length} ${text(locale, "registered")}`}
                title={text(locale, "materialRegister")}
              >
                <MaterialsPanel
                  apiMode={apiMode}
                  bare
                  decisions={materialQuestionLinkDecisions}
                  draft={materialDraft}
                  isSubmitting={isMaterialSubmitting}
                  locale={locale}
                  links={materialQuestionLinks}
                  materials={workspaceMaterials}
                  tasks={materialTasks}
                  activePreviewId={activeMaterialPreviewId}
                  previews={materialPreviews}
                  verifications={materialVerifications}
                  onDecideLink={(link, decision) => void decideMaterialQuestionLink(link, decision)}
                  onDraftChange={setMaterialDraft}
                  onOpenQuestion={(questionId) => selectActiveQuestion(questionId)}
                  onPreview={(materialId) => void toggleMaterialPreview(materialId)}
                  onSubmit={() => void registerMaterial()}
                  onVerify={(materialId) => void verifyMaterial(materialId)}
                />
              </CollapsibleSection>
            ) : null}

            {activeOperationsTab === "review" ? (
              <>
                <CollapsibleSection
                  accordionGroup="ops-review"
                  className="operations-section"
                  defaultOpen
                  hint={text(locale, "expandWhenNeeded")}
                  meta={text(locale, "sessionReportMeta")}
                  title={text(locale, "sessionReport")}
                  tutorialId="session-report"
                >
                  <SessionReportPanel
                    apiMode={apiMode}
                    config={config}
                    exportInput={sessionReportExportInput}
                    locale={locale}
                    preview={reportMarkdown}
                    onExported={() => {
                      setSessionReportExported(true);
                      setStatusKey("sessionReportCopied");
                    }}
                  />
                </CollapsibleSection>
                <CollapsibleSection
                  accordionGroup="ops-review"
                  className="operations-section"
                  hint={text(locale, "expandWhenNeeded")}
                  meta={text(locale, "noAutomatedVerdict")}
                  title={text(locale, "stopReadiness")}
                >
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
                </CollapsibleSection>
                <CollapsibleSection
                  accordionGroup="ops-review"
                  className="operations-section"
                  hint={text(locale, "expandWhenNeeded")}
                  meta={text(locale, "reviewSignals")}
                  title={text(locale, "investigativeBoard")}
                >
                  <InvestigativeBoardPanel
                    bare
                    caseData={caseData}
                    evidenceMap={evidenceMap}
                    findings={visibleFindings}
                    locale={locale}
                    materialsById={materialsById}
                  />
                </CollapsibleSection>
                <CollapsibleSection
                  accordionGroup="ops-review"
                  className="operations-section"
                  hint={text(locale, "expandWhenNeeded")}
                  meta={`${(workspaceAudit?.events.length ?? 0) + (sessionAudit?.events.length ?? 0)} ${text(locale, "auditEvents")}`}
                  title={text(locale, "provenanceTimeline")}
                >
                  <ProvenanceTimelinePanel
                    bare
                    locale={locale}
                    sessionAudit={sessionAudit}
                    workspaceAudit={workspaceAudit}
                  />
                </CollapsibleSection>
                <CollapsibleSection
                  accordionGroup="ops-review"
                  className="operations-section"
                  hint={text(locale, "expandWhenNeeded")}
                  meta={text(locale, "visible")}
                  title={text(locale, "indicators")}
                >
                  <div className="indicator-list">
                    {visibleIndicators.map((indicator) => (
                      <IndicatorCard indicator={indicator} key={indicator.id} locale={locale} />
                    ))}
                  </div>
                </CollapsibleSection>
                <CollapsibleSection
                  accordionGroup="ops-review"
                  className="operations-section"
                  hint={text(locale, "expandWhenNeeded")}
                  meta={formatCount(visibleFindings.length, locale, {
                    singular: text(locale, "findingSingular"),
                    pluralFew: text(locale, "findingPluralFew"),
                    pluralMany: text(locale, "findingPluralMany"),
                  })}
                  title={text(locale, "findings")}
                >
                  <div className="finding-list">
                    {visibleFindings.map((finding) => (
                      <FindingCard finding={finding} key={`${finding.category}-${finding.title}`} locale={locale} />
                    ))}
                  </div>
                </CollapsibleSection>
              </>
            ) : null}
          </div>
          </aside>
        </WorkspaceZone>
      </main>

      {activeMaterialPreviewId ? (
        <Modal
          locale={locale}
          subtitle={activeMaterialPreviewId}
          title={materialsById.get(activeMaterialPreviewId)?.title ?? text(locale, "materialPreview")}
          onClose={() => setActiveMaterialPreviewId(null)}
        >
          <MaterialPreviewPanel locale={locale} preview={materialPreviews[activeMaterialPreviewId]} />
        </Modal>
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

  return (
    <div className="operations-guidance-card" data-tutorial="operations-guidance">
      <div className="operations-guidance-main">
        <span aria-hidden="true">{activeGuidance.icon}</span>
        <div>
          <small>{text(locale, "operationsGuideLabel")}</small>
          <strong>{text(locale, activeGuidance.titleKey)}</strong>
          <p>{text(locale, activeGuidance.detailKey)}</p>
        </div>
      </div>
      <div className="operations-guidance-metrics" aria-label={text(locale, "operationsGuideMetrics")}>
        {metrics.map((metric) => (
          <span key={metric.label}>
            <strong>{metric.value}</strong>
            {metric.label}
          </span>
        ))}
      </div>
      <div className="operations-guidance-actions" aria-label={text(locale, "operationsGuideActions")}>
        {actions.map((action) => (
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
    detail: firstMaterial?.title ?? text(locale, "operationsActionPreviewMaterialUnavailable"),
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
  onAction: (action: OperatorAction) => void;
  onDecision: (action: OperatorAction, decisionType: "skipped" | "dismissed") => void;
  questionCount: number;
  recentDecisions: OperatorActionDecision[];
}) {
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
        {actions.length ? (
          actions.map((action) => {
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
          })
        ) : (
          <p className="empty-state">{text(locale, "operatorNoActions")}</p>
        )}
      </div>
      {recentDecisions.length ? (
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
}: {
  bare?: boolean;
  caseData: CaseData | null;
  evidenceMap: EvidenceMap | null;
  findings: ReviewFinding[];
  locale: Locale;
  materialsById: Map<string, MaterialRecord>;
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
                  <em key={materialId}>{materialsById.get(materialId)?.title ?? materialId}</em>
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
    "decision",
    "decision_type",
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
      review_refreshed: "Odświeżono review",
      material_question_link_accepted: "Zaakceptowano link materiału",
      material_question_link_rejected: "Odrzucono link materiału",
      grounded_suggestions_generated: "Wygenerowano sugestie grounded",
      grounded_suggestion_accepted: "Zaakceptowano sugestię AI",
      grounded_suggestion_edited: "Edytowano sugestię AI",
      grounded_suggestion_rejected: "Odrzucono sugestię AI",
      operator_action_opened: "Otwarto akcję operatora",
      operator_action_skipped: "Pominięto akcję operatora",
      operator_action_dismissed: "Zamknięto akcję operatora",
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
      workspace: "workspace",
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
      case_id: "sprawa",
      context_hash: "context",
      decision: "decyzja",
      decision_type: "typ decyzji",
      finding_count: "ustalenia",
      indicator_count: "wskaźniki",
      material_id: "materiał",
      model_id: "model",
      output_hash: "output",
      participant_id: "osoba",
      prompt_hash: "prompt",
      prompt_version: "wersja promptu",
      question_id: "pytanie",
      session_id: "sesja",
      target_question_id: "cel pytania",
      target_tab: "zakładka",
    },
    en: {
      action_title: "action",
      artifact_warning: "artifacts",
      case_id: "case",
      context_hash: "context",
      decision: "decision",
      decision_type: "decision type",
      finding_count: "findings",
      indicator_count: "indicators",
      material_id: "material",
      model_id: "model",
      output_hash: "output",
      participant_id: "participant",
      prompt_hash: "prompt",
      prompt_version: "prompt version",
      question_id: "question",
      session_id: "session",
      target_question_id: "target question",
      target_tab: "tab",
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
  decisions,
  evidenceMap,
  links,
  locale,
  materials,
  questions,
  verifications,
}: {
  decisions: Record<string, MaterialQuestionLinkDecision>;
  evidenceMap: EvidenceMap | null;
  links: MaterialQuestionLink[];
  locale: Locale;
  materials: MaterialRecord[];
  questions: QuestionView[];
  verifications: Record<string, MaterialVerification>;
}): MaterialTask[] {
  const materialsById = new Map(materials.map((material) => [material.id, material]));
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
      detail: `${material?.title ?? pendingLink.material_id} -> ${
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
      detail: `${unverifiedMaterial.title} / ${shortHash(unverifiedMaterial.sha256)}`,
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
      detail: buildEvidenceTopicTaskDetail(materialOnlyTopic, materialsById),
      priority: "medium",
      materialId: materialOnlyTopic.material_ids[0],
      questionId: materialOnlyTopic.question_ids[0],
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
      detail: buildEvidenceTopicTaskDetail(contestedTopic, materialsById),
      priority: contestedTopic.priority === "high" ? "high" : "medium",
      materialId: contestedTopic.material_ids[0],
      questionId: contestedTopic.question_ids[0],
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
): string {
  const materialTitles = node.material_ids
    .slice(0, 2)
    .map((materialId) => materialsById.get(materialId)?.title ?? materialId)
    .join(", ");
  return materialTitles ? `${node.label}: ${materialTitles}` : node.label;
}

function buildOperatorActions({
  activeQuestionId,
  answerViews,
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
  const nextUnansweredQuestion = questions.find((question) => !answeredQuestionIds.has(question.id));
  if (nextUnansweredQuestion) {
    actions.push({
      id: `ask-${nextUnansweredQuestion.id}`,
      kind: "ask",
      title: text(locale, "operatorAskNext"),
      detail: `${nextUnansweredQuestion.id}: ${localize(nextUnansweredQuestion.text, locale)}`,
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
      .map((link) => materials.find((material) => material.id === link.material_id)?.title ?? link.material_id)
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
  onOpenCase,
}: {
  cases: CaseCatalogItem[];
  currentCaseId: string;
  locale: Locale;
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
                <CaseCatalogBadges caseId={caseItem.id} locale={locale} />
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
                  {topic.label}
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

type DemoChecklistItem = {
  id: string;
  label: string;
  done: boolean;
};

function DemoWalkthroughPanel({
  checklist,
  locale,
  onCopySummary,
  onOpenAi,
  onOpenMaterials,
  onOpenMonitor,
  onOpenNextQuestion,
  onOpenReview,
  onStartFresh,
}: {
  checklist: DemoChecklistItem[];
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
      label: text(locale, "demoStepQuestion"),
      detail: text(locale, "demoStepQuestionDetail"),
      onClick: onOpenNextQuestion,
    },
    {
      id: "local-ai",
      icon: <Network size={14} />,
      label: text(locale, "demoStepLocalAi"),
      detail: text(locale, "demoStepLocalAiDetail"),
      onClick: onOpenMonitor,
    },
    {
      id: "materials",
      icon: <FolderArchive size={14} />,
      label: text(locale, "demoStepMaterials"),
      detail: text(locale, "demoStepMaterialsDetail"),
      onClick: onOpenMaterials,
    },
    {
      id: "grounded-ai",
      icon: <Sparkles size={14} />,
      label: text(locale, "demoStepGroundedAi"),
      detail: text(locale, "demoStepGroundedAiDetail"),
      onClick: onOpenAi,
    },
    {
      id: "review",
      icon: <Fingerprint size={14} />,
      label: text(locale, "demoStepReview"),
      detail: text(locale, "demoStepReviewDetail"),
      onClick: onOpenReview,
    },
  ];

  const checklistDoneCount = checklist.filter((item) => item.done).length;

  return (
    <CollapsibleSection
      className="demo-walkthrough-panel"
      hint={text(locale, "expandWhenNeeded")}
      meta={`${checklistDoneCount}/${checklist.length} · ${text(locale, "demoReady")}`}
      title={text(locale, "demoWalkthrough")}
      tutorialId="demo-walkthrough"
    >
      <div className="demo-tool-row">
        <button type="button" onClick={onStartFresh} title={text(locale, "demoFreshStartDetail")}>
          <RefreshCw size={14} />
          {text(locale, "demoFreshStart")}
        </button>
        <button type="button" onClick={onCopySummary}>
          <ClipboardCopy size={14} />
          {text(locale, "demoCopySummary")}
        </button>
      </div>
      <div className="demo-checklist">
        <span>
          {text(locale, "demoChecklist")} ({checklistDoneCount}/{checklist.length})
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
      <div className="demo-step-list">
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

type DemoSummaryInput = {
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

function buildDemoSummaryText(input: DemoSummaryInput): string {
  const lines = [
    text(input.locale, "demoSummaryTitle"),
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
    `${text(input.locale, "operationsAi")}: ${input.groundedCount} grounded suggestions`,
    `${text(input.locale, "operatorDecisionTrail")}: ${input.operatorDecisionCount}`,
    `${text(input.locale, "workspaceAudit")}: ${input.workspaceAuditCount} events${
      input.workspaceAuditValid === null
        ? ""
        : ` (${input.workspaceAuditValid ? text(input.locale, "chainValid") : text(input.locale, "chainInvalid")})`
    }`,
    `${text(input.locale, "sessionAudit")}: ${input.sessionAuditCount} events`,
    "",
    text(input.locale, "demoSummaryBoundary"),
  ];

  return lines.filter((line) => line.length > 0).join("\n");
}

function LinkedMaterialStrip({
  links,
  locale,
  materialsById,
}: {
  links: MaterialQuestionLink[];
  locale: Locale;
  materialsById: Map<string, MaterialRecord>;
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
              {material?.title ?? link.material_id}
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
  tasks,
  onDecideLink,
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
  tasks: MaterialTask[];
  onDecideLink: (link: MaterialQuestionLink, decision: MaterialQuestionLinkDecision) => void;
  onDraftChange: (draft: MaterialDraft) => void;
  onOpenQuestion: (questionId: string) => void;
  onPreview: (materialId: string) => void;
  onSubmit: () => void;
  onVerify: (materialId: string) => void;
  previews: Record<string, MaterialPreview>;
  verifications: Record<string, MaterialVerification>;
}) {
  const disabled = apiMode !== "online" || isSubmitting;
  const acceptedLinkCount = Object.values(decisions).filter((decision) => decision === "accepted").length;
  const pendingLinkCount = Math.max(0, links.length - Object.keys(decisions).length);
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

      <MaterialTasksPanel
        locale={locale}
        tasks={tasks}
        onDecideLink={onDecideLink}
        onOpenQuestion={onOpenQuestion}
        onPreview={onPreview}
      />

      <div className="material-list">
        {materials.length ? (
          materials.map((material) => (
            <MaterialCard
              decisions={decisions}
              key={material.id}
              links={links.filter((link) => link.material_id === material.id)}
              locale={locale}
              material={material}
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
      <details className="material-add-panel">
        <summary>
          <Plus size={15} />
          <span>{text(locale, "addOwnMaterial")}</span>
          <em>{text(locale, "syntheticTextOnly")}</em>
        </summary>
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
      </details>
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
  onDecideLink,
  onOpenQuestion,
  onPreview,
}: {
  locale: Locale;
  tasks: MaterialTask[];
  onDecideLink: (link: MaterialQuestionLink, decision: MaterialQuestionLinkDecision) => void;
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
          {tasks.map((task) => (
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
                {task.questionId ? (
                  <button type="button" onClick={() => onOpenQuestion(task.questionId!)}>
                    <Send size={13} />
                    {text(locale, "materialTaskOpenQuestion")}
                  </button>
                ) : null}
                {task.materialId ? (
                  <button type="button" onClick={() => onPreview(task.materialId!)}>
                    <Eye size={13} />
                    {text(locale, "previewMaterial")}
                  </button>
                ) : null}
                {task.link ? (
                  <>
                    <button type="button" onClick={() => onDecideLink(task.link!, "accepted")}>
                      <Check size={13} />
                      {text(locale, "acceptLink")}
                    </button>
                    <button type="button" onClick={() => onDecideLink(task.link!, "rejected")}>
                      <X size={13} />
                      {text(locale, "rejectLink")}
                    </button>
                  </>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">{text(locale, "noMaterialTasks")}</p>
      )}
    </section>
  );
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

function MaterialCard({
  decisions,
  links,
  locale,
  material,
  onDecideLink,
  onPreview,
  onVerify,
  verification,
}: {
  decisions: Record<string, MaterialQuestionLinkDecision>;
  links: MaterialQuestionLink[];
  locale: Locale;
  material: MaterialRecord;
  onDecideLink: (link: MaterialQuestionLink, decision: MaterialQuestionLinkDecision) => void;
  onPreview: (materialId: string) => void;
  onVerify: (materialId: string) => void;
  verification: MaterialVerification | undefined;
}) {
  const state = materialVerificationState(verification);

  return (
    <article className="material-card" data-state={state}>
      <div className="material-card-header">
        <span className="security-icon">
          <FileText size={15} />
        </span>
        <div>
          <strong>{material.title}</strong>
          <span className="material-meta">
            {material.id} / {materialSourceLabel(material.source_type, locale)}
          </span>
        </div>
      </div>
      <div className="material-facts">
        <span>
          {text(locale, "size")}: <strong>{formatBytes(material.size_bytes)}</strong>
        </span>
        <span>
          {text(locale, "hash")}: <strong>{shortHash(material.sha256)}</strong>
        </span>
      </div>
      {material.description ? (
        <p className="material-description">{material.description}</p>
      ) : null}
      {material.tags.length ? (
        <div className="material-tags">
          {material.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}
      <MaterialQuestionChips
        decisions={decisions}
        links={links}
        locale={locale}
        onDecideLink={onDecideLink}
      />
      <div className="material-card-footer">
        <span className="material-verification">
          <ShieldQuestion size={14} />
          {materialVerificationLabel(verification, locale)}
        </span>
        <button type="button" onClick={() => onPreview(material.id)}>
          <Eye size={14} />
          {text(locale, "previewMaterial")}
        </button>
        <button type="button" onClick={() => onVerify(material.id)}>
          <CheckCircle2 size={14} />
          {text(locale, "verifyMaterial")}
        </button>
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
  locale,
  localModelConfig,
  localModelSmoke,
  modelArtifactManifest,
  modelArtifactIsolation,
  materials,
  onArtifactIsolation,
  onModelSmoke,
  workspace,
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
  locale: Locale;
  localModelConfig: LocalModelConfig | null;
  localModelSmoke: LocalModelSmokeResult | null;
  modelArtifactManifest: ModelArtifactManifest | null;
  modelArtifactIsolation: ModelArtifactIsolationStatus | null;
  materials: MaterialRecord[];
  onArtifactIsolation: () => void;
  onModelSmoke: (executeReal: boolean) => void;
  workspace: WorkspaceResponse | null;
}) {
  const manifest = workspace?.manifest;
  const encryptionReady = encryptionStatus?.available === true;
  const accessReady = accessDecision?.allowed === true;
  const workspaceState = manifest ? "ready" : "unknown";
  const storageState = !manifest
    ? "unknown"
    : manifest.storage_mode === "encrypted_required"
      ? "ready"
      : "warning";
  const encryptionState = encryptionStatus ? (encryptionReady ? "ready" : "warning") : "unknown";
  const accessState = accessDecision ? (accessReady ? "ready" : "blocked") : "unknown";
  const exportState = manifest ? "ready" : "unknown";
  const materialsState = manifest ? "ready" : "unknown";
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
  const modelDetail = localModelConfig
    ? localModelConfig.live_output_enabled
      ? text(locale, "liveModelEnabled")
      : text(locale, "liveModelBlocked")
    : text(locale, "unknown");

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
      </div>
      <AiRuntimeStatusCard
        auditedDecisionCount={auditedGroundedDecisionCount}
        cachedQuestionCount={cachedGroundedQuestionCount}
        locale={locale}
        localModelConfig={localModelConfig}
        localModelSmoke={localModelSmoke}
        visibleSuggestionCount={groundedSuggestionCount}
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
              localModelConfig.provider !== "ollama" ||
              !localModelConfig.real_model_enabled
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
              {text(locale, "lastArtifact")}: {lastRecord.artifact_type} / {shortHash(lastRecord.sha256)}
            </p>
          ) : null}
          {manifest ? (
            <p>
              {text(locale, "artifactChain")}:{" "}
              {manifest.chain_valid ? text(locale, "chainValid") : text(locale, "chainInvalid")}
              {manifest.latest_record_hash ? ` / ${shortHash(manifest.latest_record_hash)}` : ""}
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
              <span>{check.label}</span>
              <em>{environmentStateLabel(check.state, locale)}</em>
            </summary>
            <p>{check.detail}</p>
            {check.remediation ? <p>{check.remediation}</p> : null}
          </details>
        ))}
      </div>
    </div>
  );
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
    .map((topicId) => topicsById.get(topicId)?.label ?? topicId);

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
  question,
}: {
  answer: AnswerView;
  locale: Locale;
  question: QuestionView | undefined;
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
    </article>
  );
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
    const topic = typeof finding.metadata?.topic_label === "string" ? finding.metadata.topic_label : "";
    return `${text(locale, "missingTopicTitlePrefix")}: ${topic}`.trim();
  }
  if (finding.category === "question_neutrality") {
    return text(locale, "questionNeutralityTitle");
  }
  if (finding.category === "potential_inconsistency") {
    const attribute = typeof finding.metadata?.attribute === "string" ? finding.metadata.attribute : "";
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
