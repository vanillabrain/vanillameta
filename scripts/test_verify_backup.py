"""Targeted operations regression; no database or third-party dependency."""

import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).with_name("verify-backup.py")
SPEC = importlib.util.spec_from_file_location("verify_backup", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class BackupValidationTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "backup"
        (self.root / "uploads" / "source").mkdir(parents=True)
        self.sql = self.root / "metadata.sql"
        self.data = self.root / "uploads/source/data.duckdb"
        self.sql.write_bytes(b"CREATE TABLE example (id INT);\n")
        self.data.write_bytes(b"sample-data")
        descriptor = lambda p: {"bytes": p.stat().st_size,
                                "sha256": hashlib.sha256(p.read_bytes()).hexdigest()}
        self.manifest = {"dump": descriptor(self.sql),
                         "files": {"source/data.duckdb": descriptor(self.data)}}
        self.path = Path(self.temp.name) / "manifest.json"
        self.write_manifest()

    def write_manifest(self):
        self.path.write_text(json.dumps(self.manifest))

    def reject(self):
        with self.assertRaises((ValueError, OSError)):
            MODULE.verify(self.root, self.path)

    def test_valid_set(self):
        self.assertEqual(MODULE.verify(self.root, self.path)["files"], 2)

    def test_valid_empty_uploads(self):
        self.data.unlink()
        self.manifest["files"] = {}
        self.write_manifest()
        self.assertEqual(MODULE.verify(self.root, self.path)["files"], 1)

    def test_manifest_size_boundary(self):
        content = self.path.read_text()
        self.path.write_text(content + " " * (1024 * 1024 - len(content)))
        self.assertEqual(MODULE.verify(self.root, self.path)["files"], 2)
        with self.path.open("a") as stream:
            stream.write(" ")
        self.reject()

    def test_truncated_dump(self):
        self.sql.write_bytes(self.sql.read_bytes()[:-1])
        self.reject()

    def test_same_size_corruption(self):
        for path in (self.sql, self.data):
            with self.subTest(path=path.name):
                original = path.read_bytes()
                path.write_bytes(bytes([original[0] ^ 1]) + original[1:])
                self.reject()
                path.write_bytes(original)

    def test_missing_and_extra_file(self):
        self.data.unlink()
        self.reject()
        self.data.write_bytes(b"sample-data")
        (self.root / "extra.sql").write_text("extra")
        self.reject()

    def test_manifest_missing_invalid_duplicate(self):
        for content in ("{", "[]", '{"files":{},"files":{}}'):
            self.path.write_text(content)
            self.reject()
        self.path.unlink()
        self.reject()

    def test_unsafe_path(self):
        for name in ("../outside", "/outside", "a/../b", "a//b", "a\\b"):
            self.manifest["files"] = {name: self.manifest["dump"]}
            self.write_manifest()
            self.reject()

    def test_symlink(self):
        self.data.unlink()
        self.data.symlink_to(self.sql)
        self.reject()

    def test_invalid_descriptor(self):
        for value in (None, {"bytes": True, "sha256": "a" * 64},
                      {"bytes": 0, "sha256": "a" * 64},
                      {"bytes": 1, "sha256": "invalid"}):
            self.manifest["dump"] = value
            self.write_manifest()
            self.reject()

    def test_cli_rejection_stops_restore_command(self):
        self.sql.write_bytes(b"truncated")
        marker = Path(self.temp.name) / "restore-started"
        result = subprocess.run(
            ["sh", "-c", '"$1" "$2" --backup "$3" --manifest "$4" && touch "$5"',
             "guard", sys.executable, str(SCRIPT), str(self.root), str(self.path), str(marker)],
            capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(marker.exists())
        self.assertNotIn("CREATE TABLE", result.stderr)


if __name__ == "__main__":
    unittest.main()
