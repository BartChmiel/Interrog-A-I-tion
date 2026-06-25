import { useEffect, useMemo, useState } from "react";
import {
  Braces,
  CheckCircle2,
  ClipboardCopy,
  FileArchive,
  FileDown,
  FileText,
  Fingerprint,
  Loader2,
  XCircle,
} from "lucide-react";
import { loadExportBundle, loadExportIntegrityPreview } from "./api";
import { downloadBase64File } from "./export-bundle";
import { text } from "./i18n";
import {
  buildSessionReportExport,
  buildSessionReportJson,
  type SessionReportExportInput,
} from "./session-report";
import { ActionMenu, ContextWindow, SummaryPillRow, type UiAction } from "./ui-patterns";
import type {
  ApiMode,
  ExportBundleResponse,
  ExportIntegrityManifest,
  ExportIntegrityVerification,
  Locale,
  RuntimeConfig,
} from "./types";

type BundleReceipt = {
  filename: string;
  bundleSha256: string | null;
  bundleSizeBytes: number | null;
  manifestHash: string | null;
  verified: boolean;
  chainValid: boolean;
  verifyCommand: string;
};

function shortHash(value: string): string {
  return value.length > 16 ? `${value.slice(0, 16)}…` : value;
}

export function SessionReportPanel({
  apiMode,
  config,
  exportInput,
  locale,
  preview,
  onExported,
}: {
  apiMode: ApiMode;
  config: RuntimeConfig;
  exportInput: SessionReportExportInput | null;
  locale: Locale;
  preview: string | null;
  onExported?: () => void;
}) {
  const [integrityManifest, setIntegrityManifest] = useState<ExportIntegrityManifest | null>(null);
  const [integrityVerification, setIntegrityVerification] = useState<ExportIntegrityVerification | null>(null);
  const [integrityError, setIntegrityError] = useState<string | null>(null);
  const [isIntegrityLoading, setIsIntegrityLoading] = useState(false);
  const [isBundleDownloading, setIsBundleDownloading] = useState(false);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const [bundleReceipt, setBundleReceipt] = useState<BundleReceipt | null>(null);

  const markdownWithoutIntegrity = useMemo(() => {
    if (!preview || !exportInput) {
      return null;
    }
    return buildSessionReportExport(preview, { ...exportInput, integrityManifest: null });
  }, [exportInput, preview]);

  useEffect(() => {
    if (apiMode !== "online" || !markdownWithoutIntegrity) {
      setIntegrityManifest(null);
      setIntegrityVerification(null);
      setIntegrityError(null);
      return;
    }

    let cancelled = false;
    setIsIntegrityLoading(true);
    setIntegrityError(null);

    void loadExportIntegrityPreview(config, markdownWithoutIntegrity)
      .then((response) => {
        if (!cancelled) {
          setIntegrityManifest(response.manifest);
          setIntegrityVerification(response.verification);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setIntegrityManifest(null);
          setIntegrityVerification(null);
          setIntegrityError(error instanceof Error ? error.message : text(locale, "integrityPreviewFailed"));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsIntegrityLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiMode, config, locale, markdownWithoutIntegrity]);

  const exportInputWithIntegrity = useMemo(() => {
    if (!exportInput) {
      return null;
    }
    return { ...exportInput, integrityManifest };
  }, [exportInput, integrityManifest]);

  const markdownExport = useMemo(() => {
    if (!preview || !exportInputWithIntegrity) {
      return null;
    }
    if (!integrityManifest) {
      return markdownWithoutIntegrity;
    }
    return buildSessionReportExport(preview, exportInputWithIntegrity);
  }, [exportInputWithIntegrity, integrityManifest, markdownWithoutIntegrity, preview]);

  const jsonExport = useMemo(() => {
    if (!markdownExport || !exportInputWithIntegrity) {
      return null;
    }
    return JSON.stringify(buildSessionReportJson(markdownExport, exportInputWithIntegrity), null, 2);
  }, [exportInputWithIntegrity, markdownExport]);

  const available = apiMode === "online" && Boolean(markdownExport);
  const reportLineCount = markdownExport ? markdownExport.split(/\r?\n/).length : 0;
  const reportFileCount = integrityManifest?.files.length ?? 0;
  const integrityStateLabel = isIntegrityLoading
    ? text(locale, "integrityPreviewLoading")
    : integrityVerification?.verified
      ? text(locale, "integrityVerified")
      : integrityError
        ? text(locale, "integrityFailed")
        : text(locale, "integrityPreviewUnavailable");
  const primaryExportAction: UiAction | null = available
    ? {
        disabled: isBundleDownloading,
        icon: isBundleDownloading ? <Loader2 className="spin" size={14} /> : <FileArchive size={14} />,
        key: "download-bundle",
        label: isBundleDownloading ? "..." : text(locale, "sessionReportDownloadBundle"),
        onClick: () => void downloadBundle(),
      }
    : null;
  const secondaryExportActions: UiAction[] = available
    ? [
        {
          icon: <FileDown size={14} />,
          key: "download-markdown",
          label: text(locale, "sessionReportDownload"),
          onClick: downloadMarkdown,
        },
        {
          icon: <ClipboardCopy size={14} />,
          key: "copy-markdown",
          label: text(locale, "sessionReportCopy"),
          onClick: () => void copyMarkdown(),
        },
        {
          icon: <Braces size={14} />,
          key: "download-json",
          label: text(locale, "sessionReportDownloadJson"),
          onClick: downloadJson,
        },
        {
          icon: <Braces size={14} />,
          key: "copy-json",
          label: text(locale, "sessionReportCopyJson"),
          onClick: () => void copyJson(),
        },
      ]
    : [];

  async function copyMarkdown() {
    if (!markdownExport) {
      return;
    }
    await navigator.clipboard.writeText(markdownExport);
    onExported?.();
  }

  async function copyJson() {
    if (!jsonExport) {
      return;
    }
    await navigator.clipboard.writeText(jsonExport);
    onExported?.();
  }

  async function copyBundleVerifyCommand(command: string) {
    await navigator.clipboard.writeText(command);
  }

  function downloadMarkdown() {
    if (!markdownExport) {
      return;
    }
    downloadTextFile(markdownExport, buildFilename(config, "md"), "text/markdown;charset=utf-8");
    onExported?.();
  }

  function downloadJson() {
    if (!jsonExport) {
      return;
    }
    downloadTextFile(jsonExport, buildFilename(config, "json"), "application/json;charset=utf-8");
    onExported?.();
  }

  async function downloadBundle() {
    if (!markdownWithoutIntegrity || !markdownExport) {
      return;
    }

    setIsBundleDownloading(true);
    setBundleError(null);
    setBundleReceipt(null);

    try {
      const response = await loadExportBundle(config, markdownWithoutIntegrity, jsonExport);
      downloadBase64File(response.content_base64, response.filename, response.content_type);
      setIntegrityManifest(response.manifest);
      setIntegrityVerification(response.verification);
      setBundleReceipt(createBundleReceipt(response));
      onExported?.();
    } catch (error) {
      setBundleError(error instanceof Error ? error.message : text(locale, "exportBundleFailed"));
    } finally {
      setIsBundleDownloading(false);
    }
  }

  return (
    <div className="session-report-panel">
      <p className="session-report-disclaimer">{text(locale, "sessionReportDisclaimer")}</p>
      {available ? (
        <>
          <div className="session-report-export-card">
            <div className="session-report-export-header">
              <div>
                <strong>{text(locale, "reportExportReady")}</strong>
                <span>{text(locale, "reportExportSummary")}</span>
              </div>
              <ActionMenu
                moreLabel={text(locale, "moreActions")}
                primaryAction={primaryExportAction}
                secondaryActions={secondaryExportActions}
              />
            </div>
            <SummaryPillRow
              items={[
                {
                  icon: <FileText size={13} />,
                  key: "lines",
                  label: text(locale, "reportLines"),
                  value: String(reportLineCount),
                },
                {
                  icon: <Braces size={13} />,
                  key: "formats",
                  label: text(locale, "reportFormats"),
                  value: "MD/JSON/ZIP",
                },
                {
                  icon: <Fingerprint size={13} />,
                  key: "integrity",
                  label: integrityStateLabel,
                  tone: integrityVerification?.verified ? "ok" : integrityError ? "danger" : "default",
                  value: reportFileCount ? String(reportFileCount) : undefined,
                },
              ]}
            />
          </div>
          {bundleError ? <p className="grounding-pack-error">{bundleError}</p> : null}
          {bundleReceipt ? (
            <ContextWindow
              className="auditor-only"
              icon={<FileArchive size={14} />}
              meta={
                bundleReceipt.verified && bundleReceipt.chainValid
                  ? text(locale, "integrityVerified")
                  : text(locale, "integrityFailed")
              }
              title={text(locale, "exportBundleReady")}
            >
              <div className="session-report-bundle-receipt">
                <span
                  className="integrity-verification-badge"
                  data-verified={bundleReceipt.verified && bundleReceipt.chainValid ? "true" : "false"}
                >
                  {bundleReceipt.verified && bundleReceipt.chainValid ? (
                    <CheckCircle2 size={14} />
                  ) : (
                    <XCircle size={14} />
                  )}
                  {bundleReceipt.verified && bundleReceipt.chainValid
                    ? text(locale, "integrityVerified")
                    : text(locale, "integrityFailed")}
                </span>
              <div className="session-report-bundle-grid">
                <span>{bundleReceipt.filename}</span>
                {bundleReceipt.bundleSha256 ? (
                  <span>
                    {text(locale, "exportBundleHash")}: {shortHash(bundleReceipt.bundleSha256)}
                  </span>
                ) : null}
                {bundleReceipt.bundleSizeBytes !== null ? (
                  <span>
                    {text(locale, "exportBundleSize")}: {formatBytes(bundleReceipt.bundleSizeBytes)}
                  </span>
                ) : null}
                {bundleReceipt.manifestHash ? (
                  <span>
                    {text(locale, "manifestHash")}: {shortHash(bundleReceipt.manifestHash)}
                  </span>
                ) : null}
                <span>{bundleReceipt.chainValid ? text(locale, "chainValid") : text(locale, "chainInvalid")}</span>
              </div>
              <div className="session-report-bundle-command">
                <code>{bundleReceipt.verifyCommand}</code>
                <button type="button" onClick={() => void copyBundleVerifyCommand(bundleReceipt.verifyCommand)}>
                  <ClipboardCopy size={14} />
                  {text(locale, "exportBundleCopyCommand")}
                </button>
              </div>
              </div>
            </ContextWindow>
          ) : null}
          <ContextWindow
            className="auditor-only"
            icon={<Fingerprint size={14} />}
            meta={integrityStateLabel}
            title={text(locale, "exportIntegrityPreview")}
          >
            <div className="session-report-integrity">
            {isIntegrityLoading ? (
              <p className="grounded-ai-loading">
                <Loader2 className="spin" size={14} />
                {text(locale, "integrityPreviewLoading")}
              </p>
            ) : integrityError ? (
              <p className="grounding-pack-error">{integrityError}</p>
            ) : integrityManifest ? (
              <div className="session-report-integrity-meta">
                {integrityVerification ? (
                  <span
                    className="integrity-verification-badge"
                    data-verified={integrityVerification.verified ? "true" : "false"}
                  >
                    {integrityVerification.verified ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    {integrityVerification.verified
                      ? text(locale, "integrityVerified")
                      : text(locale, "integrityFailed")}
                  </span>
                ) : null}
                <span>
                  {text(locale, "manifestHash")}: {shortHash(integrityManifest.manifest_hash ?? "—")}
                </span>
                {integrityManifest.files.map((file) => (
                  <span key={file.path}>
                    {file.path}: {shortHash(file.sha256)}
                  </span>
                ))}
                {integrityManifest.model_artifacts ? (
                  <span>
                    {text(locale, "modelArtifacts")}: {integrityManifest.model_artifacts.record_count}{" "}
                    {text(locale, "artifactRecords")} /{" "}
                    {integrityManifest.model_artifacts.chain_valid
                      ? text(locale, "chainValid")
                      : text(locale, "chainInvalid")}
                  </span>
                ) : null}
              </div>
            ) : (
              <p className="empty-state">{text(locale, "integrityPreviewUnavailable")}</p>
            )}
            </div>
          </ContextWindow>
          <ContextWindow
            icon={<FileText size={14} />}
            meta={`${reportLineCount} ${text(locale, "reportLines")}`}
            title={text(locale, "sessionReportPreview")}
          >
            <pre className="session-report-preview-body">{markdownExport}</pre>
          </ContextWindow>
        </>
      ) : (
        <p className="session-report-unavailable">{text(locale, "sessionReportUnavailable")}</p>
      )}
    </div>
  );
}

function buildFilename(config: RuntimeConfig, extension: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `interrogaition-${config.caseId}-${config.sessionId}-${stamp}.${extension}`;
}

function createBundleReceipt(response: ExportBundleResponse): BundleReceipt {
  const details = response.audit_event.details;
  const bundleSha256 = readString(details.bundle_sha256);
  return {
    filename: response.filename,
    bundleSha256,
    bundleSizeBytes: readNumber(details.bundle_size_bytes),
    manifestHash: response.manifest.manifest_hash ?? readString(details.manifest_hash),
    verified: response.verification.verified,
    chainValid: response.chain_valid,
    verifyCommand: buildBundleVerifyCommand(response.filename, bundleSha256),
  };
}

function buildBundleVerifyCommand(filename: string, bundleSha256: string | null): string {
  const baseCommand = `python -m interrogaition.cli verify-export .\\${filename} --bundle`;
  return bundleSha256 ? `${baseCommand} --expected-sha256 ${bundleSha256}` : baseCommand;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function downloadTextFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
