import { groundedSuggestionDecisionLabel } from "./grounded-ai-panel";
import { localize, text } from "./i18n";
import type {
  AnswerView,
  AuditEvent,
  CaseData,
  EnvironmentHealthState,
  ExportIntegrityManifest,
  GroundedSuggestion,
  GroundedSuggestionDecision,
  Locale,
  QuestionView,
  RuntimeConfig,
} from "./types";

const GROUNDED_DECISION_ACTIONS = new Set([
  "grounded_suggestion_accepted",
  "grounded_suggestion_edited",
  "grounded_suggestion_rejected",
]);

export type GroundedAiAuditEntry = {
  action: string;
  suggestionId: string;
  questionId: string | null;
  decision: string | null;
  finalText: string | null;
  timestamp: string;
};

function environmentStateShortLabel(state: EnvironmentHealthState, locale: Locale): string {
  const labels: Record<Locale, Record<EnvironmentHealthState, string>> = {
    pl: {
      blocked: "blokada",
      ready: "OK",
      unknown: "n/d",
      warning: "uwaga",
    },
    en: {
      blocked: "blocked",
      ready: "OK",
      unknown: "n/a",
      warning: "warn",
    },
  };
  return labels[locale][state];
}

export type SessionReportExportInput = {
  locale: Locale;
  config: RuntimeConfig;
  caseData: CaseData | null;
  materialCount: number;
  groundedCount: number;
  operatorDecisionCount: number;
  workspaceAuditValid: boolean | null;
  workspaceAuditCount: number;
  sessionAuditCount: number;
  modelProvider: string | null;
  environmentState: EnvironmentHealthState | null;
  answerViews: AnswerView[];
  questions: QuestionView[];
  activeQuestionId: string;
  groundedSuggestions: GroundedSuggestion[];
  suggestionDecisions: Record<string, GroundedSuggestionDecision>;
  groundedModel: string | null;
  groundedPromptVersion: string | null;
  auditEvents: AuditEvent[];
  integrityManifest: ExportIntegrityManifest | null;
};

export type SessionReportJsonExport = {
  schema_version: 1;
  generated_at: string;
  locale: Locale;
  session: {
    case_id: string;
    session_id: string;
    participant_id: string;
    workspace_id: string;
  };
  provenance: {
    material_count: number;
    grounded_count: number;
    operator_decision_count: number;
    workspace_audit_count: number;
    session_audit_count: number;
    workspace_audit_valid: boolean | null;
    model_provider: string | null;
    environment_state: EnvironmentHealthState | null;
  };
  answers: Array<{
    question_id: string;
    question_label: string;
    time: string;
    text: string;
  }>;
  grounded_ai: {
    active_question_id: string;
    model: string | null;
    prompt_version: string | null;
    suggestions: GroundedSuggestion[];
    decisions: Record<string, GroundedSuggestionDecision>;
  };
  audited_ai_decisions: GroundedAiAuditEntry[];
  report_markdown: string;
  integrity_manifest: ExportIntegrityManifest | null;
};

export function extractGroundedAiAuditEntries(events: AuditEvent[]): GroundedAiAuditEntry[] {
  return events
    .filter((event) => GROUNDED_DECISION_ACTIONS.has(event.action))
    .map((event) => ({
      action: event.action,
      suggestionId: event.object_id,
      questionId: typeof event.details.question_id === "string" ? event.details.question_id : null,
      decision: typeof event.details.decision === "string" ? event.details.decision : null,
      finalText: typeof event.details.final_text === "string" ? event.details.final_text : null,
      timestamp: event.timestamp,
    }))
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

export function buildSessionReportExport(baseMarkdown: string, input: SessionReportExportInput): string {
  const questionsById = new Map(input.questions.map((question) => [question.id, question]));

  const contextLines = [
    "## Session context",
    "",
    `- Case: ${input.config.caseId}`,
    input.caseData ? `- Title: ${localize(input.caseData.title, input.locale)}` : "",
    `- Session: ${input.config.sessionId}`,
    `- Participant: ${input.config.participantId}`,
    `- Workspace: ${input.config.workspaceId}`,
    `- Generated at: ${new Date().toISOString()}`,
    "",
    "## Provenance summary",
    "",
    `- ${text(input.locale, "sourceMaterials")}: ${input.materialCount}`,
    `- ${text(input.locale, "operationsAi")}: ${input.groundedCount} grounded suggestions`,
    `- ${text(input.locale, "operatorDecisionTrail")}: ${input.operatorDecisionCount}`,
    `- ${text(input.locale, "workspaceAudit")}: ${input.workspaceAuditCount} events${
      input.workspaceAuditValid === null
        ? ""
        : ` (${input.workspaceAuditValid ? text(input.locale, "chainValid") : text(input.locale, "chainInvalid")})`
    }`,
    `- ${text(input.locale, "sessionAudit")}: ${input.sessionAuditCount} events`,
    input.environmentState
      ? `- ${text(input.locale, "environmentHealth")}: ${environmentStateShortLabel(input.environmentState, input.locale)}`
      : "",
    input.modelProvider ? `- ${text(input.locale, "localModelRuntime")}: ${input.modelProvider}` : "",
    "",
    text(input.locale, "sessionReportDisclaimer"),
    "",
    "---",
    "",
  ];

  const answerLines = buildAnswerSection(input, questionsById);
  const aiLines = buildGroundedAiSection(input, questionsById);
  const auditLines = buildAuditedAiDecisionsSection(input, questionsById);
  const integrityLines = buildIntegrityManifestSection(input);

  return [
    ...contextLines.filter((line) => line.length > 0),
    ...answerLines,
    ...aiLines,
    ...auditLines,
    ...integrityLines,
    baseMarkdown.trim(),
    "",
  ].join("\n");
}

export function buildSessionReportJson(
  markdown: string,
  input: SessionReportExportInput,
): SessionReportJsonExport {
  const questionsById = new Map(input.questions.map((question) => [question.id, question]));

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    locale: input.locale,
    session: {
      case_id: input.config.caseId,
      session_id: input.config.sessionId,
      participant_id: input.config.participantId,
      workspace_id: input.config.workspaceId,
    },
    provenance: {
      material_count: input.materialCount,
      grounded_count: input.groundedCount,
      operator_decision_count: input.operatorDecisionCount,
      workspace_audit_count: input.workspaceAuditCount,
      session_audit_count: input.sessionAuditCount,
      workspace_audit_valid: input.workspaceAuditValid,
      model_provider: input.modelProvider,
      environment_state: input.environmentState,
    },
    answers: input.answerViews.map((answer) => {
      const question = questionsById.get(answer.questionId);
      return {
        question_id: answer.questionId,
        question_label: question ? localize(question.text, input.locale) : answer.questionId,
        time: answer.time,
        text: localize(answer.text, input.locale),
      };
    }),
    grounded_ai: {
      active_question_id: input.activeQuestionId,
      model: input.groundedModel,
      prompt_version: input.groundedPromptVersion,
      suggestions: input.groundedSuggestions,
      decisions: input.suggestionDecisions,
    },
    audited_ai_decisions: extractGroundedAiAuditEntries(input.auditEvents),
    report_markdown: markdown,
    integrity_manifest: input.integrityManifest,
  };
}

function buildAnswerSection(
  input: SessionReportExportInput,
  questionsById: Map<string, QuestionView>,
): string[] {
  if (!input.answerViews.length) {
    return [];
  }

  const lines = ["## Recorded answers", ""];
  for (const answer of input.answerViews) {
    const question = questionsById.get(answer.questionId);
    const questionLabel = question ? localize(question.text, input.locale) : answer.questionId;
    lines.push(`### ${answer.questionId}: ${questionLabel}`);
    lines.push("");
    lines.push(`- Time: ${answer.time}`);
    lines.push(`- ${localize(answer.text, input.locale)}`);
    lines.push("");
  }
  return lines;
}

function buildGroundedAiSection(
  input: SessionReportExportInput,
  questionsById: Map<string, QuestionView>,
): string[] {
  const hasTrace =
    input.groundedSuggestions.length > 0 ||
    input.groundedModel ||
    Object.keys(input.suggestionDecisions).length > 0;

  if (!hasTrace) {
    return [];
  }

  const activeQuestion = questionsById.get(input.activeQuestionId);
  const lines = ["## Grounded AI trace", ""];

  if (input.groundedModel) {
    lines.push(`- ${text(input.locale, "modelLabel")}: ${input.groundedModel}`);
  }
  if (input.groundedPromptVersion) {
    lines.push(`- ${text(input.locale, "promptVersion")}: ${input.groundedPromptVersion}`);
  }
  if (activeQuestion) {
    lines.push(
      `- ${text(input.locale, "reportGroundedQuestion")}: ${input.activeQuestionId} — ${localize(activeQuestion.text, input.locale)}`,
    );
  }
  lines.push("");

  if (!input.groundedSuggestions.length) {
    return lines;
  }

  for (const suggestion of input.groundedSuggestions) {
    const decision = input.suggestionDecisions[suggestion.id];
    const decisionLabel = decision
      ? groundedSuggestionDecisionLabel(decision, input.locale)
      : text(input.locale, "reportSuggestionPending");
    lines.push(`### ${suggestion.suggestion_type} (${decisionLabel})`);
    lines.push("");
    lines.push(suggestion.text);
    lines.push("");
    lines.push(`> ${suggestion.reason}`);
    if (suggestion.linked_evidence.length) {
      lines.push("");
      lines.push(`${text(input.locale, "sourceIds")}: ${suggestion.linked_evidence.join(", ")}`);
    }
    lines.push("");
  }

  return lines;
}

function buildAuditedAiDecisionsSection(
  input: SessionReportExportInput,
  questionsById: Map<string, QuestionView>,
): string[] {
  const entries = extractGroundedAiAuditEntries(input.auditEvents);
  if (!entries.length) {
    return [];
  }

  const lines = ["## Audited AI decisions", ""];
  for (const entry of entries) {
    const question = entry.questionId ? questionsById.get(entry.questionId) : null;
    const questionLabel = question
      ? `${entry.questionId} — ${localize(question.text, input.locale)}`
      : (entry.questionId ?? "—");
    const decisionLabel = entry.decision
      ? groundedSuggestionDecisionLabel(entry.decision as GroundedSuggestionDecision, input.locale)
      : entry.action;
    lines.push(`### ${entry.suggestionId} (${decisionLabel})`);
    lines.push("");
    lines.push(`- ${text(input.locale, "reportGroundedQuestion")}: ${questionLabel}`);
    lines.push(`- Time: ${entry.timestamp}`);
    if (entry.finalText) {
      lines.push(`- ${entry.finalText}`);
    }
    lines.push("");
  }

  return lines;
}

function buildIntegrityManifestSection(input: SessionReportExportInput): string[] {
  const manifest = input.integrityManifest;
  if (!manifest) {
    return [];
  }

  const lines = ["## Export integrity manifest", ""];
  lines.push(`- Export ID: ${manifest.export_id}`);
  if (manifest.manifest_hash) {
    lines.push(`- Manifest hash: ${manifest.manifest_hash}`);
  }

  for (const file of manifest.files) {
    lines.push(`- ${file.path}: ${file.sha256} (${file.size_bytes} bytes)`);
  }

  if (manifest.model_artifacts) {
    const reference = manifest.model_artifacts;
    lines.push(
      `- ${text(input.locale, "modelArtifacts")}: ${reference.manifest_path} / ${reference.manifest_sha256 ?? "—"} / ${reference.record_count} records / ${reference.chain_valid ? text(input.locale, "chainValid") : text(input.locale, "chainInvalid")}`,
    );
  }

  lines.push("");
  return lines;
}
