#!/usr/bin/env node
/**
 * Guard for the Mini App migration (section 12.2): new modules must never import
 * the legacy QApp runtime, the legacy SDK or the legacy Flutter tree. A single
 * accidental import would make "complete removal" unprovable at M11.
 *
 * Usage: node scripts/check-miniapp-isolation.mjs
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const ROOTS = [
  "packages/miniapp-contracts",
  "packages/miniapp-service-runtime",
  "packages/miniapp-view-runtime",
  "packages/miniapp-view-web",
  "packages/miniapp-compiler",
  "packages/miniapp-test-harness",
  "packages/miniapp-examples-v2",
  "packages/qchat_miniapp_webview",
  "packages/qchat_miniapp_quickjs",
  "apps/mobile/lib/features/miniapps_host",
  "apps/server/src/modules/v1",
];

const FORBIDDEN = [
  { pattern: /(?:from|import|require)\s*\(?\s*["'][^"']*@mna\/qchat/, reason: "legacy @mna/qchat SDK" },
  { pattern: /(?:from|import|require)\s*\(?\s*["'][^"']*miniapp-framework/, reason: "legacy miniapp-framework" },
  { pattern: /(?:from|import|require)\s*\(?\s*["'][^"']*miniapp-examples\//, reason: "legacy example apps" },
  { pattern: /(?:from|import|require)\s*\(?\s*["'][^"']*features\/miniapps\/qapp/, reason: "legacy Flutter QApp tree" },
  { pattern: /(?:from|import|require)\s*\(?\s*["'][^"']*qapp_/, reason: "legacy qapp_* module" },
  { pattern: /import\s+["']package:flutter\/material\.dart["']/, reason: "Material in a Mini App module (repo rule)" },
  { pattern: /import\s+["']package:flutter_js\//, reason: "legacy QuickJS wrapper" },
  { pattern: /import\s+["']tdesign_flutter\//, reason: "TDesign outside the legacy frame island" },
];

const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".dart"]);

async function walk(directory, files = []) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return files;
    throw error;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "build" || entry.name === "dist" || entry.name === ".dart_tool") continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(path, files);
    } else if (EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf(".")))) {
      files.push(path);
    }
  }
  return files;
}

const violations = [];
for (const root of ROOTS) {
  for (const file of await walk(join(ROOT, root))) {
    const text = await readFile(file, "utf8");
    for (const rule of FORBIDDEN) {
      if (rule.pattern.test(text)) {
        violations.push(`${relative(ROOT, file).split(sep).join("/")}: ${rule.reason}`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error("Mini App isolation check failed:");
  for (const violation of violations) console.error(`  ${violation}`);
  process.exit(1);
}
console.log(`Mini App isolation check passed (${ROOTS.length} module roots).`);
