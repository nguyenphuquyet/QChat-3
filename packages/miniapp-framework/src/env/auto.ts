import { installEnv } from "./index.js";

/**
 * Side-effect entry point: `import "@mna/qchat/env/auto";` installs the whole
 * QChat JavaScript environment (timers, console, structuredClone, URL,
 * TextEncoder/TextDecoder, AbortController and the vi-VN/en-US Intl polyfill).
 *
 * This module is the only file in the package marked as having side effects, so
 * esbuild keeps it and still tree-shakes everything an app does not use.
 */
installEnv();
