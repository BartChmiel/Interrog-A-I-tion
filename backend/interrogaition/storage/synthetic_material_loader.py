"""Load synthetic starter materials from JSON."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from interrogaition.i18n.localization import normalize_locale
from interrogaition.storage.material_registry import MaterialSourceType


@dataclass(frozen=True)
class SyntheticMaterial:
    id: str
    title: str
    description: str
    source_type: MaterialSourceType
    tags: tuple[str, ...]
    content: str


def load_synthetic_materials(path: Path, locale: str = "en") -> tuple[SyntheticMaterial, ...]:
    """Load synthetic starter materials from a case materials JSON file."""

    if not path.exists():
        return ()

    data = json.loads(path.read_text(encoding="utf-8"))
    normalized_locale = normalize_locale(locale)
    return tuple(_load_material(item, normalized_locale) for item in data.get("materials", []))


def _load_material(data: dict[str, Any], locale: str) -> SyntheticMaterial:
    return SyntheticMaterial(
        id=str(data["id"]),
        title=_localized_value(data, "title", locale),
        description=_localized_value(data, "description", locale),
        source_type=MaterialSourceType(str(data.get("source_type", MaterialSourceType.TEXT_NOTE.value))),
        tags=tuple(str(tag) for tag in data.get("tags", [])),
        content=_localized_value(data, "content", locale),
    )


def _localized_value(data: dict[str, Any], key: str, locale: str) -> str:
    localized = data.get(f"{key}_i18n", {})
    if isinstance(localized, dict):
        value = localized.get(locale) or localized.get("en")
        if value is not None:
            return str(value)

    return str(data.get(key, ""))
