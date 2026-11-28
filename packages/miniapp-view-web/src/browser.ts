/**
 * WebView bundle entry. The host loads this file from the app-private origin
 * and calls `window.__qchatView`. It has no imports after bundling.
 */

import { installBrowserView, type BrowserViewHandle, type ViewBridgeChannel } from "./install.js";

declare global {
  interface Window {
    qchatViewBridge?: ViewBridgeChannel;
    __qchatView?: BrowserViewHandle;
  }
}

installBrowserView(window);

export {};
