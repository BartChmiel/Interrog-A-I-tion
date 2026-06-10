import { text, type CopyKey } from "./i18n";
import type { EvidenceTopicStatus, Locale } from "./types";

export function evidenceStatusLabel(status: EvidenceTopicStatus, locale: Locale): string {
  const keys: Record<EvidenceTopicStatus, CopyKey> = {
    covered: "statusCovered",
    grounded: "statusGrounded",
    material_only: "statusMaterialOnly",
    contested: "statusContested",
    missing: "statusMissing",
  };

  return text(locale, keys[status]);
}
