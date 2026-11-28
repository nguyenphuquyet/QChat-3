/**
 * Copy the built WebView scripts into the Android plugin.
 *
 * Flutter ships plugin assets from the plugin directory only, so the committed
 * `dist/` output of `@qchat/miniapp-view-web` is mirrored here. The mirror is
 * byte-compared by `scripts/check-miniapp-webview-assets.mjs`, which runs in
 * `pnpm check:miniapp`; a stale copy fails the check instead of shipping an old
 * renderer to the device.
 */
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "packages", "miniapp-view-web", "dist");
const target = join(root, "packages", "qchat_miniapp_webview", "assets");

await mkdir(target, { recursive: true });
for (const name of ["qchat-view.js", "qchat-components.js"]) {
  await copyFile(join(source, name), join(target, name));
  console.log(`synced ${name}`);
}
