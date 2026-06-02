import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Database,
  FileCheck2,
  FileText,
  FolderArchive,
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
  ensureWorkspace,
  loadCaseReview,
  loadEncryptionStatus,
  loadEvidenceMap,
  loadGroundedSuggestions,
  loadMaterialQuestionLinks,
  loadSessionReview,
  loadWorkspaceAccess,
  loadWorkspaceMaterials,
  recordGroundedSuggestionDecision,
  registerWorkspaceMaterial,
  startSession,
  verifyWorkspaceMaterial,
  type ApiError,
} from "./api";
import { seedAnswers, seedFindings, seedIndicators, seedQuestions } from "./demoData";
import { domainLabel, localize, text, type CopyKey } from "./i18n";
import type {
  Answer,
  ApiMode,
  CaseData,
  EncryptionStatus,
  EvidenceMap,
  EvidenceTopicStatus,
  GroundedSuggestionDecision,
  GroundedSuggestion,
  GroundedSuggestionWarning,
  Indicator,
  InterviewSession,
  Locale,
  MaterialQuestionLink,
  MaterialRecord,
  MaterialSourceType,
  MaterialVerification,
  QuestionView,
  ReviewFinding,
  RuntimeConfig,
  WorkspaceAccessDecision,
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
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [findings, setFindings] = useState<ReviewFinding[]>([]);
  const [encryptionStatus, setEncryptionStatus] = useState<EncryptionStatus | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [workspaceAccess, setWorkspaceAccess] = useState<WorkspaceAccessDecision | null>(null);
  const [workspaceMaterials, setWorkspaceMaterials] = useState<MaterialRecord[]>([]);
  const [materialQuestionLinks, setMaterialQuestionLinks] = useState<MaterialQuestionLink[]>([]);
  const [evidenceMap, setEvidenceMap] = useState<EvidenceMap | null>(null);
  const [groundedSuggestions, setGroundedSuggestions] = useState<GroundedSuggestion[]>([]);
  const [groundedSuggestionWarnings, setGroundedSuggestionWarnings] = useState<GroundedSuggestionWarning[]>([]);
  const [groundedSuggestionMeta, setGroundedSuggestionMeta] = useState<{
    model: string;
    promptVersion: string;
    contextHash: string;
    outputHash: string;
  } | null>(null);
  const [suggestionDrafts, setSuggestionDrafts] = useState<Record<string, string>>({});
  const [suggestionDecisions, setSuggestionDecisions] = useState<Record<string, GroundedSuggestionDecision>>({});
  const [materialDraft, setMaterialDraft] = useState<MaterialDraft>(emptyMaterialDraft);
  const [materialVerifications, setMaterialVerifications] = useState<Record<string, MaterialVerification>>({});
  const [activeQuestionId, setActiveQuestionId] = useState("q-001");
  const [answerText, setAnswerText] = useState("");
  const [localAnswers, setLocalAnswers] = useState<Answer[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMaterialSubmitting, setIsMaterialSubmitting] = useState(false);
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
      const caseReview = await loadCaseReview(config, locale);
      setCaseData(caseReview.case);
      setIndicators(caseReview.indicators);
      setFindings(caseReview.review.findings);
      await refreshSecurityState();
      await startOrResumeSession(config);
      const sessionReview = await loadSessionReview(config, locale);
      setSession(sessionReview.session);
      setIndicators(sessionReview.indicators);
      setFindings(sessionReview.snapshot.review.findings);
      setApiMode("online");
      setStatusKey("online");
    } catch (error) {
      console.warn("Local API unavailable, using static demo data.", error);
      setApiMode("offline");
      setStatusKey("offline");
    }
  }

  async function refreshSecurityState() {
    try {
      const [security, ensuredWorkspace] = await Promise.all([
        loadEncryptionStatus(config),
        ensureWorkspace(config),
      ]);
      const [access, materialList, materialLinks, nextEvidenceMap, nextGroundedSuggestions] = await Promise.all([
        loadWorkspaceAccess(config),
        loadWorkspaceMaterials(config),
        loadMaterialQuestionLinksOrEmpty(locale),
        loadEvidenceMapOrNull(locale),
        loadGroundedSuggestionsOrEmpty(locale, activeQuestionId),
      ]);
      setEncryptionStatus(security);
      setWorkspace(ensuredWorkspace);
      setWorkspaceAccess(access);
      setWorkspaceMaterials(sortMaterials(materialList.materials));
      setMaterialQuestionLinks(materialLinks);
      setEvidenceMap(nextEvidenceMap);
      applyGroundedSuggestions(nextGroundedSuggestions);
    } catch (error) {
      console.warn("Could not refresh local workspace security state.", error);
      setEncryptionStatus(null);
      setWorkspace(null);
      setWorkspaceAccess(null);
      setWorkspaceMaterials([]);
      setMaterialQuestionLinks([]);
      setEvidenceMap(null);
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
      return response.evidence_map;
    } catch (error) {
      console.warn("Could not refresh evidence map.", error);
      return null;
    }
  }

  async function loadGroundedSuggestionsOrEmpty(
    nextLocale: Locale,
    questionId: string,
  ): Promise<{
    suggestions: GroundedSuggestion[];
    warnings: GroundedSuggestionWarning[];
    model: string;
    prompt_version: string;
    context_hash: string;
    output_hash: string;
  } | null> {
    try {
      return await loadGroundedSuggestions(config, nextLocale, questionId);
    } catch (error) {
      console.warn("Could not refresh grounded suggestions.", error);
      return null;
    }
  }

  function applyGroundedSuggestions(
    response: {
      suggestions: GroundedSuggestion[];
      warnings: GroundedSuggestionWarning[];
      model: string;
      prompt_version: string;
      context_hash: string;
      output_hash: string;
    } | null,
  ) {
    setGroundedSuggestions(response?.suggestions ?? []);
    setGroundedSuggestionWarnings(response?.warnings ?? []);
    setGroundedSuggestionMeta(
      response
        ? {
            model: response.model,
            promptVersion: response.prompt_version,
            contextHash: response.context_hash,
            outputHash: response.output_hash,
          }
        : null,
    );
    setSuggestionDrafts({});
    setSuggestionDecisions({});
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
        caseReview,
        sessionReview,
        materialLinks,
        nextEvidenceMap,
        nextGroundedSuggestions,
      ] = await Promise.all([
        loadCaseReview(config, nextLocale),
        loadSessionReview(config, nextLocale),
        loadMaterialQuestionLinksOrEmpty(nextLocale),
        loadEvidenceMapOrNull(nextLocale),
        loadGroundedSuggestionsOrEmpty(nextLocale, activeQuestionId),
      ]);
      setCaseData(caseReview.case);
      setSession(sessionReview.session);
      setIndicators(sessionReview.indicators);
      setFindings(sessionReview.snapshot.review.findings);
      setMaterialQuestionLinks(materialLinks);
      setEvidenceMap(nextEvidenceMap);
      applyGroundedSuggestions(nextGroundedSuggestions);
      setApiMode("online");
      setStatusKey("reviewUpdated");
    } catch (error) {
      console.warn("Could not refresh localized API state.", error);
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
      setFindings(sessionReview.snapshot.review.findings);
      setEvidenceMap(nextEvidenceMap);
      applyGroundedSuggestions(nextGroundedSuggestions);
      setAnswerText("");
      setStatusKey("reviewUpdated");
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

  function selectActiveQuestion(questionId: string) {
    setActiveQuestionId(questionId);
    if (apiMode === "online") {
      void loadGroundedSuggestionsOrEmpty(locale, questionId).then(applyGroundedSuggestions);
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
  }

  function changeLocale(nextLocale: Locale) {
    setLocale(nextLocale);
    void refreshLocalizedApiState(nextLocale);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">IA</div>
          <div>
            <h1>InterigA(I)tion</h1>
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
        <aside className="question-panel">
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
        </aside>

        <section className="interview-panel">
          <PanelHeader title={text(locale, "session")} meta={text(locale, "roleLine")} />
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
          <SecurityPanel
            accessDecision={workspaceAccess}
            encryptionStatus={encryptionStatus}
            locale={locale}
            materials={workspaceMaterials}
            workspace={workspace}
          />

          <EvidenceMapPanel evidenceMap={evidenceMap} locale={locale} />

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

          <MaterialsPanel
            apiMode={apiMode}
            draft={materialDraft}
            isSubmitting={isMaterialSubmitting}
            locale={locale}
            links={materialQuestionLinks}
            materials={workspaceMaterials}
            verifications={materialVerifications}
            onDraftChange={setMaterialDraft}
            onSubmit={() => void registerMaterial()}
            onVerify={(materialId) => void verifyMaterial(materialId)}
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
        </aside>
      </main>
    </div>
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
  locale,
}: {
  evidenceMap: EvidenceMap | null;
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
  meta: { model: string; promptVersion: string } | null;
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
        {suggestion.linked_evidence.map((sourceId) => (
          <em key={sourceId}>{sourceId}</em>
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
  apiMode,
  draft,
  isSubmitting,
  links,
  locale,
  materials,
  onDraftChange,
  onSubmit,
  onVerify,
  verifications,
}: {
  apiMode: ApiMode;
  draft: MaterialDraft;
  isSubmitting: boolean;
  links: MaterialQuestionLink[];
  locale: Locale;
  materials: MaterialRecord[];
  onDraftChange: (draft: MaterialDraft) => void;
  onSubmit: () => void;
  onVerify: (materialId: string) => void;
  verifications: Record<string, MaterialVerification>;
}) {
  const disabled = apiMode !== "online" || isSubmitting;

  return (
    <section>
      <PanelHeader
        title={text(locale, "materialRegister")}
        meta={`${materials.length} ${text(locale, "registered")}`}
        compact
      />
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
        <span className="material-mode">{text(locale, "syntheticTextOnly")}</span>
      </form>

      <div className="material-list">
        {materials.length ? (
          materials.map((material) => (
            <MaterialCard
              key={material.id}
              links={links.filter((link) => link.material_id === material.id)}
              locale={locale}
              material={material}
              onVerify={onVerify}
              verification={verifications[material.id]}
            />
          ))
        ) : (
          <p className="empty-state">{text(locale, "noMaterials")}</p>
        )}
      </div>
    </section>
  );
}

function MaterialCard({
  links,
  locale,
  material,
  onVerify,
  verification,
}: {
  links: MaterialQuestionLink[];
  locale: Locale;
  material: MaterialRecord;
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
      {material.tags.length ? (
        <div className="material-tags">
          {material.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}
      <MaterialQuestionChips links={links} locale={locale} />
      <div className="material-card-footer">
        <span className="material-verification">
          <ShieldQuestion size={14} />
          {materialVerificationLabel(verification, locale)}
        </span>
        <button type="button" onClick={() => onVerify(material.id)}>
          <CheckCircle2 size={14} />
          {text(locale, "verifyMaterial")}
        </button>
      </div>
    </article>
  );
}

function MaterialQuestionChips({
  links,
  locale,
}: {
  links: MaterialQuestionLink[];
  locale: Locale;
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
        {links.map((link) => (
          <span key={`${link.material_id}-${link.question_id}`}>
            {link.question_id}
            <em>
              {text(locale, "confidenceShort")} {link.confidence.toFixed(2)}
            </em>
          </span>
        ))}
      </div>
    </div>
  );
}

function SecurityPanel({
  accessDecision,
  encryptionStatus,
  locale,
  materials,
  workspace,
}: {
  accessDecision: WorkspaceAccessDecision | null;
  encryptionStatus: EncryptionStatus | null;
  locale: Locale;
  materials: MaterialRecord[];
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

  return (
    <section>
      <PanelHeader
        title={text(locale, "security")}
        meta={manifest?.status ?? text(locale, "unknown")}
        compact
      />
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
    </section>
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
    return `Niepokryty temat: ${topic}`.trim();
  }
  if (finding.category === "question_neutrality") {
    return "Pytanie może wymagać neutralizacji";
  }
  if (finding.category === "potential_inconsistency") {
    const attribute = typeof finding.metadata?.attribute === "string" ? finding.metadata.attribute : "";
    return `Potencjalna niespójność: ${attribute}`.trim();
  }

  return finding.title;
}

function findingDetail(finding: ReviewFinding, locale: Locale): string {
  if (locale === "en") {
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
