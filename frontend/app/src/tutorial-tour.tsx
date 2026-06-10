import { useEffect, useLayoutEffect, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, GraduationCap, Sparkles, X } from "lucide-react";
import { text, type CopyKey } from "./i18n";
import type { Locale } from "./types";
import {
  revealTutorialTarget,
  tutorialStepDefinitions,
  type TutorialPlacement,
  type TutorialStepDefinition,
} from "./tutorial-steps";

type SpotlightRect = {
  height: number;
  left: number;
  top: number;
  width: number;
};

type TooltipPosition = {
  left: number;
  top: number;
  placement: TutorialPlacement;
};

const TOOLTIP_GAP = 14;
const VIEWPORT_PADDING = 16;

function measureTarget(targetId?: string): SpotlightRect | null {
  if (!targetId) {
    return null;
  }

  const element = document.querySelector(`[data-tutorial="${targetId}"]`);
  if (!element) {
    return null;
  }

  const rect = element.getBoundingClientRect();
  const padding = 8;
  return {
    left: Math.max(VIEWPORT_PADDING, rect.left - padding),
    top: Math.max(VIEWPORT_PADDING, rect.top - padding),
    width: Math.min(window.innerWidth - VIEWPORT_PADDING * 2, rect.width + padding * 2),
    height: Math.min(window.innerHeight - VIEWPORT_PADDING * 2, rect.height + padding * 2),
  };
}

function computeTooltipPosition(
  placement: TutorialPlacement,
  spotlight: SpotlightRect | null,
  tooltipWidth: number,
  tooltipHeight: number,
): TooltipPosition {
  if (!spotlight || placement === "center") {
    return {
      left: Math.max(VIEWPORT_PADDING, (window.innerWidth - tooltipWidth) / 2),
      top: Math.max(VIEWPORT_PADDING, (window.innerHeight - tooltipHeight) / 2),
      placement: "center",
    };
  }

  let left = spotlight.left;
  let top = spotlight.top;
  let resolvedPlacement = placement;

  if (placement === "bottom") {
    left = spotlight.left + spotlight.width / 2 - tooltipWidth / 2;
    top = spotlight.top + spotlight.height + TOOLTIP_GAP;
  } else if (placement === "top") {
    left = spotlight.left + spotlight.width / 2 - tooltipWidth / 2;
    top = spotlight.top - tooltipHeight - TOOLTIP_GAP;
  } else if (placement === "right") {
    left = spotlight.left + spotlight.width + TOOLTIP_GAP;
    top = spotlight.top + spotlight.height / 2 - tooltipHeight / 2;
  } else if (placement === "left") {
    left = spotlight.left - tooltipWidth - TOOLTIP_GAP;
    top = spotlight.top + spotlight.height / 2 - tooltipHeight / 2;
  }

  if (top < VIEWPORT_PADDING) {
    top = spotlight.top + spotlight.height + TOOLTIP_GAP;
    resolvedPlacement = "bottom";
  }
  if (top + tooltipHeight > window.innerHeight - VIEWPORT_PADDING) {
    top = Math.max(VIEWPORT_PADDING, spotlight.top - tooltipHeight - TOOLTIP_GAP);
    resolvedPlacement = "top";
  }

  left = Math.min(Math.max(VIEWPORT_PADDING, left), window.innerWidth - tooltipWidth - VIEWPORT_PADDING);

  return { left, top, placement: resolvedPlacement };
}

export function TutorialLaunchButton({
  locale,
  onStart,
}: {
  locale: Locale;
  onStart: () => void;
}) {
  return (
    <button className="tutorial-launch-button" data-tutorial="tutorial-launch" type="button" onClick={onStart}>
      <GraduationCap size={15} />
      <span>{text(locale, "tutorialLaunch")}</span>
      <kbd>?</kbd>
    </button>
  );
}

export function TutorialTour({
  active,
  locale,
  onClose,
  onStepEnter,
  stepIndex,
  onStepChange,
}: {
  active: boolean;
  locale: Locale;
  onClose: () => void;
  onStepEnter: (step: TutorialStepDefinition) => void;
  stepIndex: number;
  onStepChange: (nextIndex: number) => void;
}) {
  const step = tutorialStepDefinitions[stepIndex];
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>({ opacity: 0 });
  const [arrowStyle, setArrowStyle] = useState<CSSProperties>({ display: "none" });

  useEffect(() => {
    if (!active) {
      return;
    }

    onStepEnter(step);
    const delay =
      step.id.startsWith("zone-") || step.id.startsWith("tab-") || step.id === "operations-tabs" ? 220 : 60;
    const timer = window.setTimeout(() => {
      if (step.target) {
        revealTutorialTarget(step.target);
      }
    }, delay);

    return () => window.clearTimeout(timer);
  }, [active, onStepEnter, step]);

  useLayoutEffect(() => {
    if (!active) {
      return;
    }

    const update = () => {
      const nextSpotlight = measureTarget(step.target);
      setSpotlight(nextSpotlight);

      const tooltipNode = document.getElementById("tutorial-tooltip-card");
      const tooltipWidth = tooltipNode?.offsetWidth ?? 360;
      const tooltipHeight = tooltipNode?.offsetHeight ?? 220;
      const position = computeTooltipPosition(step.placement, nextSpotlight, tooltipWidth, tooltipHeight);

      setTooltipStyle({
        left: position.left,
        top: position.top,
        opacity: 1,
      });

      if (!nextSpotlight || position.placement === "center") {
        setArrowStyle({ display: "none" });
        return;
      }

      const arrowSize = 10;
      if (position.placement === "bottom") {
        setArrowStyle({
          display: "block",
          left: nextSpotlight.left + nextSpotlight.width / 2 - arrowSize,
          top: nextSpotlight.top + nextSpotlight.height + 2,
        });
      } else if (position.placement === "top") {
        setArrowStyle({
          display: "block",
          left: nextSpotlight.left + nextSpotlight.width / 2 - arrowSize,
          top: nextSpotlight.top - arrowSize * 2,
        });
      } else if (position.placement === "right") {
        setArrowStyle({
          display: "block",
          left: nextSpotlight.left + nextSpotlight.width + 2,
          top: nextSpotlight.top + nextSpotlight.height / 2 - arrowSize,
        });
      } else {
        setArrowStyle({
          display: "block",
          left: nextSpotlight.left - arrowSize * 2,
          top: nextSpotlight.top + nextSpotlight.height / 2 - arrowSize,
        });
      }
    };

    const frame = window.requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [active, step, stepIndex]);

  useEffect(() => {
    if (!active) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "ArrowRight" || event.key === "Enter") {
        event.preventDefault();
        if (stepIndex < tutorialStepDefinitions.length - 1) {
          onStepChange(stepIndex + 1);
        } else {
          onClose();
        }
      }
      if (event.key === "ArrowLeft" && stepIndex > 0) {
        event.preventDefault();
        onStepChange(stepIndex - 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [active, onClose, onStepChange, stepIndex]);

  if (!active || !step) {
    return null;
  }

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === tutorialStepDefinitions.length - 1;

  return (
    <div className="tutorial-root" role="presentation">
      {spotlight ? (
        <>
          <div
            className="tutorial-spotlight-mask"
            style={{
              left: spotlight.left,
              top: spotlight.top,
              width: spotlight.width,
              height: spotlight.height,
            }}
          />
          <div
            className="tutorial-spotlight-ring"
            style={{
              left: spotlight.left,
              top: spotlight.top,
              width: spotlight.width,
              height: spotlight.height,
            }}
          />
        </>
      ) : (
        <div className="tutorial-backdrop" />
      )}

      <span aria-hidden className="tutorial-arrow" style={arrowStyle} />

      <article className="tutorial-tooltip" id="tutorial-tooltip-card" style={tooltipStyle}>
        <header className="tutorial-tooltip-header">
          <div>
            <span className="tutorial-kicker">
              <Sparkles size={13} />
              {text(locale, "tutorialMode")}
            </span>
            <h2>{text(locale, step.titleKey as CopyKey)}</h2>
          </div>
          <button className="tutorial-icon-button" type="button" onClick={onClose}>
            <X size={16} />
            <span>{text(locale, "tutorialSkip")}</span>
          </button>
        </header>

        <p>{text(locale, step.bodyKey as CopyKey)}</p>

        <footer className="tutorial-tooltip-footer">
          <span>
            {stepIndex + 1}/{tutorialStepDefinitions.length}
          </span>
          <div className="tutorial-tooltip-actions">
            <button disabled={isFirst} type="button" onClick={() => onStepChange(stepIndex - 1)}>
              <ChevronLeft size={15} />
              {text(locale, "tutorialBack")}
            </button>
            {isLast ? (
              <button className="is-primary" type="button" onClick={onClose}>
                {text(locale, "tutorialFinish")}
              </button>
            ) : (
              <button className="is-primary" type="button" onClick={() => onStepChange(stepIndex + 1)}>
                {text(locale, "tutorialNext")}
                <ChevronRight size={15} />
              </button>
            )}
          </div>
        </footer>

        <div className="tutorial-progress">
          <span style={{ width: `${((stepIndex + 1) / tutorialStepDefinitions.length) * 100}%` }} />
        </div>
      </article>
    </div>
  );
}
