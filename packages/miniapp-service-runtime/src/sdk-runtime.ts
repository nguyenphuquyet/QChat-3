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

export type SdkMessageKind = "page.open" | "page.setData" | "page.close";

export interface SdkMessage {
  kind: SdkMessageKind;
  payload: Record<string, unknown>;
}

export interface SdkRuntimeOptions {
  engine: ServiceEngine;
  source: ModuleSource;
  /** Receives the SDK's outbound events after validation. */
  onMessage?: (message: SdkMessage) => void;
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
  clearTimers(): EngineEvaluation;
}

const MESSAGE_KINDS: readonly SdkMessageKind[] = ["page.open", "page.setData", "page.close"];

export function createSdkRuntime(options: SdkRuntimeOptions): SdkRuntime {
  const { engine, source, onMessage } = options;
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
      onMessage({ kind: record.kind as SdkMessageKind, payload: record.payload as Record<string, unknown> });
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

    clearTimers() {
      return after(() => engine.call("__qchatClearTimers", []));
    },
  };
}
