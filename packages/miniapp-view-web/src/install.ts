/**
 * Browser installation seam for the View Runtime.
 *
 * The host serves an app-private HTML page, injects the P0 component script and
 * this bundle, then calls:
 *
 *   __qchatView.start('{"appId":"...","sessionId":"...","pageId":"p1"}')
 *   __qchatView.receive('<bridge event JSON>')
 *   __qchatView.destroy()
 *
 * `start` is called through `evaluateJavascript` after the page has loaded; a
 * Content-Security-Policy therefore never needs an inline script. The host
 * bridge object (`window.qchatViewBridge`) is the origin-bound listener from
 * `WebViewCompat.addWebMessageListener`.
 */

import { miniAppError, type BridgeBinding } from "@qchat/miniapp-contracts";
import { createViewClient, isViewBinding, type ViewClient, type ViewClientResult } from "./client.js";
import { VIEW_ROOT_ID, type DomDocumentLike } from "./dom.js";

/** Name of the object `addWebMessageListener` injects into the page. */
export const VIEW_BRIDGE_OBJECT = "qchatViewBridge";

export interface ViewBridgeChannel {
  postMessage(message: string): void;
}

export interface BrowserWindowLike {
  readonly document: DomDocumentLike;
  qchatViewBridge?: ViewBridgeChannel;
  __qchatView?: BrowserViewHandle;
}

export interface BrowserViewHandle {
  /** Start with the host-issued binding. Returns a JSON `ViewClientResult`. */
  start(bindingJson: string): string;
  /** Apply one host message. Returns a JSON `ViewClientResult`. */
  receive(messageJson: string): string;
  /** Remove the page tree. Returns a JSON `ViewClientResult`. */
  destroy(): string;
}

function serialize(result: ViewClientResult): string {
  return JSON.stringify(result);
}

function failure(code: "BRIDGE_INVALID_MESSAGE" | "BRIDGE_PAGE_CLOSED" | "RUNTIME_CRASH", message: string): string {
  return serialize({ ok: false, error: miniAppError(code, message) });
}

/**
 * Install `window.__qchatView`. Idempotent: a second script load returns the
 * existing handle instead of replacing a live page.
 */
export function installBrowserView(win: BrowserWindowLike): BrowserViewHandle {
  if (win.__qchatView) return win.__qchatView;

  let client: ViewClient | null = null;
  let destroyed = false;

  const handle: BrowserViewHandle = {
    start(bindingJson: string): string {
      if (destroyed) return failure("BRIDGE_PAGE_CLOSED", "The view is destroyed.");
      if (client) return failure("BRIDGE_INVALID_MESSAGE", "The view has already started.");
      if (typeof bindingJson !== "string") {
        return failure("BRIDGE_INVALID_MESSAGE", "The binding must be a JSON string.");
      }

      let raw: unknown;
      try {
        raw = JSON.parse(bindingJson);
      } catch {
        return failure("BRIDGE_INVALID_MESSAGE", "The binding is not JSON.");
      }
      if (!isViewBinding(raw)) return failure("BRIDGE_INVALID_MESSAGE", "The binding is invalid.");

      const root = win.document.getElementById(VIEW_ROOT_ID);
      if (!root) return failure("RUNTIME_CRASH", "The view root is missing.");
      const channel = win.qchatViewBridge;
      if (!channel) return failure("RUNTIME_CRASH", "The host bridge object is missing.");

      const binding: BridgeBinding = raw;
      client = createViewClient({
        document: win.document,
        root,
        binding,
        send(message): void {
          channel.postMessage(JSON.stringify(message));
        },
      });
      return serialize(client.ready());
    },

    receive(messageJson: string): string {
      if (destroyed) return failure("BRIDGE_PAGE_CLOSED", "The view is destroyed.");
      if (!client) return failure("BRIDGE_INVALID_MESSAGE", "The view has not started.");
      return serialize(client.receive(messageJson));
    },

    destroy(): string {
      if (client) {
        client.destroy();
        client = null;
      }
      destroyed = true;
      return serialize({ ok: true, status: "destroyed" });
    },
  };

  win.__qchatView = handle;
  return handle;
}
