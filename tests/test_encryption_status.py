import unittest

from interrogaition.security.encryption_status import (
    EncryptionBackend,
    inspect_sqlcipher_status,
)


class EncryptionStatusTest(unittest.TestCase):
    def test_detects_sqlcipher_when_cipher_version_is_available(self) -> None:
        status = inspect_sqlcipher_status(connect=lambda: _FakeConnection(("4.6.1",)))

        self.assertTrue(status.available)
        self.assertEqual(status.backend, EncryptionBackend.SQLCIPHER)
        self.assertEqual(status.version, "4.6.1")

    def test_reports_standard_sqlite_when_cipher_version_is_missing(self) -> None:
        status = inspect_sqlcipher_status(connect=lambda: _FakeConnection(None))

        self.assertFalse(status.available)
        self.assertEqual(status.backend, EncryptionBackend.STANDARD_SQLITE)
        self.assertIn("not detected", status.detail)


class _FakeConnection:
    def __init__(self, row: tuple[str] | None) -> None:
        self.row = row
        self.closed = False

    def execute(self, _: str) -> "_FakeConnection":
        return self

    def fetchone(self) -> tuple[str] | None:
        return self.row

    def close(self) -> None:
        self.closed = True


if __name__ == "__main__":
    unittest.main()
