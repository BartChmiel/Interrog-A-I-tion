import { useEffect, useId, useRef, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { text, type CopyKey } from "./i18n";
import type { Locale } from "./types";

export function CollapsibleSection({
  accordionGroup,
  children,
  className = "",
  defaultOpen = false,
  hint,
  meta,
  title,
  tutorialId,
}: {
  accordionGroup?: string;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  hint?: string;
  meta: string;
  title: string;
  tutorialId?: string;
}) {
  return (
    <details
      className={`collapsible-section ${className}`.trim()}
      data-tutorial={tutorialId}
      name={accordionGroup}
      open={defaultOpen || undefined}
    >
      <summary className="collapsible-section-summary">
        <span className="collapsible-section-titles">
          <strong>{title}</strong>
          <em>{meta}</em>
          {hint ? <span className="collapsible-section-hint">{hint}</span> : null}
        </span>
        <ChevronDown aria-hidden className="collapsible-section-chevron" size={16} />
      </summary>
      <div className="collapsible-section-body">{children}</div>
    </details>
  );
}

export function CollapsibleWorkspaceCard({
  children,
  className = "",
  defaultOpen = false,
  highlight = false,
  meta,
  scrollable = false,
  sticky = false,
  title,
  tutorialId,
}: {
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  highlight?: boolean;
  meta?: string;
  scrollable?: boolean;
  sticky?: boolean;
  title: string;
  tutorialId?: string;
}) {
  const classes = [
    "workspace-card",
    "collapsible-workspace-card",
    highlight ? "workspace-card--highlight" : "",
    scrollable ? "workspace-card--scroll" : "",
    sticky ? "workspace-card--sticky" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <details className={classes} data-tutorial={tutorialId} open={defaultOpen || undefined}>
      <summary className="workspace-card-header">
        <span className="workspace-card-header-titles">
          <strong>{title}</strong>
          {meta ? <span>{meta}</span> : null}
        </span>
        <ChevronDown aria-hidden className="workspace-card-chevron" size={15} />
      </summary>
      <div className="workspace-card-body">{children}</div>
    </details>
  );
}

export function InterviewContextStrip({
  caseId,
  coverageLabel,
  locale,
  participantId,
  roleLabel,
  sessionId,
  topicCoverageLabel,
  urgentActionCount,
}: {
  caseId: string;
  coverageLabel: string;
  locale: Locale;
  participantId: string;
  roleLabel: string;
  sessionId: string;
  topicCoverageLabel: string | null;
  urgentActionCount: number;
}) {
  const compactToken = (value: string) => (value.length > 22 ? `${value.slice(0, 10)}...${value.slice(-6)}` : value);

  return (
    <div className="interview-context-strip" data-tutorial="interview-context" role="status">
      <div className="interview-context-pills">
        <span className="context-pill">{roleLabel}</span>
        <span className="context-pill">
          {coverageLabel} {text(locale, "contextCoverage")}
        </span>
        {topicCoverageLabel ? (
          <span className="context-pill">
            {topicCoverageLabel} {text(locale, "contextTopicCoverage")}
          </span>
        ) : null}
        {urgentActionCount > 0 ? (
          <span className="context-pill context-pill--signal">
            {urgentActionCount} {text(locale, "operatorUrgentShort")}
          </span>
        ) : null}
      </div>
      <details className="interview-context-technical auditor-only">
        <summary>{text(locale, "materialTechnicalDetails")}</summary>
        <span title={caseId}>{compactToken(caseId)}</span>
        <span title={sessionId}>
          {text(locale, "contextSession")}: {compactToken(sessionId)}
        </span>
        <span title={participantId}>
          {text(locale, "contextParticipant")}: {compactToken(participantId)}
        </span>
      </details>
      <span className="interview-context-hint">{text(locale, "disclosureHint")}</span>
    </div>
  );
}

export function WorkspaceZone({
  children,
  collapsed,
  disclosureHint,
  label,
  locale,
  onToggleCollapse,
  side,
  tutorialId,
}: {
  children: ReactNode;
  collapsed: boolean;
  disclosureHint?: string;
  label: string;
  locale: Locale;
  onToggleCollapse: () => void;
  side: "left" | "center" | "right";
  tutorialId?: string;
}) {
  const collapseKey: CopyKey = "collapseZone";
  const expandKey: CopyKey = "expandZone";

  if (collapsed) {
    return (
      <div className={`workspace-zone workspace-zone--${side} is-collapsed`} data-tutorial={tutorialId}>
        <button
          className="workspace-zone-restore"
          type="button"
          title={text(locale, expandKey)}
          onClick={onToggleCollapse}
        >
          {side === "left" ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          <span>{label}</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`workspace-zone workspace-zone--${side}`} data-tutorial={tutorialId}>
      <div className="workspace-zone-header">
        <div className="workspace-zone-heading">
          <span className="workspace-zone-label">{label}</span>
          {disclosureHint ? <span className="workspace-zone-hint">{disclosureHint}</span> : null}
        </div>
        {side === "center" ? null : (
          <button
            className="workspace-zone-collapse"
            type="button"
            title={text(locale, collapseKey)}
            onClick={onToggleCollapse}
          >
            {side === "left" ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
            <span>{text(locale, collapseKey)}</span>
          </button>
        )}
      </div>
      <div className="workspace-zone-body">{children}</div>
    </div>
  );
}

export function WorkspaceCard({
  children,
  className = "",
  highlight = false,
  meta,
  scrollable = false,
  sticky = false,
  title,
  tutorialId,
}: {
  children: ReactNode;
  className?: string;
  highlight?: boolean;
  meta?: string;
  scrollable?: boolean;
  sticky?: boolean;
  title: string;
  tutorialId?: string;
}) {
  const classes = [
    "workspace-card",
    highlight ? "workspace-card--highlight" : "",
    scrollable ? "workspace-card--scroll" : "",
    sticky ? "workspace-card--sticky" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={classes} data-tutorial={tutorialId}>
      <header className="workspace-card-header">
        <strong>{title}</strong>
        {meta ? <span>{meta}</span> : null}
      </header>
      <div className="workspace-card-body">{children}</div>
    </article>
  );
}

export function Modal({
  children,
  locale,
  onClose,
  subtitle,
  title,
}: {
  children: ReactNode;
  locale: Locale;
  onClose: () => void;
  subtitle?: string;
  title: string;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
      'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    firstFocusable?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <div className="modal-root" role="presentation">
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="modal-dialog"
        ref={dialogRef}
        role="dialog"
      >
        <header className="modal-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button className="modal-close" type="button" onClick={onClose}>
            <X size={16} />
            <span>{text(locale, "closeModal")}</span>
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
