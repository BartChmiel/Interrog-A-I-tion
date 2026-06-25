import { text } from "./i18n";
import type { Locale } from "./types";
import { caseCatalogMeta } from "./utils";

export function CaseCatalogBadges({
  caseId,
  locale,
  source,
}: {
  caseId: string;
  locale: Locale;
  source?: string;
}) {
  const meta = caseCatalogMeta(caseId, locale);

  return (
    <span className="case-catalog-badges">
      <span className="case-catalog-badge">
        {source === "local" ? text(locale, "localCaseBadge") : meta.scenarioLabel}
      </span>
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
