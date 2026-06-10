import { useEffect, useMemo, useState } from "react";
import { Braces, CheckCircle2, ClipboardCopy, FileArchive, FileDown, Loader2, XCircle } from "lucide-react";
import { loadExportBundle, loadExportIntegrityPreview } from "./api";
import { downloadBase64File } from "./export-bundle";
import { text } from "./i18n";
import {
  buildSessionReportExport,
  buildSessionReportJson,
  type SessionReportExportInput,
} from "./session-report";
import type { ApiMode, ExportIntegrityManifest, ExportIntegrityVerification, Locale, RuntimeConfig } from "./types";

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

    try {
      const response = await loadExportBundle(config, markdownWithoutIntegrity, jsonExport);
      downloadBase64File(response.content_base64, response.filename, response.content_type);
      setIntegrityManifest(response.manifest);
      setIntegrityVerification(response.verification);
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
          <div className="session-report-actions">
            <button type="button" onClick={downloadMarkdown}>
              <FileDown size={14} />
              {text(locale, "sessionReportDownload")}
            </button>
            <button type="button" onClick={() => void copyMarkdown()}>
              <ClipboardCopy size={14} />
              {text(locale, "sessionReportCopy")}
            </button>
            <button type="button" onClick={downloadJson}>
              <Braces size={14} />
              {text(locale, "sessionReportDownloadJson")}
            </button>
            <button type="button" onClick={() => void copyJson()}>
              <Braces size={14} />
              {text(locale, "sessionReportCopyJson")}
            </button>
            <button disabled={isBundleDownloading} type="button" onClick={() => void downloadBundle()}>
              {isBundleDownloading ? <Loader2 className="spin" size={14} /> : <FileArchive size={14} />}
              {text(locale, "sessionReportDownloadBundle")}
            </button>
          </div>
          {bundleError ? <p className="grounding-pack-error">{bundleError}</p> : null}
          <div className="session-report-integrity">
            <strong>{text(locale, "exportIntegrityPreview")}</strong>
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
          <details className="session-report-preview">
            <summary>{text(locale, "sessionReportPreview")}</summary>
            <pre>{markdownExport}</pre>
          </details>
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

function downloadTextFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
