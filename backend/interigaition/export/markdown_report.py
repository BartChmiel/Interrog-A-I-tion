"""Markdown report export for deterministic interview reviews."""

from __future__ import annotations

from interigaition.analysis.interview_review import InterviewReview
from interigaition.domain.models import Case
from interigaition.i18n.localization import LanguagePack, load_language_pack


def render_review_markdown(case: Case, review: InterviewReview, locale: str = "en") -> str:
    """Render a concise working report."""

    language = load_language_pack(locale, namespace="report")
    lines = [
        f"# {language.text('report.title', case_title=case.title)}",
        "",
        f"## {language.text('report.scope_heading')}",
        "",
        language.text("report.scope_disclaimer"),
        "",
        f"## {language.text('report.topic_coverage_heading')}",
        "",
        f"- {language.text('report.covered_topics')}: {len(review.covered_topic_ids)}",
        f"- {language.text('report.missing_topics')}: {len(review.missing_topic_ids)}",
        "",
        f"## {language.text('report.findings_heading')}",
        "",
    ]

    if not review.findings:
        lines.append(language.text("report.no_findings"))
    else:
        for finding in review.findings:
            title = _localized_finding_title(language, finding.category, finding.metadata, finding.title)
            detail = _localized_finding_detail(language, finding.category, finding.metadata, finding.detail)
            category = language.text(f"category.{finding.category}", default=finding.category)
            severity = language.text(f"severity.{finding.severity}", default=finding.severity)
            linked = ", ".join(finding.linked_ids) if finding.linked_ids else "none"
            lines.extend(
                [
                    f"### {title}",
                    "",
                    f"- {language.text('report.category')}: {category}",
                    f"- {language.text('report.severity')}: {severity}",
                    f"- {language.text('report.linked_ids')}: {linked}",
                    f"- {language.text('report.detail')}: {detail}",
                    "",
                ]
            )

    return "\n".join(lines).rstrip() + "\n"


def _localized_finding_title(
    language: LanguagePack,
    category: str,
    metadata: dict[str, object],
    fallback: str,
) -> str:
    key = f"finding.{category}.title"
    return language.text(key, default=fallback, **_stringify_metadata(metadata, language))


def _localized_finding_detail(
    language: LanguagePack,
    category: str,
    metadata: dict[str, object],
    fallback: str,
) -> str:
    key = f"finding.{category}.detail"
    return language.text(key, default=fallback, **_stringify_metadata(metadata, language))


def _stringify_metadata(metadata: dict[str, object], language: LanguagePack) -> dict[str, str]:
    values: dict[str, str] = {}

    for key, value in metadata.items():
        if key == "flags" and isinstance(value, list):
            values[key] = ", ".join(
                language.text(f"flag.{item}", default=str(item)) for item in value
            )
        elif key == "attribute":
            values[key] = language.text(f"attribute.{value}", default=str(value))
        elif isinstance(value, list):
            values[key] = ", ".join(str(item) for item in value)
        else:
            values[key] = str(value)

    return values
