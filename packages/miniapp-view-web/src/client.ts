/**
 * View client for the system WebView.
 *
 * It composes the shared render session and renderer with a browser DOM
 * adapter and the runtime bridge:
 *
 * - the host starts it with the app/session/page binding it issued;
 * - every later message is a bridge event bound to that same triple;
 * - `view.render` applies the first full tree, then path operations;
 * - `view.theme` changes the page root only, never the tree;
 * - `view.destroy` removes the tree and closes the page;
 * - page events travel back as `view.event`, rejections as `view.error`.
 *
 * The client never compiles WXML, never fetches, and never writes HTML.
 */

import {
  BRIDGE_VERSION,
  MAX_BRIDGE_MESSAGE_BYTES,
  VIEW_DESTROY_EVENT,
  VIEW_ERROR_EVENT,
  VIEW_INPUT_EVENT,
  VIEW_READY_EVENT,
  VIEW_RENDER_EVENT,
  VIEW_THEME_EVENT,
  hasOnlyKeys,
  isNonEmptyString,
  isRecord,
  isResolvedTheme,
  miniAppError,
  parseBridgeMessage,
  utf8Length,
  validateRenderPayload,
  type BridgeBinding,
  type BridgeEvent,
  type MiniAppError,
  type ViewEvent,
} from "@qchat/miniapp-contracts";
import { createRenderSession, createViewRenderer, type RenderSession } from "@qchat/miniapp-view-runtime";
import {
  createBrowserDomAdapter,
  type BrowserDomAdapter,
  type DomDocumentLike,
  type DomElementLike,
} from "./dom.js";

export type ViewClientStatus = "ready" | "tree" | "ops" | "ignored" | "theme" | "destroyed";

export type ViewClientResult =
  | { ok: true; status: ViewClientStatus }
  | { ok: false; error: MiniAppError };

export interface ViewClientOptions {
  document: DomDocumentLike;
  root: DomElementLike;
  binding: BridgeBinding;
  /** The host channel. It must be the origin-bound message listener. */
  send(message: BridgeEvent): void;
  now?: () => number;
  maxNodes?: number;
}

export interface ViewClient {
  readonly binding: BridgeBinding;
  /** Announce that the page is ready for its first tree. */
  ready(): ViewClientResult;
  /** Apply one host message, as an object or a JSON string. */
  receive(value: unknown): ViewClientResult;
  /** Remove the tree and close the page. Idempotent. */
  destroy(): ViewClientResult;
  seq(): number;
  pageId(): string | null;
}

const PAGE_ID = /^p[0-9]{1,9}$/;
const BINDING_KEYS = ["appId", "sessionId", "pageId"] as const;

/** A host-issued binding. The page id is the host's `p<n>` allocation. */
export function isViewBinding(value: unknown): value is BridgeBinding {
  if (!isRecord(value)) return false;
  if (!hasOnlyKeys(value, BINDING_KEYS)) return false;
  return (
    isNonEmptyString(value.appId, 128) &&
    isNonEmptyString(value.sessionId, 128) &&
    isNonEmptyString(value.pageId, 128) &&
    PAGE_ID.test(value.pageId)
  );
}

export function createViewClient(options: ViewClientOptions): ViewClient {
  if (!isViewBinding(options.binding)) throw new Error("invalid view binding");

  const binding: BridgeBinding = {
    appId: options.binding.appId,
    sessionId: options.binding.sessionId,
    pageId: options.binding.pageId,
  };
  const adapter: BrowserDomAdapter = createBrowserDomAdapter(options.document, options.root);
  let destroyed = false;
  let transportLost = false;

  function send(message: BridgeEvent): boolean {
    if (destroyed || transportLost) return false;
    try {
      options.send(message);
      return true;
    } catch {
      // The host channel is gone (the WebView is closing). Stop sending and
      // reject later messages instead of throwing inside a DOM listener.
      transportLost = true;
      return false;
    }
  }

  function envelope(event: string, payload: Record<string, unknown>): BridgeEvent {
    return {
      v: BRIDGE_VERSION,
      kind: "event",
      appId: binding.appId,
      sessionId: binding.sessionId,
      pageId: binding.pageId,
      event,
      payload,
    };
  }

  function reject(error: MiniAppError): ViewClientResult {
    send(envelope(VIEW_ERROR_EVENT, { code: error.code, message: error.message }));
    return { ok: false, error };
  }

  function closed(message = "The page is closed."): ViewClientResult {
    return { ok: false, error: miniAppError("BRIDGE_PAGE_CLOSED", message) };
  }

  const renderer = createViewRenderer(adapter, {
    now: options.now,
    maxNodes: options.maxNodes,
    onEvent(event: ViewEvent): void {
      send(
        envelope(VIEW_INPUT_EVENT, {
          handler: event.handler,
          type: event.type,
          detail: event.detail,
          dataset: event.dataset,
          catch: event.catch,
          timeStamp: event.timeStamp,
        }),
      );
    },
  });
  const session: RenderSession = createRenderSession(renderer);

  function applyRender(payload: Record<string, unknown>): ViewClientResult {
    if (!validateRenderPayload(payload)) {
      return reject(miniAppError("BRIDGE_INVALID_MESSAGE", "The render payload is invalid."));
    }
    if (payload.pageId !== binding.pageId) {
      return reject(miniAppError("BRIDGE_PAGE_MISMATCH", "The render payload is bound to another page."));
    }
    try {
      return { ok: true, status: session.apply(payload) };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The render payload was rejected.";
      return reject(miniAppError("BRIDGE_INVALID_MESSAGE", message));
    }
  }

  function applyTheme(payload: Record<string, unknown>): ViewClientResult {
    if (!hasOnlyKeys(payload, ["theme"]) || !isResolvedTheme(payload.theme)) {
      return reject(miniAppError("BRIDGE_INVALID_MESSAGE", "A theme event needs a resolved light or dark theme."));
    }
    renderer.setTheme(payload.theme);
    return { ok: true, status: "theme" };
  }

  function destroy(): ViewClientResult {
    if (destroyed) return { ok: true, status: "destroyed" };
    destroyed = true;
    renderer.destroy();
    adapter.dispose();
    return { ok: true, status: "destroyed" };
  }

  return {
    binding,

    ready(): ViewClientResult {
      if (destroyed) return closed();
      if (transportLost) return closed("The host bridge is gone.");
      if (!send(envelope(VIEW_READY_EVENT, {}))) return closed("The host bridge is gone.");
      return { ok: true, status: "ready" };
    },

    receive(value: unknown): ViewClientResult {
      if (destroyed) return closed();
      if (transportLost) return closed("The host bridge is gone.");

      let raw: unknown = value;
      if (typeof value === "string") {
        if (utf8Length(value) > MAX_BRIDGE_MESSAGE_BYTES) {
          return reject(miniAppError("BRIDGE_TOO_LARGE"));
        }
        try {
          raw = JSON.parse(value);
        } catch {
          return reject(miniAppError("BRIDGE_INVALID_MESSAGE", "The message is not JSON."));
        }
      }

      const parsed = parseBridgeMessage(raw, binding);
      if (!parsed.ok) return reject(parsed.error);
      if (parsed.message.kind !== "event") {
        return reject(miniAppError("BRIDGE_INVALID_MESSAGE", "The view accepts events only."));
      }

      const payload = parsed.message.payload;
      switch (parsed.message.event) {
        case VIEW_RENDER_EVENT:
          return applyRender(payload);
        case VIEW_THEME_EVENT:
          return applyTheme(payload);
        case VIEW_DESTROY_EVENT:
          return destroy();
        default:
          return reject(miniAppError("BRIDGE_INVALID_MESSAGE", "Unknown view event."));
      }
    },

    destroy,

    seq(): number {
      return session.seq();
    },

    pageId(): string | null {
      return session.pageId();
    },
  };
}
