import { CheckCircle2, Circle, CircleDot } from "lucide-react";
import { text, type CopyKey } from "./i18n";
import type { Locale } from "./types";
import { caseCatalogMeta } from "./utils";

export type CaseWorkflowStage = "dossier" | "interview" | "materials" | "ai" | "review" | "report";

type WorkflowStep = {
  id: CaseWorkflowStage;
  label: string;
  done: boolean;
  active: boolean;
};

export function CaseWorkflowProgress({
  answerCount,
  apiMode,
  groundedCount,
  locale,
  materialCount,
  onNavigate,
  reportExported,
  reviewVisited,
}: {
  answerCount: number;
  apiMode: "connecting" | "offline" | "online";
  groundedCount: number;
  locale: Locale;
  materialCount: number;
  onNavigate: (stage: CaseWorkflowStage) => void;
  reportExported: boolean;
  reviewVisited: boolean;
}) {
  const steps: WorkflowStep[] = [
    {
      id: "dossier",
      label: text(locale, "workflowDossier"),
      done: true,
      active: answerCount === 0 && materialCount === 0,
    },
    {
      id: "interview",
      label: text(locale, "workflowInterview"),
      done: answerCount > 0,
      active: answerCount === 0,
    },
    {
      id: "materials",
      label: text(locale, "workflowMaterials"),
      done: materialCount > 0,
      active: answerCount > 0 && materialCount === 0,
    },
    {
      id: "ai",
      label: text(locale, "workflowAi"),
      done: groundedCount > 0,
      active: materialCount > 0 && groundedCount === 0,
    },
    {
      id: "review",
      label: text(locale, "workflowReview"),
      done: reviewVisited,
      active: groundedCount > 0 && !reviewVisited,
    },
    {
      id: "report",
      label: text(locale, "workflowReport"),
      done: reportExported,
      active: reviewVisited && !reportExported,
    },
  ];

  const doneCount = steps.filter((step) => step.done).length;

  return (
    <div className="case-workflow-progress" data-tutorial="case-workflow">
      <div className="case-workflow-header">
        <strong>{text(locale, "workflowProgress")}</strong>
        <span>
          {doneCount}/{steps.length}
        </span>
      </div>
      {apiMode === "offline" ? (
        <p className="case-workflow-offline">{text(locale, "workflowOfflineHint")}</p>
      ) : null}
      <ol className="case-workflow-steps">
        {steps.map((step, index) => (
          <li key={step.id}>
            <button
              className={`case-workflow-step ${step.done ? "is-done" : ""} ${step.active ? "is-active" : ""}`}
              type="button"
              onClick={() => onNavigate(step.id)}
            >
              <span className="case-workflow-step-icon" aria-hidden>
                {step.done ? <CheckCircle2 size={14} /> : step.active ? <CircleDot size={14} /> : <Circle size={14} />}
              </span>
              <span className="case-workflow-step-copy">
                <strong>{step.label}</strong>
                <em>{workflowStepHint(step.id, step.done, locale)}</em>
              </span>
            </button>
            {index < steps.length - 1 ? <span className="case-workflow-connector" aria-hidden /> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function workflowStepHint(stage: CaseWorkflowStage, done: boolean, locale: Locale): string {
  if (done) {
    return text(locale, "workflowStepDone");
  }

  const hints: Record<CaseWorkflowStage, CopyKey> = {
    dossier: "workflowHintDossier",
    interview: "workflowHintInterview",
    materials: "workflowHintMaterials",
    ai: "workflowHintAi",
    review: "workflowHintReview",
    report: "workflowHintReport",
  };

  return text(locale, hints[stage]);
}

export function CaseCatalogBadges({ caseId, locale }: { caseId: string; locale: Locale }) {
  const meta = caseCatalogMeta(caseId, locale);

  return (
    <span className="case-catalog-badges">
      <span className="case-catalog-badge">{meta.scenarioLabel}</span>
      {meta.recommendedDefaultCase ? (
        <span className="case-catalog-badge case-catalog-badge--default">{text(locale, "recommendedDefaultCaseBadge")}</span>
      ) : null}
    </span>
  );
}

export function WorkspaceEmptyState({
  detail,
  locale,
  title,
}: {
  detail?: string;
  locale: Locale;
  title: string;
}) {
  return (
    <div className="workspace-empty-state" role="status">
      <strong>{title}</strong>
      {detail ? <p>{detail}</p> : null}
      <p>{text(locale, "workspaceEmptyBoundary")}</p>
    </div>
  );
}
