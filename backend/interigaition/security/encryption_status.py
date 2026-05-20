"""Runtime checks for local encrypted storage support."""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from typing import Callable


class EncryptionBackend(StrEnum):
    STANDARD_SQLITE = "standard_sqlite"
    SQLCIPHER = "sqlcipher"


@dataclass(frozen=True)
class EncryptionStatus:
    backend: EncryptionBackend
    available: bool
    detail: str
    version: str | None = None
    checked_at: datetime = field(default_factory=lambda: datetime.now(UTC))


def inspect_sqlcipher_status(
    connect: Callable[[], sqlite3.Connection] | None = None,
) -> EncryptionStatus:
    """Return whether the current SQLite runtime exposes SQLCipher features."""

    connection = None
    try:
        connection = connect() if connect is not None else sqlite3.connect(":memory:")
        row = connection.execute("PRAGMA cipher_version").fetchone()
    except sqlite3.DatabaseError as exc:
        return EncryptionStatus(
            backend=EncryptionBackend.STANDARD_SQLITE,
            available=False,
            detail=f"SQLCipher PRAGMA is unavailable: {exc}.",
        )
    finally:
        if connection is not None:
            connection.close()

    if row and row[0]:
        return EncryptionStatus(
            backend=EncryptionBackend.SQLCIPHER,
            available=True,
            version=str(row[0]),
            detail="SQLCipher runtime detected.",
        )

    return EncryptionStatus(
        backend=EncryptionBackend.STANDARD_SQLITE,
        available=False,
        detail="SQLCipher runtime not detected; PRAGMA cipher_version returned no version.",
    )
