/**
 * QChat Mini App View Runtime for the system WebView.
 *
 * `createViewClient` is the testable core; `installBrowserView` wires it to
 * `window.__qchatView`; `src/browser.ts` is the dependency-free bundle entry.
 */

export * from "./client.js";
export * from "./dom.js";
export * from "./fake-dom.js";
export * from "./install.js";
