#!/usr/bin/env python3
"""Offline preflight for a quiesced metadata.sql + uploads backup set.

Use a separately trusted manifest. Run restore only on exit 0; this does not
authenticate a rewritten manifest or lock files against concurrent modification.
"""

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import sys


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate manifest key")
        result[key] = value
    return result


def verify(root, manifest_path):
    root, manifest_path = Path(root).absolute(), Path(manifest_path).absolute()
    if root.is_symlink() or not root.is_dir():
        raise ValueError("backup directory missing or symlink")
    if manifest_path.is_symlink() or not manifest_path.is_file():
        raise ValueError("manifest missing or symlink")
    if manifest_path.stat().st_size > 1024 * 1024:
        raise ValueError("manifest exceeds 1 MiB")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"),
                          object_pairs_hook=unique_object)
    if not isinstance(manifest, dict):
        raise ValueError("manifest must be an object")
    files = manifest.get("files")
    if not isinstance(files, dict):
        raise ValueError("manifest files must be an object")
    expected = {"metadata.sql": manifest.get("dump")}
    for name, entry in files.items():
        path = PurePosixPath(name)
        if (not name or path.is_absolute() or ".." in path.parts
                or "\\" in name or path.as_posix() != name):
            raise ValueError("unsafe manifest path")
        expected["uploads/" + name] = entry
    for name, entry in expected.items():
        if (not isinstance(entry, dict) or type(entry.get("bytes")) is not int
                or entry["bytes"] < (1 if name == "metadata.sql" else 0)
                or not isinstance(entry.get("sha256"), str)
                or not re.fullmatch(r"[0-9a-f]{64}", entry["sha256"])):
            raise ValueError("invalid file descriptor")
    actual = set()
    for path in root.rglob("*"):
        if path.is_symlink():
            raise ValueError("symlink in backup")
        if path.is_dir():
            continue
        if not path.is_file():
            raise ValueError("non-regular file in backup")
        if path == manifest_path:
            continue
        actual.add(path.relative_to(root).as_posix())
    if actual != set(expected):
        raise ValueError("backup file inventory mismatch")
    total = 0
    for name, entry in expected.items():
        path = root / name
        if path.stat().st_size != entry["bytes"]:
            raise ValueError("backup size mismatch: " + name)
        digest = hashlib.sha256()
        with path.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
        if digest.hexdigest() != entry["sha256"]:
            raise ValueError("backup SHA-256 mismatch: " + name)
        total += entry["bytes"]
    return {"status": "verified", "files": len(expected), "bytes": total}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backup", required=True, type=Path)
    parser.add_argument("--manifest", required=True, type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(verify(args.backup, args.manifest)))
        return 0
    except (OSError, ValueError, TypeError, RecursionError) as error:
        # Do not print manifest/dump contents or database credentials.
        print("Backup rejected: " + str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
