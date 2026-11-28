// M0 audit helper: list every public repository of github.com/wechat-miniprogram
// with license, last push date, archived state, size and relevance.
// Run: node scripts/m0-wechat-repos.mjs > docs/audit/wechat-miniprogram-repos.md
// It is a one-off audit tool, not part of the new runtime.

const OUT = [];
for (let page = 1; page <= 3; page++) {
  const res = await fetch(
    `https://api.github.com/orgs/wechat-miniprogram/repos?per_page=100&page=${page}&sort=full_name`,
    { headers: { Accept: "application/vnd.github+json", "User-Agent": "qchat-m0-audit" } },
  );
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) break;
  OUT.push(...data);
}
OUT.sort((a, b) => a.name.localeCompare(b.name));

const RELEVANT = new Set([
  "glass-easel", "glass-easel-analyzer", "glass-easel-devtools",
  "api-typings", "miniprogram-demo", "miniprogram-simulate",
  "miniprogram-api-promise", "miniprogram-ci-dist", "miniprogram-compat",
  "miniprogram-component-plus", "miniprogram-custom-component",
  "weui-miniprogram", "miniprogram-slim", "j-component",
  "miniprogram-cli", "miniprogram-mock", "miniprogram-hooks",
  "mpflow", "recycle-view", "float-pigment",
]);

const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const lines = [];
lines.push("# Public repositories of `wechat-miniprogram` (M0 audit)");
lines.push("");
lines.push(`Retrieved ${new Date().toISOString().slice(0, 10)} from the GitHub REST API.`);
lines.push(`Total public repositories: ${OUT.length}. License is the SPDX id reported by GitHub; "none" means GitHub found no recognised license file (treated as not reusable, section 6.1).`);
lines.push("");
lines.push("| Repository | License | Last push | Archived | Size (KB) | Stars | Relevance to this project | Description |");
lines.push("|---|---|---|---|---|---|---|---|");
for (const r of OUT) {
  const rel = RELEVANT.has(r.name) ? "evaluated" : "none found";
  lines.push(
    `| [${esc(r.name)}](https://github.com/wechat-miniprogram/${esc(r.name)}) | ${esc(r.license?.spdx_id ?? "none")} | ${esc((r.pushed_at ?? "").slice(0, 10))} | ${r.archived ? "archived" : "active"} | ${r.size} | ${r.stargazers_count} | ${rel} | ${esc(r.description)} |`,
  );
}
lines.push("");
lines.push("## Notes");
lines.push("");
lines.push("- `miniprogram-ci` and `miniprogram-compiler` are not published as public repositories in this organisation; the npm packages are referenced separately in ADR 001 and were not reused.");
lines.push("- `miniprogram-api-promise` reports no licence. Per section 6.1 it is treated as not reusable.");
lines.push("- No code from this organisation is copied in M0. The typings and the demo are used as behaviour references only.");
console.log(lines.join("\n"));
