#!/usr/bin/env python3
"""SessionEnd hook: a session that started its own Docker stack removes it.

The machine runs many sessions, and a stack left behind holds RAM until somebody removes it.
The check is fast: a checkout with no stack block in infra/.env, or the main checkout, stops here.
"""

import json
import os
import subprocess
import sys

MARK = "# >>> session stack"


def git(cwd, *args):
    done = subprocess.run(["git", "-C", cwd, *args], capture_output=True, text=True)
    return done.stdout.strip() if done.returncode == 0 else ""


try:
    cwd = json.load(sys.stdin).get("cwd") or os.getcwd()
except ValueError:
    sys.exit(0)

root = git(cwd, "rev-parse", "--show-toplevel")
if not root:
    sys.exit(0)

env_file = os.path.join(root, "infra", ".env")
try:
    with open(env_file, encoding="utf-8") as handle:
        if MARK not in handle.read():
            sys.exit(0)
except OSError:
    sys.exit(0)

listing = git(root, "worktree", "list", "--porcelain").splitlines()
main = listing[0].removeprefix("worktree ") if listing else ""
if not main or os.path.realpath(main) == os.path.realpath(root):
    sys.exit(0)

# The hook never blocks the end of a session, so a failed removal only prints.
subprocess.run("pnpm stack:down", cwd=root, shell=True, stdout=sys.stderr)
sys.exit(0)
