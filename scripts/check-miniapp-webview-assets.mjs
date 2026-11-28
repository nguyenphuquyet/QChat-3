#!/usr/bin/env node
/**
 * Guard against a stale WebView bundle in the Android plugin.
 *
 * The plugin cannot reference `packages/miniapp-view-web/dist` directly because
 * Flutter only ships assets declared inside the plugin, so the two scripts are
 * copied. This check makes the copy provable: edit the view client, rebuild, and
 * run `node scripts/sync-miniapp-webview-assets.mjs`.
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "packages", "miniapp-view-web", "dist");
const target = join(root, "packages", "qchat_miniapp_webview", "assets");
const names = ["qchat-view.js", "qchat-components.js"];

const stale = [];
for (const name of names) {
  let built;
  let shipped;
  try {
    built = await readFile(join(source, name));
  } catch {
    console.error(`missing ${name} in packages/miniapp-view-web/dist; run pnpm --filter @qchat/miniapp-view-web build`);
    process.exit(1);
  }
  try {
    shipped = await readFile(join(target, name));
  } catch {
    stale.push(`${name} is missing from packages/qchat_miniapp_webview/assets`);
    continue;
  }
  if (!built.equals(shipped)) stale.push(`${name} differs from the built bundle`);
}

if (stale.length > 0) {
  console.error("Mini App WebView assets are stale:");
  for (const item of stale) console.error(`  ${item}`);
  console.error("Run: node scripts/sync-miniapp-webview-assets.mjs");
  process.exit(1);
}
console.log(`Mini App WebView assets match the build (${names.length} files).`);
