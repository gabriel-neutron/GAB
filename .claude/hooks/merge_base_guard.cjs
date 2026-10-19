// Block `gh pr merge` unless the pull request targets `staging`.
const { execFileSync } = require("child_process");
let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  const cmd = JSON.parse(raw).tool_input?.command ?? "";
  const m = cmd.match(/gh pr merge\s+(\d+)/);
  if (!m) process.exit(0);
  let base = "";
  try {
    base = execFileSync("gh", ["pr", "view", m[1], "--json", "baseRefName", "--jq", ".baseRefName"], { encoding: "utf8" }).trim();
  } catch {}
  if (base === "staging" && !/--admin/.test(cmd)) process.exit(0);
  console.error("Merge refused: the pull request must target staging, with no --admin. Ask the operator.");
  process.exit(2);
});
