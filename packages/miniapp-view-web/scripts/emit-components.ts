/**
 * Emit the P0/P1 component bootstrap as a standalone WebView script.
 *
 * `COMPONENTS_SOURCE` is kept as a string in `@qchat/miniapp-view-runtime` so
 * the Node tests can execute it against a DOM shim. The device host loads it as
 * a separate `<script>` before `qchat-view.js` (ADR 012 §1), so it is written to
 * `dist/qchat-components.js` next to the view bundle.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { COMPONENTS_SOURCE } from "@qchat/miniapp-view-runtime";

const dist = new URL("../dist/", import.meta.url);
await mkdir(dist, { recursive: true });
await writeFile(new URL("qchat-components.js", dist), COMPONENTS_SOURCE, "utf8");
console.log("wrote dist/qchat-components.js");
