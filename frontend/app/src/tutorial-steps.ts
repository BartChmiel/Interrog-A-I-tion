import type { CopyKey } from "./i18n";

export type TutorialPlacement = "top" | "bottom" | "left" | "right" | "center";

export type TutorialStepDefinition = {
  id: string;
  bodyKey: CopyKey;
  placement: TutorialPlacement;
  target?: string;
  titleKey: CopyKey;
};

export const tutorialStepDefinitions: TutorialStepDefinition[] = [
  {
    id: "welcome",
    placement: "center",
    titleKey: "tutorialWelcomeTitle",
    bodyKey: "tutorialWelcomeBody",
  },
  {
    id: "topbar",
    placement: "bottom",
    target: "topbar",
    titleKey: "tutorialTopbarTitle",
    bodyKey: "tutorialTopbarBody",
  },
  {
    id: "zone-left",
    placement: "right",
    target: "zone-left",
    titleKey: "tutorialZoneLeftTitle",
    bodyKey: "tutorialZoneLeftBody",
  },
  {
    id: "case-dossier",
    placement: "right",
    target: "case-dossier",
    titleKey: "tutorialDossierTitle",
    bodyKey: "tutorialDossierBody",
  },
  {
    id: "demo-walkthrough",
    placement: "right",
    target: "demo-walkthrough",
    titleKey: "tutorialDemoTitle",
    bodyKey: "tutorialDemoBody",
  },
  {
    id: "interview-context",
    placement: "bottom",
    target: "interview-context",
    titleKey: "tutorialContextTitle",
    bodyKey: "tutorialContextBody",
  },
  {
    id: "active-question",
    placement: "bottom",
    target: "active-question",
    titleKey: "tutorialQuestionTitle",
    bodyKey: "tutorialQuestionBody",
  },
  {
    id: "answer-composer",
    placement: "top",
    target: "answer-composer",
    titleKey: "tutorialComposerTitle",
    bodyKey: "tutorialComposerBody",
  },
  {
    id: "zone-operations",
    placement: "left",
    target: "zone-operations",
    titleKey: "tutorialZoneOpsTitle",
    bodyKey: "tutorialZoneOpsBody",
  },
  {
    id: "operations-tabs",
    placement: "left",
    target: "operations-tabs",
    titleKey: "tutorialTabsTitle",
    bodyKey: "tutorialTabsBody",
  },
  {
    id: "tab-monitor",
    placement: "left",
    target: "operations-tab-monitor",
    titleKey: "tutorialMonitorTitle",
    bodyKey: "tutorialMonitorBody",
  },
  {
    id: "tab-ai",
    placement: "left",
    target: "operations-tab-ai",
    titleKey: "tutorialAiTitle",
    bodyKey: "tutorialAiBody",
  },
  {
    id: "tab-materials",
    placement: "left",
    target: "operations-tab-materials",
    titleKey: "tutorialMaterialsTitle",
    bodyKey: "tutorialMaterialsBody",
  },
  {
    id: "tab-review",
    placement: "left",
    target: "operations-tab-review",
    titleKey: "tutorialReviewTitle",
    bodyKey: "tutorialReviewBody",
  },
  {
    id: "finish",
    placement: "center",
    titleKey: "tutorialFinishTitle",
    bodyKey: "tutorialFinishBody",
  },
];

export function revealTutorialTarget(targetId: string): void {
  const element = document.querySelector(`[data-tutorial="${targetId}"]`);
  if (!element) {
    return;
  }

  let parent = element.parentElement;
  while (parent) {
    if (parent instanceof HTMLDetailsElement) {
      parent.open = true;
    }
    parent = parent.parentElement;
  }

  window.requestAnimationFrame(() => {
    element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  });
}
