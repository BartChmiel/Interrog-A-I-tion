import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Database,
  Eye,
  FileCheck2,
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
  formatCount,
  runtimeConfig,
  scorePercent,
  toAnswerView,
  toQuestionView,
} from "./utils";

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

type StopReadinessGate = {
  id: string;
  label: string;
  detail: string;
  state: EnvironmentHealthState;
  icon: ReactNode;
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

  const visibleIndicators = indicators.length ? indicators : seedIndicators;
  const visibleFindings = findings.length ? findings : seedFindings;
  const operatorActions = useMemo(
    () =>
      buildOperatorActions({
        activeQuestionId: activeQuestion?.id,
        answerViews,
        evidenceMap,
        findings: visibleFindings,
        links: materialQuestionLinks,
        locale,
        materials: workspaceMaterials,
        questions,
      }),
    [
      activeQuestion?.id,
      answerViews,
      evidenceMap,
      materialQuestionLinks,
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
      setApiMode("online");
      setStatusKey("online");
    } catch (error) {
      console.warn("Local API unavailable, using static demo data.", error);
      setCaseCatalog(seedCaseCatalog[locale]);
      setCaseStarterMaterials([]);
      setReview(null);
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

  async function smokeLocalModel() {
    if (apiMode !== "online") {
      setStatusKey("offline");
      return;
    }

    setIsModelSmokeRunning(true);
    try {
      const result = await runLocalModelSmoke(config);
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
    if (apiMode === "online") {
      void loadGroundedSuggestionsOrEmpty(locale, questionId).then((response) => {
        applyGroundedSuggestions(response);
        void refreshAuditTrails();
      });
    }
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

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <img className="brand-mark" src="/brand/logo-mark.svg" alt="InterrogA(I)tion" width={44} height={44} />
          <div>
            <h1>InterrogA(I)tion</h1>
            <p>{caseData?.title ?? text(locale, "caseFallback")}</p>
          </div>
        </div>

        <div className="topbar-actions">
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

      <main className="workspace">
        <aside className="case-sidebar">
          <CaseCatalogPanel
            cases={caseCatalog}
            currentCaseId={config.caseId}
            locale={locale}
            onOpenCase={openCase}
          />
          <CaseDossierPanel
            answerCount={answerViews.length}
            caseData={caseData}
            locale={locale}
            review={review}
            starterMaterials={caseStarterMaterials}
            onOpenMaterials={() => setActiveOperationsTab("materials")}
          />
          <section className="question-panel">
            <PanelHeader
              title={text(locale, "questions")}
              meta={formatCount(questions.length, locale, {
                singular: text(locale, "questionSingular"),
                pluralFew: text(locale, "questionPluralFew"),
                pluralMany: text(locale, "questionPluralMany"),
              })}
            />
            <div className="question-list">
              {questions.map((question) => (
                <button
                  className={`question-item ${question.id === activeQuestionId ? "is-active" : ""}`}
                  key={question.id}
                  type="button"
                  onClick={() => selectActiveQuestion(question.id)}
                >
                  <span className="question-type">{localize(question.type, locale)}</span>
                  <strong>{localize(question.text, locale)}</strong>
                  <span className="meta">{question.id}</span>
                  {question.risk ? (
                    <span className="risk-tag">{localize(question.risk, locale)}</span>
                  ) : null}
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="interview-panel">
          <PanelHeader title={text(locale, "session")} meta={text(locale, "roleLine")} />
          <OperatorWorkflowPanel
            actions={visibleOperatorActions}
            answeredCount={new Set(answerViews.map((answer) => answer.questionId)).size}
            findingCount={visibleFindings.length}
            locale={locale}
            materialCount={workspaceMaterials.length}
            questionCount={questions.length}
            recentDecisions={operatorActionDecisions.slice(0, 4)}
            onAction={runOperatorAction}
            onDecision={markOperatorAction}
          />
          <section className="active-question">
            <strong>{text(locale, "activeQuestion")}</strong>
            <p>{localize(activeQuestion?.text, locale)}</p>
            <LinkedMaterialStrip
              links={activeQuestionLinks}
              locale={locale}
              materialsById={materialsById}
            />
          </section>

          <section className="answer-stream">
            {answerViews.length ? (
              answerViews.map((answer) => (
                <article className="answer-card" key={answer.id}>
                  <strong>
                    {text(locale, "answer")} {answer.id}
                  </strong>
                  <span className="meta">{answer.time}</span>
                  <p>{localize(answer.text, locale)}</p>
                </article>
              ))
            ) : (
              <p className="empty-state">{text(locale, "noAnswers")}</p>
            )}
          </section>

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
        </section>

        <aside className="insight-panel">
          <div className="operations-rail-toolbar">
            <div className="operations-rail-header">
              <div>
                <span>{text(locale, "operationsRail")}</span>
                <strong>{text(locale, "noAutomatedVerdict")}</strong>
              </div>
              <span className="meta">{apiMode === "online" ? text(locale, "online") : text(locale, statusKey)}</span>
            </div>
            <div className="operations-tabs" role="tablist" aria-label={text(locale, "operationsRail")}>
              {operationsTabs.map((tab) => (
                <button
                  aria-selected={activeOperationsTab === tab.id}
                  className={activeOperationsTab === tab.id ? "is-active" : ""}
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
            {activeOperationsTab === "monitor" ? (
              <>
                <SecurityPanel
                  accessDecision={workspaceAccess}
                  encryptionStatus={encryptionStatus}
                  environmentHealth={environmentHealth}
                  isArtifactIsolationSubmitting={isArtifactIsolationSubmitting}
                  isModelSmokeRunning={isModelSmokeRunning}
                  locale={locale}
                  localModelConfig={localModelConfig}
                  localModelSmoke={localModelSmoke}
                  modelArtifactManifest={modelArtifactManifest}
                  modelArtifactIsolation={modelArtifactIsolation}
                  materials={workspaceMaterials}
                  onArtifactIsolation={() => void initializeModelArtifactIsolation()}
                  onModelSmoke={() => void smokeLocalModel()}
                  workspace={workspace}
                />
                <EvidenceMapPanel
                  evidenceMap={evidenceMap}
                  alignment={evidenceAlignment}
                  locale={locale}
                />
              </>
            ) : null}

            {activeOperationsTab === "ai" ? (
              <>
                <GroundedSuggestionsPanel
                  decisions={suggestionDecisions}
                  drafts={suggestionDrafts}
                  locale={locale}
                  meta={groundedSuggestionMeta}
                  suggestions={groundedSuggestions}
                  warnings={groundedSuggestionWarnings}
                  onDraftChange={(suggestionId, value) =>
                    setSuggestionDrafts((current) => ({ ...current, [suggestionId]: value }))
                  }
                  onEdit={startEditingSuggestion}
                  onReject={rejectSuggestion}
                  onSaveEdit={saveEditedSuggestion}
                  onUse={useSuggestion}
                />
                <section>
                  <PanelHeader title={text(locale, "assistant")} meta={text(locale, "localOnly")} compact />
                  <div className="suggestion-list">
                    <SuggestionCard
                      title={text(locale, "clarifyTime")}
                      detail={text(locale, "clarifyTimeDetail")}
                    />
                    <SuggestionCard
                      title={text(locale, "checkRecording")}
                      detail={text(locale, "checkRecordingDetail")}
                    />
                  </div>
                </section>
              </>
            ) : null}

            {activeOperationsTab === "materials" ? (
              <MaterialsPanel
                apiMode={apiMode}
                decisions={materialQuestionLinkDecisions}
                draft={materialDraft}
                isSubmitting={isMaterialSubmitting}
                locale={locale}
                links={materialQuestionLinks}
                materials={workspaceMaterials}
                activePreviewId={activeMaterialPreviewId}
                previews={materialPreviews}
                verifications={materialVerifications}
                onDecideLink={(link, decision) => void decideMaterialQuestionLink(link, decision)}
                onDraftChange={setMaterialDraft}
                onPreview={(materialId) => void toggleMaterialPreview(materialId)}
                onSubmit={() => void registerMaterial()}
                onVerify={(materialId) => void verifyMaterial(materialId)}
              />
            ) : null}

            {activeOperationsTab === "review" ? (
              <>
                <StopReadinessPanel
                  encryptionStatus={encryptionStatus}
                  locale={locale}
                  localModelConfig={localModelConfig}
                  modelArtifactManifest={modelArtifactManifest}
                  sessionAudit={sessionAudit}
                  workspace={workspace}
                  workspaceAudit={workspaceAudit}
                />
                <ProvenanceTimelinePanel
                  locale={locale}
                  sessionAudit={sessionAudit}
                  workspaceAudit={workspaceAudit}
                />
                <section>
                  <PanelHeader title={text(locale, "indicators")} meta={text(locale, "visible")} compact />
                  <div className="indicator-list">
                    {visibleIndicators.map((indicator) => (
                      <IndicatorCard indicator={indicator} key={indicator.id} locale={locale} />
                    ))}
                  </div>
                </section>
                <section>
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
              </>
            ) : null}
          </div>
        </aside>
      </main>
    </div>
  );
}

function OperatorWorkflowPanel({
  actions,
  answeredCount,
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
  findingCount: number;
  locale: Locale;
  materialCount: number;
  onAction: (action: OperatorAction) => void;
  onDecision: (action: OperatorAction, decisionType: "skipped" | "dismissed") => void;
  questionCount: number;
  recentDecisions: OperatorActionDecision[];
}) {
  return (
    <section className="operator-workflow">
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
  encryptionStatus,
  locale,
  localModelConfig,
  modelArtifactManifest,
  sessionAudit,
  workspace,
  workspaceAudit,
}: {
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

  return (
    <section className="stop-readiness-panel">
      <PanelHeader
        title={text(locale, "stopReadiness")}
        meta={`${readyCount}/${gates.length} ${text(locale, "ready")}`}
        compact
      />
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
    </section>
  );
}

function ProvenanceTimelinePanel({
  locale,
  sessionAudit,
  workspaceAudit,
}: {
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

  return (
    <section className="provenance-panel">
      <PanelHeader
        title={text(locale, "provenanceTimeline")}
        meta={`${totalEvents} ${text(locale, "auditEvents")}`}
        compact
      />
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

function buildOperatorActions({
  activeQuestionId,
  answerViews,
  evidenceMap,
  findings,
  links,
  locale,
  materials,
  questions,
}: {
  activeQuestionId: string | undefined;
  answerViews: AnswerView[];
  evidenceMap: EvidenceMap | null;
  findings: ReviewFinding[];
  links: MaterialQuestionLink[];
  locale: Locale;
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

  if (evidenceMap?.summary.material_only_topics) {
    actions.push({
      id: "material-only-topics",
      kind: "materials",
      title: text(locale, "operatorTurnMaterialIntoQuestion"),
      detail: `${evidenceMap.summary.material_only_topics} ${text(locale, "statusMaterialOnly")}`,
      priority: "medium",
      targetTab: "materials",
      sourceObjectIds: evidenceMap.topic_nodes
        .filter((node) => node.status === "material_only")
        .flatMap((node) => [node.topic_id, ...node.material_ids]),
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
    <section className="case-catalog-panel">
      <PanelHeader
        title={text(locale, "caseCatalog")}
        meta={formatCount(cases.length, locale, {
          singular: text(locale, "caseSingular"),
          pluralFew: text(locale, "casePluralFew"),
          pluralMany: text(locale, "casePluralMany"),
        })}
      />
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
    </section>
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

  return (
    <section className="case-dossier-panel">
      <PanelHeader title={text(locale, "caseDossier")} meta={caseData.id} />
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
    </section>
  );
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
  evidenceMap,
  alignment,
  locale,
}: {
  evidenceMap: EvidenceMap | null;
  alignment: EvidenceAlignment | null;
  locale: Locale;
}) {
  if (!evidenceMap) {
    return (
      <section>
        <PanelHeader title={text(locale, "caseMap")} meta={text(locale, "unknown")} compact />
        <p className="evidence-map-empty">{text(locale, "noEvidenceMap")}</p>
      </section>
    );
  }

  const summary = evidenceMap.summary;

  return (
    <section>
      <PanelHeader
        title={text(locale, "caseMap")}
        meta={`${summary.covered_topics}/${summary.total_topics} ${text(locale, "topicsShort")}`}
        compact
      />
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

function evidenceStatusLabel(status: EvidenceTopicStatus, locale: Locale): string {
  const keys: Record<EvidenceTopicStatus, CopyKey> = {
    covered: "statusCovered",
    grounded: "statusGrounded",
    material_only: "statusMaterialOnly",
    contested: "statusContested",
    missing: "statusMissing",
  };

  return text(locale, keys[status]);
}

function GroundedSuggestionsPanel({
  decisions,
  drafts,
  locale,
  meta,
  suggestions,
  warnings,
  onDraftChange,
  onEdit,
  onReject,
  onSaveEdit,
  onUse,
}: {
  decisions: Record<string, GroundedSuggestionDecision>;
  drafts: Record<string, string>;
  locale: Locale;
  meta: {
    model: string;
    promptVersion: string;
    promptArtifact: ModelArtifactSummary | null;
    contextArtifact: ModelArtifactSummary | null;
    outputArtifact: ModelArtifactSummary | null;
    artifactWarning: string | null;
  } | null;
  suggestions: GroundedSuggestion[];
  warnings: GroundedSuggestionWarning[];
  onDraftChange: (suggestionId: string, value: string) => void;
  onEdit: (suggestion: GroundedSuggestion) => void;
  onReject: (suggestion: GroundedSuggestion) => void;
  onSaveEdit: (suggestion: GroundedSuggestion) => void;
  onUse: (suggestion: GroundedSuggestion) => void;
}) {
  const warningsBySuggestion = useMemo(() => {
    const grouped = new Map<string, GroundedSuggestionWarning[]>();
    for (const warning of warnings) {
      grouped.set(warning.suggestion_id, [...(grouped.get(warning.suggestion_id) ?? []), warning]);
    }
    return grouped;
  }, [warnings]);

  return (
    <section>
      <PanelHeader
        title={text(locale, "groundedAi")}
        meta={meta?.model ?? text(locale, "localOnly")}
        compact
      />
      <div className="grounded-suggestion-list">
        {meta ? (
          <div className="grounded-ai-meta">
            <span>{text(locale, "modelLabel")}: {meta.model}</span>
            <span>{text(locale, "promptVersion")}: {meta.promptVersion}</span>
            {meta.promptArtifact ? (
              <span>{text(locale, "promptArtifact")}: {shortArtifact(meta.promptArtifact)}</span>
            ) : null}
            {meta.contextArtifact ? (
              <span>{text(locale, "contextArtifact")}: {shortArtifact(meta.contextArtifact)}</span>
            ) : null}
            {meta.outputArtifact ? (
              <span>{text(locale, "outputArtifact")}: {shortArtifact(meta.outputArtifact)}</span>
            ) : null}
            {meta.artifactWarning ? (
              <span>{text(locale, "artifactWarning")}: {meta.artifactWarning}</span>
            ) : null}
          </div>
        ) : null}
        {suggestions.length ? (
          suggestions.map((suggestion) => (
            <GroundedSuggestionCard
              decision={decisions[suggestion.id]}
              draft={drafts[suggestion.id]}
              key={suggestion.id}
              locale={locale}
              suggestion={suggestion}
              warnings={warningsBySuggestion.get(suggestion.id) ?? []}
              onDraftChange={onDraftChange}
              onEdit={onEdit}
              onReject={onReject}
              onSaveEdit={onSaveEdit}
              onUse={onUse}
            />
          ))
        ) : (
          <p className="empty-state">{text(locale, "noGroundedSuggestions")}</p>
        )}
      </div>
    </section>
  );
}

function GroundedSuggestionCard({
  decision,
  draft,
  locale,
  suggestion,
  warnings,
  onDraftChange,
  onEdit,
  onReject,
  onSaveEdit,
  onUse,
}: {
  decision?: GroundedSuggestionDecision;
  draft?: string;
  locale: Locale;
  suggestion: GroundedSuggestion;
  warnings: GroundedSuggestionWarning[];
  onDraftChange: (suggestionId: string, value: string) => void;
  onEdit: (suggestion: GroundedSuggestion) => void;
  onReject: (suggestion: GroundedSuggestion) => void;
  onSaveEdit: (suggestion: GroundedSuggestion) => void;
  onUse: (suggestion: GroundedSuggestion) => void;
}) {
  const visibleText = draft ?? suggestion.text;

  return (
    <article className="grounded-suggestion-card" data-state={decision ?? "proposed"}>
      <div className="grounded-suggestion-header">
        <span className="grounded-suggestion-type">
          <Sparkles size={13} />
          {suggestion.suggestion_type}
        </span>
        {decision ? <span className="meta">{suggestionDecisionLabel(decision, locale)}</span> : null}
      </div>
      {draft !== undefined ? (
        <textarea
          rows={3}
          value={visibleText}
          onChange={(event) => onDraftChange(suggestion.id, event.target.value)}
        />
      ) : (
        <strong>{visibleText}</strong>
      )}
      <p>{suggestion.reason}</p>
      <div className="grounded-source-list">
        <span>{text(locale, "sourceIds")}</span>
        {suggestion.linked_evidence.map((sourceId, index) => (
          <em key={`${sourceId}-${index}`}>{sourceId}</em>
        ))}
      </div>
      {warnings.length ? (
        <div className="grounded-warning">
          <AlertTriangle size={14} />
          <span>{text(locale, "citationsWarning")}</span>
        </div>
      ) : null}
      <div className="grounded-suggestion-actions">
        <button type="button" onClick={() => onUse(suggestion)}>
          <Check size={14} />
          {text(locale, "useSuggestion")}
        </button>
        {draft !== undefined ? (
          <button type="button" onClick={() => onSaveEdit(suggestion)}>
            <Check size={14} />
            {text(locale, "saveEditSuggestion")}
          </button>
        ) : (
          <button type="button" onClick={() => onEdit(suggestion)}>
            <Pencil size={14} />
            {text(locale, "editSuggestion")}
          </button>
        )}
        <button type="button" onClick={() => onReject(suggestion)}>
          <X size={14} />
          {text(locale, "rejectSuggestion")}
        </button>
      </div>
    </article>
  );
}

function suggestionDecisionLabel(decision: GroundedSuggestionDecision, locale: Locale): string {
  const keys: Record<GroundedSuggestionDecision, CopyKey> = {
    accepted: "usedSuggestion",
    edited: "editedSuggestion",
    rejected: "rejectedSuggestion",
  };
  return text(locale, keys[decision]);
}

function MaterialsPanel({
  activePreviewId,
  apiMode,
  decisions,
  draft,
  isSubmitting,
  links,
  locale,
  materials,
  onDecideLink,
  onDraftChange,
  onPreview,
  onSubmit,
  onVerify,
  previews,
  verifications,
}: {
  activePreviewId: string | null;
  apiMode: ApiMode;
  decisions: Record<string, MaterialQuestionLinkDecision>;
  draft: MaterialDraft;
  isSubmitting: boolean;
  links: MaterialQuestionLink[];
  locale: Locale;
  materials: MaterialRecord[];
  onDecideLink: (link: MaterialQuestionLink, decision: MaterialQuestionLinkDecision) => void;
  onDraftChange: (draft: MaterialDraft) => void;
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

  return (
    <section>
      <PanelHeader
        title={text(locale, "materialRegister")}
        meta={`${materials.length} ${text(locale, "registered")}`}
        compact
      />
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

      <div className="material-list">
        {materials.length ? (
          materials.map((material) => (
            <MaterialCard
              decisions={decisions}
              key={material.id}
              links={links.filter((link) => link.material_id === material.id)}
              locale={locale}
              material={material}
              preview={previews[material.id]}
              previewOpen={activePreviewId === material.id}
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
    </section>
  );
}

function MaterialCard({
  decisions,
  links,
  locale,
  material,
  preview,
  previewOpen,
  onDecideLink,
  onPreview,
  onVerify,
  verification,
}: {
  decisions: Record<string, MaterialQuestionLinkDecision>;
  links: MaterialQuestionLink[];
  locale: Locale;
  material: MaterialRecord;
  preview: MaterialPreview | undefined;
  previewOpen: boolean;
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
      {previewOpen ? (
        <MaterialPreviewPanel locale={locale} preview={preview} />
      ) : null}
      <div className="material-card-footer">
        <span className="material-verification">
          <ShieldQuestion size={14} />
          {materialVerificationLabel(verification, locale)}
        </span>
        <button type="button" onClick={() => onPreview(material.id)}>
          <Eye size={14} />
          {previewOpen ? text(locale, "hidePreview") : text(locale, "previewMaterial")}
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
  encryptionStatus,
  environmentHealth,
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
  encryptionStatus: EncryptionStatus | null;
  environmentHealth: EnvironmentHealth | null;
  isArtifactIsolationSubmitting: boolean;
  isModelSmokeRunning: boolean;
  locale: Locale;
  localModelConfig: LocalModelConfig | null;
  localModelSmoke: LocalModelSmokeResult | null;
  modelArtifactManifest: ModelArtifactManifest | null;
  modelArtifactIsolation: ModelArtifactIsolationStatus | null;
  materials: MaterialRecord[];
  onArtifactIsolation: () => void;
  onModelSmoke: () => void;
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

  return (
    <section>
      <PanelHeader
        title={text(locale, "security")}
        meta={manifest?.status ?? text(locale, "unknown")}
        compact
      />
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
        <button disabled={!localModelConfig || isModelSmokeRunning} type="button" onClick={onModelSmoke}>
          <Activity size={14} />
          {isModelSmokeRunning ? "..." : text(locale, "runModelSmoke")}
        </button>
      </div>
      <ModelArtifactIsolationPanel
        isSubmitting={isArtifactIsolationSubmitting}
        manifest={modelArtifactManifest}
        isolation={modelArtifactIsolation}
        locale={locale}
        onInitialize={onArtifactIsolation}
      />
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

function shortArtifact(artifact: ModelArtifactSummary): string {
  return `${artifact.artifact_id} / ${shortHash(artifact.sha256)}`;
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
