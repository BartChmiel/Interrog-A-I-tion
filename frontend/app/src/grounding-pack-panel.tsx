import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, BookOpen, GitCompare, Loader2, RefreshCw } from "lucide-react";
import { loadGroundingPack } from "./api";
import { evidenceStatusLabel } from "./evidence-labels";
import {
  diffGroundingPacks,
  groundingPackDiffHasChanges,
  groundingTopicDiffState,
  type GroundingPackDiff,
} from "./grounding-pack-diff";
import { text } from "./i18n";
import type { ApiMode, GroundingContextPack, Locale, QuestionView, RuntimeConfig } from "./types";

function renderDiffList(label: string, values: string[]) {
  if (!values.length) {
    return null;
  }

  return (
    <div className="grounding-pack-diff-group">
      <strong>{label}</strong>
      <ul>
        {values.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ul>
    </div>
  );
}

function GroundingPackDiffPanel({
  diff,
  locale,
}: {
  diff: GroundingPackDiff;
  locale: Locale;
}) {
  if (!groundingPackDiffHasChanges(diff)) {
    return <p className="empty-state">{text(locale, "groundingPackNoDiff")}</p>;
  }

  return (
    <div className="grounding-pack-diff">
      <div className="grounding-pack-diff-header">
        <GitCompare size={14} />
        <strong>
          {text(locale, "groundingPackDiff")}: {diff.compareQuestionId ?? "—"}
        </strong>
        {diff.focusChanged ? <em>{text(locale, "groundingFocusChanged")}</em> : null}
      </div>
      {renderDiffList(text(locale, "groundingAddedSources"), diff.addedSourceIds)}
      {renderDiffList(text(locale, "groundingRemovedSources"), diff.removedSourceIds)}
      {renderDiffList(text(locale, "groundingAddedTopics"), diff.addedTopicIds)}
      {renderDiffList(text(locale, "groundingRemovedTopics"), diff.removedTopicIds)}
      {renderDiffList(text(locale, "groundingAddedMaterials"), diff.addedMaterialIds)}
      {renderDiffList(text(locale, "groundingRemovedMaterials"), diff.removedMaterialIds)}
    </div>
  );
}

export function GroundingPackPanel({
  activeQuestionId,
  apiMode,
  config,
  locale,
  questions,
}: {
  activeQuestionId: string;
  apiMode: ApiMode;
  config: RuntimeConfig;
  locale: Locale;
  questions: QuestionView[];
}) {
  const [pack, setPack] = useState<GroundingContextPack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [compareQuestionId, setCompareQuestionId] = useState<string | null>(null);
  const packsByQuestionRef = useRef<Record<string, GroundingContextPack>>({});
  const lastQuestionRef = useRef(activeQuestionId);

  async function refresh() {
    if (apiMode !== "online") {
      setPack(null);
      setError(text(locale, "groundedAiOffline"));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await loadGroundingPack(config, locale, activeQuestionId);
      setPack(response.grounding_pack);
      packsByQuestionRef.current[activeQuestionId] = response.grounding_pack;
    } catch (loadError) {
      console.warn("Could not load grounding pack.", loadError);
      setPack(null);
      setError(loadError instanceof Error ? loadError.message : text(locale, "groundingPackFailed"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (lastQuestionRef.current !== activeQuestionId) {
      setCompareQuestionId(lastQuestionRef.current);
      lastQuestionRef.current = activeQuestionId;
    }
    void refresh();
  }, [activeQuestionId, apiMode, config.apiBaseUrl, config.caseId, config.sessionId, config.workspaceId, locale]);

  const comparePack = compareQuestionId ? packsByQuestionRef.current[compareQuestionId] ?? null : null;
  const diff = useMemo(
    () => (pack ? diffGroundingPacks(comparePack, pack, compareQuestionId) : null),
    [comparePack, compareQuestionId, pack],
  );
  const compareOptions = useMemo(
    () => questions.filter((question) => question.id !== activeQuestionId && packsByQuestionRef.current[question.id]),
    [activeQuestionId, pack, questions],
  );
  const focusTopicCount = pack?.topic_contexts.filter((topic) => topic.in_focus).length ?? 0;

  return (
    <div className="grounding-pack-panel">
      <div className="grounding-pack-toolbar">
        <span className="grounding-pack-summary">
          <BookOpen size={14} />
          {pack
            ? `${pack.allowed_source_ids.length} ${text(locale, "groundingAllowedSources")} / ${pack.topic_contexts.length} ${text(locale, "groundingTopics")}`
            : text(locale, "groundingPackUnavailable")}
        </span>
        <button disabled={apiMode !== "online" || isLoading} type="button" onClick={() => void refresh()}>
          {isLoading ? <Loader2 className="spin" size={14} /> : <RefreshCw size={14} />}
          {text(locale, "refreshGroundingPack")}
        </button>
      </div>

      {compareOptions.length ? (
        <label className="grounding-pack-compare">
          <span>{text(locale, "groundingCompareWith")}</span>
          <select value={compareQuestionId ?? ""} onChange={(event) => setCompareQuestionId(event.target.value || null)}>
            <option value="">{text(locale, "groundingCompareNone")}</option>
            {compareOptions.map((question) => (
              <option key={question.id} value={question.id}>
                {question.id}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {error ? (
        <p className="grounding-pack-error" role="alert">
          <AlertTriangle size={14} />
          {error}
        </p>
      ) : null}

      {isLoading && !pack ? (
        <p className="empty-state grounded-ai-loading">
          <Loader2 className="spin" size={16} />
          {text(locale, "groundingPackLoading")}
        </p>
      ) : null}

      {diff ? <GroundingPackDiffPanel diff={diff} locale={locale} /> : null}

      {pack ? (
        <>
          <div className="grounding-pack-meta">
            <span>
              {text(locale, "groundingFocusQuestion")}: {pack.focus_question_id ?? "—"}
            </span>
            <span>
              {text(locale, "groundingFocusTopics")}: {focusTopicCount}
            </span>
            <span>
              {text(locale, "groundingMaterials")}: {pack.material_references.length}
            </span>
            <span>
              {text(locale, "groundingRules")}: {pack.rules.length}
            </span>
          </div>

          <div className="grounding-pack-topics">
            <strong>{text(locale, "groundingTopicContexts")}</strong>
            {pack.topic_contexts.length ? (
              <ul>
                {pack.topic_contexts.map((topic) => (
                  <li
                    data-diff={groundingTopicDiffState(topic.topic_id, diff)}
                    data-in-focus={topic.in_focus ? "true" : "false"}
                    key={topic.topic_id}
                  >
                    <span className="grounding-topic-label">{topic.label}</span>
                    <span className="meta">{evidenceStatusLabel(topic.status, locale)}</span>
                    {topic.in_focus ? <em>{text(locale, "groundingInFocus")}</em> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">{text(locale, "noGroundingTopics")}</p>
            )}
          </div>

          {pack.material_references.length ? (
            <div className="grounding-pack-materials">
              <strong>{text(locale, "groundingMaterialRefs")}</strong>
              <ul>
                {pack.material_references.map((material) => (
                  <li key={material.material_id}>
                    <span>{material.title}</span>
                    <span className="meta">
                      {material.material_id} / {material.max_confidence.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <details className="grounding-pack-json">
            <summary>{text(locale, "groundingPackJson")}</summary>
            <pre>{JSON.stringify(pack, null, 2)}</pre>
          </details>
        </>
      ) : null}
    </div>
  );
}
