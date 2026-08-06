#!/usr/bin/env python3
"""
Docs protection hook for Claude Code (PreToolUse).

Keeps the documentation index honest: a new doc may not appear without being
listed in the index, and the index itself may not sprawl.

Behaviour:
- Only runs on write/edit tools.
- Only inspects files under the configured docs directory.
- Blocks creating new docs that are not indexed (skipped entirely if the index
  does not exist yet, so a fresh repo can bootstrap).
- Warns for large docs without a table of contents.
- Optionally blocks an oversized index.

Configuration via environment variables:
- DOCS_DIR_NAME (default: "docs")
- DOCS_INDEX_PATH (default: unset -> <docs dir>/DOCS_INDEX_FILE)
    Path to the index, relative to CLAUDE_PROJECT_DIR. Set this when the index
    lives outside the docs directory -- e.g. "README.md" for a repo-root index.
- DOCS_INDEX_FILE (default: "README.md")
- DOCS_INDEX_MAX_LINES (default: 200)
- DOCS_TOC_THRESHOLD_LINES (default: 250)
- DOCS_TOC_MARKERS (default: "table of contents,contents,table des matieres,sommaire")
- DOCS_BLOCK_UNINDEXED_NEW_FILES (default: "true")
- DOCS_BLOCK_OVERSIZED_INDEX (default: "true")
- DOCS_ALWAYS_SHOW_REMINDER (default: "false")
"""

from __future__ import annotations

import json
import os
import re
import sys
import unicodedata
from pathlib import Path


WRITE_TOOLS = {"Write", "Edit"}


def env_int(name: str, default: int) -> int:
    try:
        return int(os.environ[name])
    except (KeyError, ValueError):
        return default


def env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() == "true"


DOCS_DIR_NAME = os.getenv("DOCS_DIR_NAME", "docs")
DOCS_INDEX_PATH = os.getenv("DOCS_INDEX_PATH")
DOCS_INDEX_FILE = os.getenv("DOCS_INDEX_FILE", "README.md")
DOCS_INDEX_MAX_LINES = env_int("DOCS_INDEX_MAX_LINES", 200)
DOCS_TOC_THRESHOLD_LINES = env_int("DOCS_TOC_THRESHOLD_LINES", 250)
DOCS_TOC_MARKERS = [
    marker.strip().lower()
    for marker in os.getenv(
        "DOCS_TOC_MARKERS",
        "table of contents,contents,table des matieres,sommaire",
    ).split(",")
    if marker.strip()
]
DOCS_BLOCK_UNINDEXED_NEW_FILES = env_bool("DOCS_BLOCK_UNINDEXED_NEW_FILES", True)
DOCS_BLOCK_OVERSIZED_INDEX = env_bool("DOCS_BLOCK_OVERSIZED_INDEX", True)
DOCS_ALWAYS_SHOW_REMINDER = env_bool("DOCS_ALWAYS_SHOW_REMINDER", False)


def deny(reason: str) -> None:
    """Block the tool call. This is the documented PreToolUse decision shape."""
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": reason,
                }
            }
        )
    )


def notify(message: str) -> None:
    """Surface a non-blocking message. systemMessage is the only channel that
    actually reaches a human on PreToolUse -- stdout alone goes to the debug log."""
    print(json.dumps({"systemMessage": message}))


def project_root() -> Path | None:
    raw = os.getenv("CLAUDE_PROJECT_DIR")
    if not raw:
        return None
    try:
        return Path(raw).expanduser().resolve()
    except OSError:
        return None


def to_path(raw_path: str) -> Path:
    return Path(raw_path).expanduser().resolve()


def find_docs_root(target_path: Path) -> Path | None:
    """Resolve the docs directory this file belongs to.

    Anchored to the project root when CLAUDE_PROJECT_DIR is available, so a
    vendored `node_modules/**/docs/` cannot masquerade as the project's docs.
    """
    root = project_root()
    if root is not None:
        docs_root = root / DOCS_DIR_NAME
        try:
            target_path.relative_to(docs_root)
        except ValueError:
            return None
        return docs_root

    for candidate in target_path.parents:
        if candidate.name == DOCS_DIR_NAME:
            return candidate
    return None


def resolve_index(docs_root: Path) -> Path:
    """The index may live outside the docs directory (e.g. at the repo root)."""
    if DOCS_INDEX_PATH:
        root = project_root()
        if root is not None:
            return (root / DOCS_INDEX_PATH).resolve()
        return (docs_root.parent / DOCS_INDEX_PATH).resolve()
    return docs_root / DOCS_INDEX_FILE


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def count_lines(path: Path) -> int:
    if not path.exists():
        return 0
    with path.open("r", encoding="utf-8", errors="ignore") as handle:
        return sum(1 for _ in handle)


def strip_accents(text: str) -> str:
    return "".join(
        ch for ch in unicodedata.normalize("NFD", text) if not unicodedata.combining(ch)
    )


def has_table_of_contents(text: str) -> bool:
    header = strip_accents(text[:5000].lower())
    return any(marker in header for marker in DOCS_TOC_MARKERS)


def load_indexed_docs(index_path: Path) -> set[str]:
    content = read_text(index_path)

    # Backticked mentions: `spec.md`
    indexed = {
        Path(name).name.lower()
        for name in re.findall(r"`([^`]+\.md)`", content, flags=re.IGNORECASE)
    }

    # Markdown links, tolerating anchors and link titles:
    #   [Spec](spec.md)  [Spec](./spec.md#schema)  [Spec](spec.md "Technical spec")
    indexed.update(
        Path(name).name.lower()
        for name in re.findall(
            r"\[[^\]]*\]\(\s*<?([^)\s#\"']+\.md)", content, flags=re.IGNORECASE
        )
    )

    # Bare mentions in plain-text lists: "- spec.md - the technical spec"
    indexed.update(
        Path(name).name.lower()
        for name in re.findall(r"(?<![\w./`(\[])([\w.-]+\.md)\b", content, flags=re.IGNORECASE)
    )
    return indexed


def build_reminder(index_label: str) -> str:
    return (
        "Documentation reminder:\n"
        "- Prefer updating an existing doc before creating a new one.\n"
        f"- Keep `{index_label}` as a lightweight index.\n"
        "- Ensure long docs include a table of contents."
    )


def main() -> None:
    try:
        hook_input = json.load(sys.stdin)
    except json.JSONDecodeError:
        return

    tool_name = hook_input.get("tool_name", "")
    if tool_name not in WRITE_TOOLS:
        return

    tool_input = hook_input.get("tool_input", {}) or {}
    raw_path = tool_input.get("file_path")
    if not raw_path:
        return

    file_path = to_path(raw_path)
    docs_root = find_docs_root(file_path)
    if not docs_root:
        return

    index_path = resolve_index(docs_root)
    index_label = DOCS_INDEX_PATH or DOCS_INDEX_FILE
    is_docs_index = file_path == index_path

    # `content` is a whole file (Write). Edit supplies only a fragment, which
    # cannot be used to size anything.
    new_content = tool_input.get("content") if tool_name == "Write" else None

    # Rule 1: the index must stay small. Sized from the incoming content, never
    # max()'d against the old length -- otherwise the edit that shrinks an
    # oversized index is the one edit that gets blocked.
    if DOCS_BLOCK_OVERSIZED_INDEX and is_docs_index and isinstance(new_content, str):
        line_count = len(new_content.splitlines())
        if line_count > DOCS_INDEX_MAX_LINES:
            deny(
                f"Blocked: `{index_label}` would be {line_count} lines. "
                f"Keep it under {DOCS_INDEX_MAX_LINES} -- it is an index, not a document.\n"
                + build_reminder(index_label)
            )
            return

    # Rule 2: a new doc must be listed in the index first. Skipped when the index
    # does not exist yet, so a fresh repo is not deadlocked into never creating one.
    if (
        DOCS_BLOCK_UNINDEXED_NEW_FILES
        and not is_docs_index
        and not file_path.exists()
        and file_path.suffix.lower() == ".md"
        and index_path.exists()
    ):
        if file_path.name.lower() not in load_indexed_docs(index_path):
            deny(
                f"Blocked: `{file_path.name}` is not listed in `{index_label}`. "
                "Add it to the index first.\n" + build_reminder(index_label)
            )
            return

    # Rule 3: warn about long docs with no table of contents. Judged on the
    # content being written, so the edit that ADDS a ToC is not itself warned about.
    if not is_docs_index and file_path.suffix.lower() == ".md":
        if isinstance(new_content, str):
            body, line_count = new_content, len(new_content.splitlines())
        elif file_path.exists():
            body, line_count = read_text(file_path), count_lines(file_path)
        else:
            body, line_count = "", 0

        if line_count > DOCS_TOC_THRESHOLD_LINES and not has_table_of_contents(body):
            notify(
                f"Warning: `{file_path.name}` is {line_count} lines "
                "with no table of contents."
            )
            return

    if DOCS_ALWAYS_SHOW_REMINDER:
        notify(build_reminder(index_label))


if __name__ == "__main__":
    main()
