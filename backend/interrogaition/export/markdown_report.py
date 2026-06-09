"""Markdown report export for deterministic interview reviews."""

from __future__ import annotations

from interrogaition.analysis.interview_review import InterviewReview
from interrogaition.domain.indicators import Indicator
from interrogaition.domain.models import Case
from interrogaition.i18n.localization import LanguagePack, load_language_pack


def render_review_markdown(
    case: Case,
    review: InterviewReview,
    locale: str = "en",
    indicators: tuple[Indicator, ...] = (),
) -> str:
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
    ]

    if indicators:
        lines.extend(_render_indicators(language, indicators))

    lines.extend(
        [
            f"## {language.text('report.findings_heading')}",
            "",
        ]
    )

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


def _render_indicators(language: LanguagePack, indicators: tuple[Indicator, ...]) -> list[str]:
    lines = [
        f"## {language.text('report.indicators_heading')}",
        "",
        language.text("report.indicators_disclaimer"),
        "",
    ]

    for indicator in indicators:
        category = language.text(
            f"indicator_category.{indicator.category.value}",
            default=indicator.category.value,
        )
        label = language.text(f"indicator.{indicator.id}.label", default=indicator.label)
        description = language.text(
            f"indicator.{indicator.id}.description",
            default=indicator.description,
        )
        interpretation = language.text(
            f"indicator.{indicator.id}.interpretation",
            default=indicator.interpretation,
        )
        limitations = tuple(
            language.text(f"indicator.{indicator.id}.limitation.{index}", default=limitation)
            for index, limitation in enumerate(indicator.limitations, start=1)
        )

        lines.extend(
            [
                f"### {label}",
                "",
                f"- {language.text('report.category')}: {category}",
                f"- {language.text('report.score')}: {_format_score(indicator.score)}",
                f"- {language.text('report.score_bar')}: {_score_bar(indicator.score)}",
                f"- {language.text('report.color_band')}: {language.text(f'color.{_score_band(indicator.score)}')}",
                f"- {language.text('report.confidence')}: {indicator.confidence:.2f}",
                f"- {language.text('report.detail')}: {description}",
                f"- {language.text('report.interpretation')}: {interpretation}",
            ]
        )

        if limitations:
            lines.append(f"- {language.text('report.limitations')}: {'; '.join(limitations)}")

        if indicator.factors:
            lines.append(f"- {language.text('report.factors')}:")
            for factor in indicator.factors:
                factor_label = language.text(f"factor.{factor.id}.label", default=factor.label)
                lines.append(f"  - {factor_label}: {factor.value}")

        lines.append("")

    return lines


def _format_score(score: float | None) -> str:
    if score is None:
        return "n/a"

    return f"{score:.2f}"


def _score_bar(score: float | None, width: int = 10) -> str:
    if score is None:
        return "[----------]"

    filled = round(max(0.0, min(1.0, score)) * width)
    return f"[{'#' * filled}{'-' * (width - filled)}]"


def _score_band(score: float | None) -> str:
    if score is None:
        return "gray"
    if score >= 0.8:
        return "green"
    if score >= 0.6:
        return "yellow"
    return "red"


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
