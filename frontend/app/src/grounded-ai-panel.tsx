import { useMemo } from "react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  FileText,
  Fingerprint,
  Gauge,
  Loader2,
  Network,
  Pencil,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { text, type CopyKey } from "./i18n";
import { ActionMenu, ContextWindow, SummaryPillRow, type UiAction } from "./ui-patterns";
import type {
  ApiMode,
  GroundedSuggestion,
  GroundedSuggestionDecision,
  GroundedSuggestionQualityReport,
  GroundedSuggestionSupportRecord,
  GroundedSuggestionSupportReport,
  GroundedSuggestionTriageRecord,
  GroundedSuggestionTriageReport,
  GroundedSuggestionWarning,
  Locale,
  LocalModelConfig,
  ModelArtifactSummary,
} from "./types";
export type GroundedSuggestionMeta = {
  model: string;
  promptVersion: string;
  promptArtifact: ModelArtifactSummary | null;
  contextArtifact: ModelArtifactSummary | null;
  outputArtifact: ModelArtifactSummary | null;
  artifactWarning: string | null;
  qualityReport: GroundedSuggestionQualityReport | null;
  supportReport: GroundedSuggestionSupportReport | null;
  triageReport: GroundedSuggestionTriageReport | null;
} | null;

function shortHash(value: string): string {
  return value.length > 12 ? `${value.slice(0, 12)}...` : value;
}

function shortArtifact(artifact: ModelArtifactSummary): string {
  return `${artifact.artifact_id} / ${shortHash(artifact.sha256)}`;
}

function formatConfidence(value: number | null): string {
  return value === null ? "-" : value.toFixed(2);
}

function confidenceLabel(value: number | null, locale: Locale): string {
  if (value === null) {
    return text(locale, "unknown");
  }
  const band =
    value >= 0.8
      ? text(locale, "confidenceHigh")
      : value >= 0.55
        ? text(locale, "confidenceMedium")
        : text(locale, "confidenceLow");
  return `${band} ${formatConfidence(value)}`;
}

function formatSuggestionTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString(undefined, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  });
}

function triagePriorityLabel(priority: GroundedSuggestionTriageRecord["priority"], locale: Locale): string {
  const labels: Record<Locale, Record<GroundedSuggestionTriageRecord["priority"], string>> = {
    pl: {
      high: "wysoki",
      low: "niski",
      medium: "średni",
    },
    en: {
      high: "high",
      low: "low",
      medium: "medium",
    },
  };
  return labels[locale][priority];
}

function triageActionLabel(action: string, locale: Locale): string {
  const labels: Record<Locale, Record<string, string>> = {
    pl: {
      ask_now: "zadaj teraz",
      edit_before_use: "popraw przed użyciem",
      queue_for_later: "odłóż na później",
      reject_or_regenerate: "odrzuć albo wygeneruj ponownie",
      review_sources: "sprawdź źródła",
    },
    en: {
      ask_now: "ask now",
      edit_before_use: "edit before use",
      queue_for_later: "queue for later",
      reject_or_regenerate: "reject or regenerate",
      review_sources: "review sources",
    },
  };
  return labels[locale][action] ?? action.replace(/_/g, " ");
}

function suggestionTypeLabel(type: string, locale: Locale): string {
  const labels: Record<Locale, Record<string, string>> = {
    pl: {
      follow_up_question: "pytanie doprecyzowujące",
      gap: "luka",
      interview_plan: "plan rozmowy",
      neutrality_rewrite: "neutralna redakcja",
      potential_inconsistency: "możliwa niespójność",
      summary: "podsumowanie",
    },
    en: {
      follow_up_question: "follow-up question",
      gap: "gap",
      interview_plan: "interview plan",
      neutrality_rewrite: "neutrality rewrite",
      potential_inconsistency: "potential inconsistency",
      summary: "summary",
    },
  };
  return labels[locale][type] ?? type.replace(/_/g, " ");
}

function sourceTypeLabel(type: string, locale: Locale): string {
  const labels: Record<Locale, Record<string, string>> = {
    pl: {
      answer: "odpowiedź",
      claim: "twierdzenie",
      finding: "ustalenie",
      indicator: "wskaźnik",
      material: "materiał",
      question: "pytanie",
      unknown: "źródło",
    },
    en: {
      answer: "answer",
      claim: "claim",
      finding: "finding",
      indicator: "indicator",
      material: "material",
      question: "question",
      unknown: "source",
    },
  };
  return labels[locale][type] ?? type.replace(/_/g, " ");
}

function supportStateLabel(state: GroundedSuggestionSupportRecord["support_state"], locale: Locale): string {
  const labels: Record<Locale, Record<GroundedSuggestionSupportRecord["support_state"], string>> = {
    pl: {
      missing: "brak źródeł",
      partial: "częściowe źródła",
      supported: "źródła OK",
    },
    en: {
      missing: "missing sources",
      partial: "partial sources",
      supported: "sources OK",
    },
  };
  return labels[locale][state];
}

function supportTone(state: GroundedSuggestionSupportRecord["support_state"]): "default" | "ok" | "warning" | "danger" {
  if (state === "supported") {
    return "ok";
  }
  if (state === "partial") {
    return "warning";
  }
  return "danger";
}

function triageTone(record: GroundedSuggestionTriageRecord): "default" | "ok" | "warning" | "danger" {
  if (record.risk_level === "blocked") {
    return "danger";
  }
  if (record.risk_level === "high" || record.recommended_action !== "ask_now") {
    return "warning";
  }
  if (record.priority === "high") {
    return "ok";
  }
  return "default";
}

export function groundedSuggestionDecisionLabel(
  decision: GroundedSuggestionDecision,
  locale: Locale,
): string {
  const keys: Record<GroundedSuggestionDecision, CopyKey> = {
    accepted: "usedSuggestion",
    edited: "editedSuggestion",
    rejected: "rejectedSuggestion",
  };
  return text(locale, keys[decision]);
}

export function groundedAiProviderLabel(
  localModelConfig: LocalModelConfig | null,
  locale: Locale,
): string {
  if (!localModelConfig) {
    return text(locale, "localOnly");
  }
  if (
    localModelConfig.live_output_enabled &&
    localModelConfig.real_model_enabled &&
    localModelConfig.effective_provider === "ollama"
  ) {
    return `${text(locale, "groundedAiProviderLive")}: ${localModelConfig.configured_model}`;
  }
  if (
    localModelConfig.live_output_enabled &&
    localModelConfig.real_model_enabled &&
    localModelConfig.effective_provider === "bridge"
  ) {
    return `${text(locale, "groundedAiProviderBridge")}: ${localModelConfig.configured_model}`;
  }
  return text(locale, "groundedAiProviderDeterministic");
}

export function formatGroundedAiError(error: unknown, locale: Locale): string {
  const status = (error as { status?: number }).status;
  if (status === 502) {
    return text(locale, "groundedAiModelUnavailable");
  }
  if (status === 503) {
    return text(locale, "groundedAiOffline");
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return text(locale, "groundedAiFailed");
}

export function GroundedSuggestionsPanel({
  apiMode,
  bare = false,
  decisions,
  drafts,
  error,
  isLoading,
  locale,
  localModelConfig,
  meta,
  suggestions,
  warnings,
  onDraftChange,
  onEdit,
  onRegenerate,
  onReject,
  onSaveEdit,
  onUse,
}: {
  apiMode: ApiMode;
  bare?: boolean;
  decisions: Record<string, GroundedSuggestionDecision>;
  drafts: Record<string, string>;
  error: string | null;
  isLoading: boolean;
  locale: Locale;
  localModelConfig: LocalModelConfig | null;
  meta: GroundedSuggestionMeta;
  suggestions: GroundedSuggestion[];
  warnings: GroundedSuggestionWarning[];
  onDraftChange: (suggestionId: string, value: string) => void;
  onEdit: (suggestion: GroundedSuggestion) => void;
  onRegenerate: () => void;
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
  const supportBySuggestion = useMemo(() => {
    return new Map((meta?.supportReport?.records ?? []).map((record) => [record.suggestion_id, record]));
  }, [meta?.supportReport?.records]);

  const providerLabel = groundedAiProviderLabel(localModelConfig, locale);
  const canRegenerate = apiMode === "online" && !isLoading;

  const toolbar = (
    <div className="grounded-ai-toolbar">
      <div className="grounded-ai-toolbar-main">
        <span className="grounded-ai-provider-badge" data-provider={localModelConfig?.effective_provider ?? "unknown"}>
          {providerLabel}
        </span>
        <SummaryPillRow
          items={[
            {
              icon: <Sparkles size={13} />,
              key: "suggestions",
              label: text(locale, "groundingSuggestionsShort"),
              value: String(suggestions.length),
            },
            {
              icon: <ShieldCheck size={13} />,
              key: "decisions",
              label: text(locale, "auditedAiDecisionsShort"),
              value: String(Object.keys(decisions).length),
            },
            {
              icon: <AlertTriangle size={13} />,
              key: "warnings",
              label: text(locale, "warning"),
              tone: warnings.length ? "warning" : "ok",
              value: String(warnings.length),
            },
            ...(meta?.supportReport
              ? [
                  {
                    icon: <BookOpen size={13} />,
                    key: "support",
                    label: text(locale, "sourceIds"),
                    tone:
                      meta.supportReport.state === "ready"
                        ? "ok"
                        : meta.supportReport.state === "warning"
                          ? "warning"
                          : "danger",
                    value: String(meta.supportReport.summary.supported ?? 0),
                  } as const,
                ]
              : []),
          ]}
        />
      </div>
      <button disabled={!canRegenerate} type="button" onClick={onRegenerate}>
        {isLoading ? <Loader2 className="spin" size={14} /> : <RefreshCw size={14} />}
        {isLoading ? text(locale, "groundedAiGenerating") : text(locale, "regenerateGroundedAi")}
      </button>
    </div>
  );

  const body = (
    <div className="grounded-suggestion-list">
      {toolbar}
      {error ? (
        <p className="grounded-ai-error" role="alert">
          <AlertTriangle size={14} />
          {error}
        </p>
      ) : null}
      {meta ? (
        <ContextWindow
          className="auditor-only"
          icon={<Fingerprint size={14} />}
          meta={`${meta.model} / ${meta.promptVersion}`}
          title={text(locale, "materialTechnicalDetails")}
        >
          <div className="grounded-ai-technical-stack">
            <div className="grounded-ai-meta">
              <span>
                {text(locale, "modelLabel")}: <strong>{meta.model}</strong>
              </span>
              <span>
                {text(locale, "promptVersion")}: <strong>{meta.promptVersion}</strong>
              </span>
              {meta.promptArtifact ? (
                <span>
                  {text(locale, "promptArtifact")}: <strong>{shortArtifact(meta.promptArtifact)}</strong>
                </span>
              ) : null}
              {meta.contextArtifact ? (
                <span>
                  {text(locale, "contextArtifact")}: <strong>{shortArtifact(meta.contextArtifact)}</strong>
                </span>
              ) : null}
              {meta.outputArtifact ? (
                <span>
                  {text(locale, "outputArtifact")}: <strong>{shortArtifact(meta.outputArtifact)}</strong>
                </span>
              ) : null}
              {meta.artifactWarning ? (
                <span>
                  {text(locale, "artifactWarning")}: <strong>{meta.artifactWarning}</strong>
                </span>
              ) : null}
            </div>
            {meta.triageReport ? (
              <GroundedAiTriagePanel locale={locale} report={meta.triageReport} suggestions={suggestions} />
            ) : null}
            {meta.qualityReport ? <GroundedAiQualityPanel locale={locale} report={meta.qualityReport} /> : null}
          </div>
        </ContextWindow>
      ) : null}
      {isLoading && !suggestions.length ? (
        <p className="empty-state grounded-ai-loading">
          <Loader2 className="spin" size={16} />
          {text(locale, "groundedAiGenerating")}
        </p>
      ) : suggestions.length ? (
        suggestions.map((suggestion) => (
          <GroundedSuggestionCard
            decision={decisions[suggestion.id]}
            draft={drafts[suggestion.id]}
            key={suggestion.id}
            locale={locale}
            suggestion={suggestion}
            support={supportBySuggestion.get(suggestion.id)}
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
  );

  if (bare) {
    return <div className="grounded-suggestions-panel is-bare">{body}</div>;
  }

  return (
    <section>
      <div className="panel-header compact">
        <h2>{text(locale, "groundedAi")}</h2>
        <span>{meta?.model ?? providerLabel}</span>
      </div>
      {body}
    </section>
  );
}

function GroundedAiTriagePanel({
  locale,
  report,
  suggestions,
}: {
  locale: Locale;
  report: GroundedSuggestionTriageReport;
  suggestions: GroundedSuggestion[];
}) {
  const topRecords = report.records.slice(0, 3);
  const topRecord = report.records.find((record) => record.suggestion_id === report.top_suggestion_id) ?? report.records[0];
  const suggestionsById = new Map(suggestions.map((suggestion) => [suggestion.id, suggestion]));
  const suggestionLabel = (suggestionId: string) => {
    const suggestion = suggestionsById.get(suggestionId);
    return suggestion ? suggestion.text : suggestionId;
  };
  return (
    <section className="grounded-ai-triage" data-state={report.state}>
      <div className="grounded-ai-quality-header">
        <span>
          <Gauge size={14} />
          {text(locale, "aiTriage")}
        </span>
        <strong>{topRecord ? `${topRecord.priority_score}` : "-"}</strong>
      </div>
      <SummaryPillRow
        items={[
          {
            icon: <AlertTriangle size={13} />,
            key: "high",
            label: text(locale, "aiTriageHigh"),
            tone: (report.summary.high ?? 0) ? "warning" : "default",
            value: String(report.summary.high ?? 0),
          },
          {
            icon: <ShieldAlert size={13} />,
            key: "needs-review",
            label: text(locale, "aiTriageNeedsReview"),
            tone: (report.summary.needs_review ?? 0) ? "warning" : "ok",
            value: String(report.summary.needs_review ?? 0),
          },
          {
            icon: <Check size={13} />,
            key: "top",
            label: text(locale, "aiTriageTop"),
            tone: topRecord ? triageTone(topRecord) : "default",
            value: topRecord ? String(topRecord.priority_score) : "-",
          },
        ]}
      />
      {topRecord ? (
        <p>
          <strong>{triageActionLabel(topRecord.recommended_action, locale)}</strong>
          {" · "}
          {triagePriorityLabel(topRecord.priority, locale)} · {topRecord.rationale}
        </p>
      ) : (
        <p>{text(locale, "aiTriageNoRecords")}</p>
      )}
      {topRecords.length ? (
        <ContextWindow
          icon={<Network size={14} />}
          meta={`${topRecords.length}/${report.records.length}`}
          title={text(locale, "aiTriageQueue")}
        >
          <div className="grounded-ai-triage-list">
            {topRecords.map((record) => (
              <article data-tone={triageTone(record)} key={record.suggestion_id}>
                <div>
                  <strong>{suggestionLabel(record.suggestion_id)}</strong>
                  <span>
                    {triagePriorityLabel(record.priority, locale)} / {triageActionLabel(record.recommended_action, locale)}
                  </span>
                </div>
                <p>{record.rationale}</p>
                {record.topic_labels.length ? (
                  <div className="grounded-token-list">
                    {record.topic_labels.map((label) => (
                      <em key={`${record.suggestion_id}-${label}`}>{label}</em>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </ContextWindow>
      ) : null}
    </section>
  );
}

function GroundedAiQualityPanel({
  locale,
  report,
}: {
  locale: Locale;
  report: GroundedSuggestionQualityReport;
}) {
  const visibleIssues = report.issues.slice(0, 4);
  return (
    <section className="grounded-ai-quality" data-state={report.state}>
      <div className="grounded-ai-quality-header">
        <span>
          <ShieldCheck size={14} />
          {text(locale, "aiQualityGate")}
        </span>
        <strong>{report.score}%</strong>
      </div>
      <SummaryPillRow
        items={[
          {
            icon: <Check size={13} />,
            key: "ready",
            label: text(locale, "ready"),
            tone: "ok",
            value: String(report.summary.ready ?? 0),
          },
          {
            icon: <AlertTriangle size={13} />,
            key: "warnings",
            label: text(locale, "warning"),
            tone: report.warning_count ? "warning" : "default",
            value: String(report.warning_count),
          },
          {
            icon: <ShieldAlert size={13} />,
            key: "blocked",
            label: text(locale, "blocked"),
            tone: report.error_count ? "danger" : "default",
            value: String(report.error_count),
          },
        ]}
      />
      {visibleIssues.length ? (
        <ContextWindow
          icon={<ShieldAlert size={14} />}
          meta={`${visibleIssues.length}/${report.issues.length}`}
          title={text(locale, "aiQualityIssues")}
        >
          <div className="grounded-ai-quality-issues">
            {visibleIssues.map((issue, index) => (
              <article data-severity={issue.severity} key={`${issue.suggestion_id}-${issue.code}-${index}`}>
                <strong>{issue.code}</strong>
                <p>{issue.detail}</p>
              </article>
            ))}
          </div>
        </ContextWindow>
      ) : (
        <p>{text(locale, "aiQualityNoIssues")}</p>
      )}
    </section>
  );
}

function GroundedSuggestionCard({
  decision,
  draft,
  locale,
  suggestion,
  support,
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
  support?: GroundedSuggestionSupportRecord;
  warnings: GroundedSuggestionWarning[];
  onDraftChange: (suggestionId: string, value: string) => void;
  onEdit: (suggestion: GroundedSuggestion) => void;
  onReject: (suggestion: GroundedSuggestion) => void;
  onSaveEdit: (suggestion: GroundedSuggestion) => void;
  onUse: (suggestion: GroundedSuggestion) => void;
}) {
  const visibleText = draft ?? suggestion.text;
  const decisionLabel = decision ? groundedSuggestionDecisionLabel(decision, locale) : text(locale, "reportSuggestionPending");
  const confidenceTone = suggestion.confidence === null
    ? "default"
    : suggestion.confidence >= 0.8
      ? "ok"
      : suggestion.confidence >= 0.55
        ? "warning"
        : "danger";
  const primaryAction: UiAction = draft !== undefined
    ? {
        icon: <Check size={14} />,
        key: "save",
        label: text(locale, "saveEditSuggestion"),
        onClick: () => onSaveEdit(suggestion),
      }
    : {
        icon: <Check size={14} />,
        key: "use",
        label: text(locale, "useSuggestion"),
        onClick: () => onUse(suggestion),
      };
  const secondaryActions: UiAction[] = draft !== undefined
    ? [
        {
          icon: <Check size={14} />,
          key: "use",
          label: text(locale, "useSuggestion"),
          onClick: () => onUse(suggestion),
        },
        {
          icon: <X size={14} />,
          key: "reject",
          label: text(locale, "rejectSuggestion"),
          onClick: () => onReject(suggestion),
        },
      ]
    : [
        {
          icon: <Pencil size={14} />,
          key: "edit",
          label: text(locale, "editSuggestion"),
          onClick: () => onEdit(suggestion),
        },
        {
          icon: <X size={14} />,
          key: "reject",
          label: text(locale, "rejectSuggestion"),
          onClick: () => onReject(suggestion),
        },
      ];

  return (
    <article className="grounded-suggestion-card" data-state={decision ?? "proposed"}>
      <div className="grounded-suggestion-header">
        <span className="grounded-suggestion-type">
          <Sparkles size={13} />
          {suggestionTypeLabel(suggestion.suggestion_type, locale)}
        </span>
        <span className="grounded-suggestion-decision">{decisionLabel}</span>
      </div>
      {draft !== undefined ? (
        <textarea
          rows={3}
          value={visibleText}
          onChange={(event) => onDraftChange(suggestion.id, event.target.value)}
        />
      ) : (
        <strong className="grounded-suggestion-title">{visibleText}</strong>
      )}

      <SummaryPillRow
        items={[
          {
            icon: <Gauge size={13} />,
            key: "confidence",
            label: text(locale, "suggestionConfidence"),
            tone: confidenceTone,
            value: confidenceLabel(suggestion.confidence, locale),
          },
          {
            icon: <BookOpen size={13} />,
            key: "evidence",
            label: support ? supportStateLabel(support.support_state, locale) : text(locale, "sourceIds"),
            tone: support ? supportTone(support.support_state) : "default",
            value: String(support?.known_source_count ?? suggestion.linked_evidence.length),
          },
          {
            icon: <Network size={13} />,
            key: "topics",
            label: text(locale, "suggestionTopics"),
            value: String(suggestion.linked_topics.length),
          },
          {
            icon: <AlertTriangle size={13} />,
            key: "warnings",
            label: text(locale, "warning"),
            tone: warnings.length ? "warning" : "default",
            value: String(warnings.length),
          },
        ]}
      />

      <ContextWindow
        icon={<FileText size={14} />}
        meta={text(locale, "expandWhenNeeded")}
        title={text(locale, "suggestionContext")}
      >
        <div className="grounded-suggestion-context">
          <span>{text(locale, "suggestionReason")}</span>
          <p>{suggestion.reason}</p>
          {draft === undefined ? (
            <>
              <span>{text(locale, "reportGroundedQuestion")}</span>
              <p>{visibleText}</p>
            </>
          ) : null}
        </div>
      </ContextWindow>

      <ContextWindow
        icon={<Fingerprint size={14} />}
        meta={`${suggestion.linked_evidence.length} / ${suggestion.linked_topics.length}`}
        title={text(locale, "suggestionEvidenceContext")}
      >
        <div className="grounded-suggestion-context-grid">
          <div>
            <span>{text(locale, "sourceIds")}</span>
            {support?.source_cards.length ? (
              <div className="grounded-source-card-list">
                {support.source_cards.map((source) => (
                  <article key={`${suggestion.id}-${source.source_id}`}>
                    <span>{sourceTypeLabel(source.source_type, locale)}</span>
                    <strong>{source.label}</strong>
                    <p>{source.detail}</p>
                    <em className="auditor-only-inline">{source.source_id}</em>
                  </article>
                ))}
              </div>
            ) : suggestion.linked_evidence.length ? (
              <div className="grounded-token-list">
                {suggestion.linked_evidence.map((sourceId, index) => (
                  <em key={`${sourceId}-${index}`}>{sourceId}</em>
                ))}
              </div>
            ) : (
              <p>{text(locale, "noLinkedEvidence")}</p>
            )}
            {support?.unknown_source_ids.length ? (
              <div className="grounded-warning-list">
                <span>{text(locale, "unknownSources")}</span>
                <article>
                  <AlertTriangle size={14} />
                  <div>
                    <strong>{support.unknown_source_ids.join(", ")}</strong>
                    <p>{text(locale, "unknownSourcesDetail")}</p>
                  </div>
                </article>
              </div>
            ) : null}
          </div>
          <div>
            <span>{text(locale, "suggestionTopics")}</span>
            {suggestion.linked_topics.length ? (
              <div className="grounded-token-list">
                {suggestion.linked_topics.map((topicId) => (
                  <em key={topicId}>{topicId}</em>
                ))}
              </div>
            ) : (
              <p>{text(locale, "noLinkedTopics")}</p>
            )}
          </div>
          <div>
            <span>{text(locale, "suggestionRisks")}</span>
            {suggestion.risk_flags.length ? (
              <div className="grounded-token-list">
                {suggestion.risk_flags.map((risk) => (
                  <em key={risk}>{risk}</em>
                ))}
              </div>
            ) : (
              <p>{text(locale, "noRiskFlags")}</p>
            )}
          </div>
          <div>
            <span>{text(locale, "suggestionStatus")}</span>
            <p>
              {suggestion.status} / {formatSuggestionTime(suggestion.created_at)}
            </p>
          </div>
          {warnings.length ? (
            <div className="grounded-warning-list">
              <span>{text(locale, "citationsWarning")}</span>
              {warnings.map((warning, index) => (
                <article key={`${warning.warning_type}-${index}`}>
                  <AlertTriangle size={14} />
                  <div>
                    <strong>{warning.warning_type}</strong>
                    <p>{warning.detail}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </ContextWindow>

      <ActionMenu
        moreLabel={text(locale, "moreActions")}
        primaryAction={primaryAction}
        secondaryActions={secondaryActions}
      />
    </article>
  );
}
