// Block `gh pr merge` unless the pull request targets `staging`.
// Block each `gh api` call whose path ends in `/merge`.
const { execFileSync } = require("child_process");

// Flags of `gh pr merge` that take a value as the next word.
const VALUE_FLAGS = new Set([
  "-b", "--body", "-F", "--body-file", "-t", "--subject", "-A", "--author-email",
  "--match-head-commit", "-R", "--repo",
]);

const unquote = (word) => word.replace(/^["']+|["']+$/g, "");

// Pure parsing. Return one entry for each `gh pr merge` in the command.
function parseMerges(cmd) {
  const merges = [];
  for (const part of cmd.split(/&&|\|\||[;|\n]/)) {
    const m = part.match(/\bgh\s+pr\s+merge\b(.*)$/s);
    if (!m) continue;
    const words = (m[1].match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map(unquote);
    let selector = null;
    let repo = null;
    let admin = false;
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (w === "--admin") admin = true;
      else if (VALUE_FLAGS.has(w)) {
        if (w === "-R" || w === "--repo") repo = words[i + 1] ?? null;
        i++;
      } else if (w.startsWith("--repo=")) repo = w.slice(7);
      else if (w.startsWith("-")) continue;
      else if (selector === null) selector = w;
    }
    merges.push({ selector, repo, admin });
  }
  return merges;
}

// True when a `gh api` call has a path that ends in `/merge`.
function hasApiMerge(cmd) {
  for (const part of cmd.split(/&&|\|\||[;|\n]/)) {
    const m = part.match(/\bgh\s+api\b(.*)$/s);
    if (!m) continue;
    const words = (m[1].match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map(unquote);
    if (words.some((w) => /\/merge\/?(\?.*)?$/.test(w))) return true;
  }
  return false;
}

// Decide with a reader for the base branch. The reader gets a selector (or null) and a repo
// (or null). It returns the base name, or null when it cannot read it.
function decide(cmd, readBase) {
  if (hasApiMerge(cmd)) return { allow: false };
  for (const merge of parseMerges(cmd)) {
    if (merge.admin) return { allow: false };
    if (readBase(merge.selector, merge.repo) !== "staging") return { allow: false };
  }
  return { allow: true };
}

function ghBase(selector, repo) {
  const args = ["pr", "view"];
  if (selector !== null) args.push(selector);
  if (repo !== null) args.push("-R", repo);
  args.push("--json", "baseRefName", "--jq", ".baseRefName");
  try {
    return execFileSync("gh", args, { encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
}

module.exports = { parseMerges, hasApiMerge, decide };

if (require.main === module) {
  let raw = "";
  process.stdin.on("data", (c) => (raw += c));
  process.stdin.on("end", () => {
    const cmd = JSON.parse(raw).tool_input?.command ?? "";
    if (decide(cmd, ghBase).allow) process.exit(0);
    console.error("Merge refused: the pull request must target staging, with no --admin. Ask the operator.");
    process.exit(2);
  });
}
