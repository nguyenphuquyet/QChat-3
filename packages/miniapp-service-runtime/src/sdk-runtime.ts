/**
 * SDK runtime wiring: installs the SDK bootstrap and the module loader into one
 * engine, then exposes the calls the host needs. This is the layer the Android
 * QuickJS adapter and the iOS JavaScriptCore adapter both use; only the engine
 * implementation changes.
 */

import { miniAppError } from "@qchat/miniapp-contracts";
import type { EngineEvaluation, ServiceEngine } from "./engine.js";
import { createModuleLoader, type ModuleLoader, type ModuleSource } from "./module-loader.js";
import { SDK_SOURCE } from "./sdk.js";

export const SDK_RUNTIME_VERSION = 1 as const;

export type SdkMessageKind = "page.open" | "page.setData" | "page.close" | "page.show" | "bridge.request";

export interface SdkMessage {
  kind: SdkMessageKind;
  payload: Record<string, unknown>;
}

export interface SdkBridgeRequest {
  id: string;
  method: string;
  params: Record<string, unknown>;
}

export interface SdkRuntimeOptions {
  engine: ServiceEngine;
  source: ModuleSource;
  /** Receives the SDK's outbound events after validation. */
  onMessage?: (message: SdkMessage) => void;
  /** Receives a validated host-API request from the page. */
  onRequest?: (request: SdkBridgeRequest) => void;
  /** Methods the host may answer; a request outside it is rejected. */
  allowlist?: readonly string[];
}

export interface SdkRuntime {
  readonly loader: ModuleLoader;
  /** Evaluate the SDK bootstrap once. */
  install(): EngineEvaluation;
  /** Load `app.js` (or a custom entry) and call `App`. */
  loadApp(entry?: string): EngineEvaluation;
  /** Load one page module so its `Page()` call registers the definition. */
  loadPage(route: string): EngineEvaluation;
  appLaunch(options: { path: string; query?: Record<string, string> }): EngineEvaluation;
  open(route: string, query: Record<string, string>, pageId: string): EngineEvaluation;
  deliver(event: Record<string, unknown>): EngineEvaluation;
  setData(patch: Record<string, unknown>): EngineEvaluation;
  closePage(pageId: string): EngineEvaluation;
  back(delta?: number): EngineEvaluation;
  clearTimers(): EngineEvaluation;
  /** Answer a `bridge.request`; the id is the one the SDK generated. */
  respond(id: string, response: { ok: true; result?: unknown } | { ok: false; error: { code: string; message: string } }): EngineEvaluation;
  /** Reject every pending call, used on page/app close. */
  rejectCalls(): EngineEvaluation;
}

const MESSAGE_KINDS: readonly SdkMessageKind[] = ["page.open", "page.setData", "page.close", "page.show", "bridge.request"];

export function createSdkRuntime(options: SdkRuntimeOptions): SdkRuntime {
  const { engine, source, onMessage, onRequest, allowlist } = options;
  let installed = false;

  const host = {
    currentRoute: "",
    emit(json: string): void {
      if (!onMessage) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(json));
      } catch {
        return;
      }
      if (typeof parsed !== "object" || parsed === null) return;
      const record = parsed as Record<string, unknown>;
      if (typeof record.kind !== "string" || !MESSAGE_KINDS.includes(record.kind as SdkMessageKind)) return;
      if (typeof record.payload !== "object" || record.payload === null || Array.isArray(record.payload)) return;
      const payload = record.payload as Record<string, unknown>;
      onMessage?.({ kind: record.kind as SdkMessageKind, payload });

      if (record.kind === "bridge.request") {
        if (typeof payload.id !== "string" || !/^s[0-9]{1,9}$/.test(payload.id)) return;
        if (typeof payload.method !== "string") return;
        if (allowlist && !allowlist.includes(payload.method)) {
          engine.call("__qchatResponse", [
            JSON.stringify({ id: payload.id, ok: false, error: { code: "BRIDGE_UNKNOWN_METHOD", message: "The bridge method is not allowlisted." } }),
          ]);
          return;
        }
        if (typeof payload.params !== "object" || payload.params === null || Array.isArray(payload.params)) return;
        onRequest?.({ id: payload.id, method: payload.method, params: payload.params as Record<string, unknown> });
      }
    },
  };

  const routeStack: string[] = [];
  const loader = createModuleLoader({
    engine,
    source,
    beforeEvaluate(path) {
      // `Page()`/`Component()` read this; a module that is not a page module
      // simply never calls them. A nested require restores the outer route.
      routeStack.push(host.currentRoute);
      host.currentRoute = path.endsWith(".js") ? path.slice(0, -3) : path;
    },
    afterEvaluate() {
      host.currentRoute = routeStack.pop() ?? "";
    },
  });

  function ensureInstalled(): EngineEvaluation | null {
    if (installed) return null;
    engine.defineGlobal("__qchatHost", host);
    const result = engine.evaluate(SDK_SOURCE, "qchat-sdk.js");
    if (result.ok) installed = true;
    return result;
  }

  function after<T>(call: () => EngineEvaluation): EngineEvaluation {
    const setup = ensureInstalled();
    if (setup && !setup.ok) return setup;
    return call();
  }

  return {
    loader,

    install() {
      return ensureInstalled() ?? { ok: true, durationMs: 0 };
    },

    loadApp(entry = "app.js") {
      return after(() => loader.load(entry));
    },

    loadPage(route) {
      return after(() => loader.load(route.endsWith(".js") ? route : `${route}.js`));
    },

    appLaunch(input) {
      return after(() => engine.call("__qchatAppLaunch", [{ path: input.path, query: input.query ?? {} }]));
    },

    open(route, query, pageId) {
      if (!/^p[0-9]{1,6}$/.test(pageId)) {
        return { ok: false, error: miniAppError("BRIDGE_INVALID_MESSAGE", "Invalid page id."), durationMs: 0 };
      }
      return after(() => engine.call("__qchatOpenPage", [route, query, pageId]));
    },

    deliver(event) {
      return after(() => engine.call("__qchatDeliver", [JSON.stringify(event)]));
    },

    setData(patch) {
      return after(() => engine.call("__qchatSetData", [patch]));
    },

    closePage(pageId) {
      return after(() => engine.call("__qchatClosePage", [pageId]));
    },

    back(delta = 1) {
      if (!Number.isSafeInteger(delta) || delta < 1) {
        return { ok: false, error: miniAppError("NAVIGATION_INVALID_ROUTE", "delta must be a positive integer."), durationMs: 0 };
      }
      return after(() => engine.call("__qchatBack", [delta]));
    },

    clearTimers() {
      return after(() => engine.call("__qchatClearTimers", []));
    },

    respond(id, response) {
      if (typeof id !== "string" || !/^s[0-9]{1,9}$/.test(id)) {
        return { ok: false, error: miniAppError("BRIDGE_INVALID_MESSAGE", "Invalid call id."), durationMs: 0 };
      }
      const payload = response.ok
        ? { id, ok: true, result: response.result ?? null }
        : { id, ok: false, error: response.error };
      return after(() => engine.call("__qchatResponse", [JSON.stringify(payload)]));
    },

    rejectCalls() {
      return after(() => engine.call("__qchatRejectCalls", []));
    },
  };
}
