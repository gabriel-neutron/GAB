#!/usr/bin/env python3
"""PreToolUse hook: the operator owns the product documents, so a write to one asks first.

docs/authoring.md names the owner of each document. Every other document is free.
Known hole: a shell command run through Bash does not pass here.
"""

import json
import sys

PRODUCT_DOCS = ("docs/prd.md", "docs/decisions.md")

data = json.load(sys.stdin)
path = (data.get("tool_input") or {}).get("file_path", "").replace("\\", "/")
if path.endswith(PRODUCT_DOCS):
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "ask",
            "permissionDecisionReason": "The operator owns this product document (docs/authoring.md).",
        }
    }))
