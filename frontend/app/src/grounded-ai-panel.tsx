import { useMemo } from "react";
import { AlertTriangle, Check, Loader2, Pencil, RefreshCw, ShieldCheck, Sparkles, X } from "lucide-react";
import { text, type CopyKey } from "./i18n";
import type {
  ApiMode,
  GroundedSuggestion,
  GroundedSuggestionDecision,
  GroundedSuggestionQualityReport,
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
} | null;

function shortHash(value: string): string {
  return value.length > 12 ? `${value.slice(0, 12)}...` : value;
}

function shortArtifact(artifact: ModelArtifactSummary): string {
  return `${artifact.artifact_id} / ${shortHash(artifact.sha256)}`;
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

  const providerLabel = groundedAiProviderLabel(localModelConfig, locale);
  const canRegenerate = apiMode === "online" && !isLoading;

  const toolbar = (
    <div className="grounded-ai-toolbar">
      <span className="grounded-ai-provider-badge" data-provider={localModelConfig?.effective_provider ?? "unknown"}>
        {providerLabel}
      </span>
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
        <div className="grounded-ai-meta">
          <span>
            {text(locale, "modelLabel")}: {meta.model}
          </span>
          <span>
            {text(locale, "promptVersion")}: {meta.promptVersion}
          </span>
          {meta.promptArtifact ? (
            <span>
              {text(locale, "promptArtifact")}: {shortArtifact(meta.promptArtifact)}
            </span>
          ) : null}
          {meta.contextArtifact ? (
            <span>
              {text(locale, "contextArtifact")}: {shortArtifact(meta.contextArtifact)}
            </span>
          ) : null}
          {meta.outputArtifact ? (
            <span>
              {text(locale, "outputArtifact")}: {shortArtifact(meta.outputArtifact)}
            </span>
          ) : null}
          {meta.artifactWarning ? (
            <span>
              {text(locale, "artifactWarning")}: {meta.artifactWarning}
            </span>
          ) : null}
        </div>
      ) : null}
      {meta?.qualityReport ? <GroundedAiQualityPanel locale={locale} report={meta.qualityReport} /> : null}
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
      <div className="grounded-ai-quality-summary">
        <span>{text(locale, "ready")}: {report.summary.ready ?? 0}</span>
        <span>{text(locale, "warning")}: {report.warning_count}</span>
        <span>{text(locale, "blocked")}: {report.error_count}</span>
      </div>
      {visibleIssues.length ? (
        <div className="grounded-ai-quality-issues">
          <span>{text(locale, "aiQualityIssues")}</span>
          {visibleIssues.map((issue, index) => (
            <article data-severity={issue.severity} key={`${issue.suggestion_id}-${issue.code}-${index}`}>
              <strong>{issue.code}</strong>
              <p>{issue.detail}</p>
            </article>
          ))}
        </div>
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
        {decision ? <span className="meta">{groundedSuggestionDecisionLabel(decision, locale)}</span> : null}
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
