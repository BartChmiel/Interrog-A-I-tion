import { Activity, Sparkles } from "lucide-react";
import { groundedAiProviderLabel } from "./grounded-ai-panel";
import { text } from "./i18n";
import type { Locale, LocalModelConfig, LocalModelSmokeResult } from "./types";

export function AiRuntimeStatusCard({
  auditedDecisionCount,
  cachedQuestionCount,
  locale,
  localModelConfig,
  localModelSmoke,
  visibleSuggestionCount,
}: {
  auditedDecisionCount: number;
  cachedQuestionCount: number;
  locale: Locale;
  localModelConfig: LocalModelConfig | null;
  localModelSmoke: LocalModelSmokeResult | null;
  visibleSuggestionCount: number;
}) {
  const providerLabel = groundedAiProviderLabel(localModelConfig, locale);
  const liveReady =
    localModelConfig?.live_output_enabled === true &&
    localModelConfig.real_model_enabled &&
    localModelConfig.effective_provider === "ollama";

  return (
    <div className="ai-runtime-status-card" data-live={liveReady ? "true" : "false"}>
      <div className="model-runtime-header">
        <span className="security-icon">
          <Sparkles size={15} />
        </span>
        <div>
          <span className="security-label">{text(locale, "aiRuntimeStatus")}</span>
          <strong>{providerLabel}</strong>
          <span className="security-detail">
            {visibleSuggestionCount} {text(locale, "groundingSuggestionsShort")} / {cachedQuestionCount}{" "}
            {text(locale, "groundingCachedQuestions")} / {auditedDecisionCount}{" "}
            {text(locale, "auditedAiDecisionsShort")}
          </span>
        </div>
      </div>
      {localModelSmoke ? (
        <p className="ai-runtime-smoke-line">
          <Activity size={14} />
          {localModelSmoke.ok ? text(locale, "modelSmokeOk") : text(locale, "modelSmokeFailed")}
          {" · "}
          {localModelSmoke.model}
          {" · "}
          {localModelSmoke.real_model_invoked ? text(locale, "realModelInvoked") : text(locale, "noRealModel")}
        </p>
      ) : (
        <p className="ai-runtime-smoke-line">{text(locale, "aiRuntimeSmokeHint")}</p>
      )}
    </div>
  );
}
