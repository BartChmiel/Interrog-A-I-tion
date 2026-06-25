"""Small language-pack loader for user-facing strings."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path


DEFAULT_LOCALE = "en"
SUPPORTED_LOCALES = ("en", "pl")
PROJECT_ROOT = Path(__file__).resolve().parents[3]


@dataclass(frozen=True)
class LanguagePack:
    locale: str
    messages: dict[str, str]
    fallback_messages: dict[str, str]

    def text(self, key: str, default: str | None = None, **params: str) -> str:
        template = self.messages.get(key) or self.fallback_messages.get(key) or default or key
        return template.format(**params)


def load_language_pack(
    locale: str,
    namespace: str,
    locales_root: Path | None = None,
) -> LanguagePack:
    """Load a language pack namespace with English fallback."""

    root = locales_root or PROJECT_ROOT / "locales"
    normalized_locale = normalize_locale(locale)
    fallback_messages = _load_namespace(root, DEFAULT_LOCALE, namespace)
    messages = _load_namespace(root, normalized_locale, namespace)

    return LanguagePack(
        locale=normalized_locale,
        messages=messages,
        fallback_messages=fallback_messages,
    )


def normalize_locale(locale: object) -> str:
    if not isinstance(locale, str):
        return DEFAULT_LOCALE
    normalized = locale.strip().lower().split("-")[0]
    if normalized not in SUPPORTED_LOCALES:
        return DEFAULT_LOCALE
    return normalized


def _load_namespace(root: Path, locale: str, namespace: str) -> dict[str, str]:
    path = root / locale / f"{namespace}.json"
    if not path.exists():
        return {}

    data = json.loads(path.read_text(encoding="utf-8"))
    return {str(key): str(value) for key, value in data.items()}
