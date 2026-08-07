#!/usr/bin/env python3
"""
Docs protection hook for Claude Code (PreToolUse).

Keeps the documentation index honest: a new doc may not appear without being
listed in the index, and the index itself may not sprawl.

Behaviour:
- Only runs on write/edit tools.
- Inspects files under the docs directory, plus the index wherever it lives.
- Blocks creating new docs that are not indexed. Index entries may name a
  subdirectory (`agents/domain.md`), and whole directories can be exempted.
- Blocks an oversized index.
- Asks the operator to confirm every other write inside the docs directory. The
  operator owns `docs/`; an agent proposes, the operator decides. A long new
  document with no table of contents is named in the same question.

Known hole: this hook sees Write, Edit and NotebookEdit only. A shell command
run through Bash can still change a document without passing here.

This project: the index is `docs/README.md`, `docs/agents/` holds the agent
configuration, and `docs/adr/` holds architecture decision records. ADRs are
exempt from indexing -- they are numbered, they multiply, and `docs/agents/
domain.md` governs them instead of the index.

Configuration via environment variables:
- DOCS_DIR_NAME (default: "docs")
- DOCS_INDEX_PATH (default: unset -> <docs dir>/DOCS_INDEX_FILE)
    Path to the index, relative to CLAUDE_PROJECT_DIR. Set this when the index
    does not sit directly in the docs directory -- this project uses
    "docs/README.md".
- DOCS_INDEX_FILE (default: "README.md")
- DOCS_INDEX_EXEMPT_DIRS (default: "adr")
    Comma-separated directories under the docs root whose files need no index
    entry. Matched on the first path component.
- DOCS_INDEX_MAX_LINES (default: 200)
- DOCS_TOC_THRESHOLD_LINES (default: 250)
- DOCS_TOC_MARKERS (default: "table of contents,contents,table des matieres,sommaire")
- DOCS_BLOCK_UNINDEXED_NEW_FILES (default: "true")
- DOCS_BLOCK_OVERSIZED_INDEX (default: "true")
- DOCS_ASK_ON_WRITE (default: "true")
    Ask the operator to confirm every write inside the docs directory. Set to
    "false" to let an agent change a document with no question.
- DOCS_ALWAYS_SHOW_REMINDER (default: "false")
"""

from __future__ import annotations

import json
import os
import re
import sys
import unicodedata
from pathlib import Path


WRITE_TOOLS = {"Write", "Edit", "NotebookEdit"}


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
DOCS_INDEX_EXEMPT_DIRS = {
    part.strip().strip("/").lower()
    for part in os.getenv("DOCS_INDEX_EXEMPT_DIRS", "adr").split(",")
    if part.strip()
}
DOCS_BLOCK_UNINDEXED_NEW_FILES = env_bool("DOCS_BLOCK_UNINDEXED_NEW_FILES", True)
DOCS_BLOCK_OVERSIZED_INDEX = env_bool("DOCS_BLOCK_OVERSIZED_INDEX", True)
DOCS_ASK_ON_WRITE = env_bool("DOCS_ASK_ON_WRITE", True)
DOCS_ALWAYS_SHOW_REMINDER = env_bool("DOCS_ALWAYS_SHOW_REMINDER", False)


def decide(decision: str, reason: str) -> None:
    """Emit a PreToolUse decision. `deny` refuses; `ask` puts it to the operator."""
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": decision,
                    "permissionDecisionReason": reason,
                }
            }
        )
    )


def deny(reason: str) -> None:
    """Block the tool call outright."""
    decide("deny", reason)


def ask(reason: str) -> None:
    """Hand the decision to the operator. The operator owns `docs/`."""
    decide("ask", reason)


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


def resolve_index(docs_root: Path | None) -> Path | None:
    """The index may live outside the docs directory (e.g. at the repo root).

    Returns None only when the index cannot be located at all, which happens
    when DOCS_INDEX_PATH is unset and the file is not under the docs directory.
    """
    if DOCS_INDEX_PATH:
        root = project_root()
        if root is not None:
            return (root / DOCS_INDEX_PATH).resolve()
        if docs_root is not None:
            return (docs_root.parent / DOCS_INDEX_PATH).resolve()
        return None
    if docs_root is None:
        return None
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
    """Collect the documents the index names.

    Entries keep any subdirectory they were written with, so `agents/domain.md`
    permits exactly that path and not a same-named file elsewhere. A bare name
    stays a bare name and matches on filename alone.
    """
    content = read_text(index_path)
    raw: set[str] = set()

    # Backticked mentions: `spec.md`, `agents/domain.md`
    raw.update(re.findall(r"`([^`]+\.md)`", content, flags=re.IGNORECASE))

    # Markdown links, tolerating anchors and link titles:
    #   [Spec](spec.md)  [Spec](./spec.md#schema)  [Spec](spec.md "Technical spec")
    raw.update(
        re.findall(r"\[[^\]]*\]\(\s*<?([^)\s#\"']+\.md)", content, flags=re.IGNORECASE)
    )

    # Bare mentions in plain-text lists: "- spec.md - the technical spec".
    # The hyphen belongs in the lookbehind: without it, `triage-labels.md`
    # also yields a phantom `labels.md` entry that permits a file nobody listed.
    raw.update(
        re.findall(r"(?<![\w./\-`(\[])([\w.-]+\.md)\b", content, flags=re.IGNORECASE)
    )

    indexed: set[str] = set()
    for entry in raw:
        rel = entry.replace("\\", "/").lower().lstrip("/")
        while rel.startswith("./"):
            rel = rel[2:]
        # An index outside the docs dir names entries as `docs/spec.md`; an index
        # inside it names them `spec.md`. Accept both spellings.
        if rel.startswith(f"{DOCS_DIR_NAME.lower()}/"):
            rel = rel[len(DOCS_DIR_NAME) + 1 :]
        if rel:
            indexed.add(rel)
    return indexed


def is_indexed(file_path: Path, docs_root: Path, indexed: set[str]) -> bool:
    """A file counts as indexed by its path under docs/, or by its bare name."""
    try:
        rel = file_path.relative_to(docs_root).as_posix().lower()
    except ValueError:
        return False
    return rel in indexed or file_path.name.lower() in indexed


def is_exempt(file_path: Path, docs_root: Path) -> bool:
    """Files in an exempt directory need no index entry (ADRs, by default)."""
    try:
        parts = file_path.relative_to(docs_root).parts
    except ValueError:
        return False
    return len(parts) > 1 and parts[0].lower() in DOCS_INDEX_EXEMPT_DIRS


def build_reminder(index_label: str) -> str:
    return (
        "Documentation reminder:\n"
        "- Prefer updating an existing doc before creating a new one.\n"
        f"- Keep `{index_label}` as a lightweight index.\n"
        "- Ensure long docs include a table of contents."
    )


def main() -> None:
    # A payload that is valid JSON but the wrong shape must not raise. A traceback
    # here is exit code 1, which lets the call through with noise on the operator's
    # screen -- two false alarms train them to ignore the one real block.
    # `lstrip` the BOM: a Windows caller that pipes UTF-8 through PowerShell
    # prepends U+FEFF, and json.load then raises. That failure is silent and it
    # fails OPEN, which turns the whole guard off with no signal.
    try:
        hook_input = json.loads(sys.stdin.read().lstrip("﻿").strip() or "null")
    except (json.JSONDecodeError, UnicodeDecodeError):
        return
    if not isinstance(hook_input, dict):
        return

    tool_name = hook_input.get("tool_name", "")
    if tool_name not in WRITE_TOOLS:
        return

    tool_input = hook_input.get("tool_input")
    if not isinstance(tool_input, dict):
        return

    # NotebookEdit names its target `notebook_path`, every other write tool
    # names it `file_path`.
    raw_path = tool_input.get("file_path") or tool_input.get("notebook_path")
    if not isinstance(raw_path, str) or not raw_path:
        return

    try:
        file_path = to_path(raw_path)
    except (OSError, ValueError):
        return
    docs_root = find_docs_root(file_path)
    index_path = resolve_index(docs_root)
    index_label = DOCS_INDEX_PATH or DOCS_INDEX_FILE
    is_docs_index = index_path is not None and file_path == index_path

    # The index itself is checked wherever it lives. Resolving it before this
    # early return is what lets Rule 1 fire for an index at the repository root,
    # which sits outside the docs directory.
    if docs_root is None and not is_docs_index:
        return

    # `content` is a whole file (Write). Edit supplies only a fragment, which
    # cannot be used to size anything.
    new_content = tool_input.get("content") if tool_name == "Write" else None
    if not isinstance(new_content, str):
        new_content = None

    # Rule 1: the index must stay small. Sized from the incoming content, never
    # max()'d against the old length -- otherwise the edit that shrinks an
    # oversized index is the one edit that gets blocked.
    if DOCS_BLOCK_OVERSIZED_INDEX and is_docs_index and new_content is not None:
        line_count = len(new_content.splitlines())
        if line_count > DOCS_INDEX_MAX_LINES:
            deny(
                f"Blocked: `{index_label}` would be {line_count} lines. "
                f"Keep it under {DOCS_INDEX_MAX_LINES} -- it is an index, not a document.\n"
                + build_reminder(index_label)
            )
            return

    # Rule 2: a new doc must be listed in the index first.
    if (
        DOCS_BLOCK_UNINDEXED_NEW_FILES
        and docs_root is not None
        and not file_path.exists()
        and file_path.suffix.lower() == ".md"
        and not is_exempt(file_path, docs_root)
    ):
        if index_path is None:
            return
        if not index_path.exists():
            # Fail CLOSED when the index location was configured explicitly. A
            # configured index that is missing means the configuration is broken,
            # and silently skipping the rule turns the guard off with no signal.
            # Only the unconfigured case stays open, so a fresh repo can bootstrap.
            if DOCS_INDEX_PATH:
                deny(
                    f"Blocked: the configured doc index `{index_label}` does not exist, "
                    "so new documents cannot be checked against it. Restore the index, "
                    "or clear DOCS_INDEX_PATH."
                )
            return
        if not is_indexed(file_path, docs_root, load_indexed_docs(index_path)):
            rel = file_path.relative_to(docs_root).as_posix()
            deny(
                f"Blocked: `{rel}` is not listed in `{index_label}`. "
                "Add it to the index first.\n" + build_reminder(index_label)
            )
            return

    # Rule 3: the operator owns `docs/`. Every remaining write inside the docs
    # directory goes to them as a question, not through as a fact.
    if DOCS_ASK_ON_WRITE and docs_root is not None:
        rel = file_path.name
        try:
            rel = file_path.relative_to(docs_root).as_posix()
        except ValueError:
            pass

        verb = "create" if not file_path.exists() else "change"
        notes = []

        # A long document with no table of contents is named in the same question,
        # rather than as a second message the operator learns to skip. Judged on
        # the content being written, so only a Write can be judged: an Edit
        # supplies a fragment, and sizing that against the file on disk would flag
        # every edit to an already-long document.
        if (
            new_content is not None
            and file_path.suffix.lower() == ".md"
            and len(new_content.splitlines()) > DOCS_TOC_THRESHOLD_LINES
            and not has_table_of_contents(new_content)
        ):
            notes.append(
                f"It would be {len(new_content.splitlines())} lines with no table of "
                "contents."
            )

        reason = f"An agent wants to {verb} `{DOCS_DIR_NAME}/{rel}`. You own `docs/`."
        if notes:
            reason += " " + " ".join(notes)
        ask(reason)
        return

    if DOCS_ALWAYS_SHOW_REMINDER:
        notify(build_reminder(index_label))


if __name__ == "__main__":
    main()
