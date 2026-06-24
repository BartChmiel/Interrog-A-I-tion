import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";

export type UiAction = {
  disabled?: boolean;
  icon?: ReactNode;
  key: string;
  label: string;
  onClick: () => void;
};

export type SummaryPillItem = {
  icon?: ReactNode;
  key: string;
  label: string;
  tone?: "default" | "ok" | "warning" | "danger";
  value?: string;
};

export function ActionMenu({
  moreLabel,
  primaryAction,
  secondaryActions,
}: {
  moreLabel: string;
  primaryAction: UiAction | null;
  secondaryActions: UiAction[];
}) {
  if (!primaryAction && !secondaryActions.length) {
    return null;
  }

  return (
    <div className="ui-action-menu">
      {primaryAction ? (
        <button
          className="ui-action-primary"
          disabled={primaryAction.disabled}
          type="button"
          onClick={primaryAction.onClick}
        >
          {primaryAction.icon}
          {primaryAction.label}
        </button>
      ) : null}
      {secondaryActions.length ? (
        <details className="ui-action-more">
          <summary aria-label={moreLabel} title={moreLabel}>
            <MoreHorizontal size={14} />
          </summary>
          <div>
            {secondaryActions.map((action) => (
              <button disabled={action.disabled} key={action.key} type="button" onClick={action.onClick}>
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

export function ContextWindow({
  children,
  icon,
  meta,
  title,
}: {
  children: ReactNode;
  icon?: ReactNode;
  meta?: string;
  title: string;
}) {
  return (
    <details className="ui-context-window">
      <summary>
        {icon}
        <span>{title}</span>
        {meta ? <em>{meta}</em> : null}
      </summary>
      <div className="ui-context-window-body">{children}</div>
    </details>
  );
}

export function SummaryPillRow({ items }: { items: SummaryPillItem[] }) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="ui-summary-pills">
      {items.map((item) => (
        <span data-tone={item.tone ?? "default"} key={item.key}>
          {item.icon}
          {item.value ? <strong>{item.value}</strong> : null} {item.label}
        </span>
      ))}
    </div>
  );
}
