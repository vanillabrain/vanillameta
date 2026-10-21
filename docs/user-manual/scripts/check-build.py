#!/usr/bin/env python3
"""Validate generated user-guide files, local links/anchors and source boundary."""

from html.parser import HTMLParser
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit


class Document(HTMLParser):
    def __init__(self, text):
        self.links = []
        self.ids = set()
        super().__init__()
        self.feed(text)

    def handle_starttag(self, tag, attributes):
        attributes = dict(attributes)
        if "id" in attributes:
            self.ids.add(attributes["id"])
        if tag in ("a", "link") and "href" in attributes:
            self.links.append(attributes["href"])
        if tag in ("img", "script") and "src" in attributes:
            self.links.append(attributes["src"])


manual = Path(__file__).resolve().parents[1]
root = (Path(sys.argv[1]) if len(sys.argv) > 1 else manual / ".vitepress/dist").resolve()
base = sys.argv[2] if len(sys.argv) > 2 else "/"
documents = {path: Document(path.read_text()) for path in root.glob("*.html")}
errors = []
references = 0
expected = {path.stem + ".html" for path in (manual / "site").glob("*.md")} | {"404.html"}
if {path.name for path in documents} != expected:
    errors.append(("site", "pages", "unexpected or missing HTML pages"))
for path in root.rglob("*"):
    if path.is_file() and path.suffix in (".html", ".js", ".json"):
        if re.search(r"private-reference/|docs/testing/|docs/plans/|/Users/", path.read_text()):
            errors.append((path.name, "content", "internal path in generated output"))
for source, document in documents.items():
    for href in document.links:
        url = urlsplit(href)
        if url.scheme or url.netloc:
            continue
        path = unquote(url.path)
        if path.startswith("/"):
            if not path.startswith(base):
                errors.append((source.name, href, "wrong base"))
                continue
            destination = root / path[len(base):]
        else:
            destination = source.parent / path
        if not path:
            destination = source
        if destination == root or str(destination).endswith("/"):
            destination = destination / "index.html"
        if not destination.exists() and not destination.suffix:
            destination = destination.with_suffix(".html")
        destination = destination.resolve()
        references += 1
        if not destination.is_relative_to(root) or not destination.exists():
            errors.append((source.name, href, "missing or outside file"))
            continue
        if url.fragment and destination in documents:
            if unquote(url.fragment) not in documents[destination].ids:
                errors.append((source.name, href, "missing anchor"))
print({"pages": len(documents), "localReferences": references, "errors": errors})
sys.exit(bool(errors))
