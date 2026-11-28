/**
 * Sample host: the Node stand-in for the Android/iOS container.
 *
 * It wires the real pieces together in the same order the device will:
 * the isolated engine runs the sample's JavaScript, the SDK turns `Page`,
 * `setData`, `wx.*` and events into messages, the compiler turns WXML into a
 * typed render tree, the View Runtime draws it through a DOM adapter, and the
 * API host answers navigation, storage, network, UI and system information.
 * A tap is delivered to the engine, `setData` returns as a full data snapshot,
 * and only the changed paths are patched into the view.
 */

import {
  bridgeMethodAllowlist,
  diffRenderTree,
  type DomAdapter,
  type RenderNode,
  type ResolvedTheme,
  type RuntimeIdentity,
  type ViewEvent,
} from "@qchat/miniapp-contracts";
import { formatDiagnostic, renderWxml } from "@qchat/miniapp-compiler";
import {
  MemoryStorageAdapter,
  createApiHost,
  createNavigationController,
  createNodeEngine,
  createSdkRuntime,
  type ApiHost,
  type EngineEvaluation,
  type NetworkAdapter,
  type StorageAdapter,
} from "@qchat/miniapp-service-runtime";
import {
  MemoryDomAdapter,
  createViewRenderer,
  type SpikeViewRenderer,
} from "@qchat/miniapp-view-runtime";
import { SampleError, type CompiledPage, type SamplePackage } from "./sample.js";

export interface SampleHostOptions {
  /** Defaults to an in-memory adapter; a device supplies the WebView adapter. */
  dom?: DomAdapter;
  /** The host appearance, used only when the sample declares `auto`. */
  hostTheme?: ResolvedTheme;
  /** Defaults to in-memory storage; a device supplies durable storage. */
  storage?: StorageAdapter;
  /** No default: `wx.request` is unsupported until the host provides one. */
  network?: NetworkAdapter;
  domains?: readonly string[];
  systemInfo?: Readonly<Record<string, unknown>>;
  identity?: RuntimeIdentity;
  storageQuotaBytes?: number;
  requestTimeoutMs?: number;
}

export interface HostEvent {
  event: string;
  payload: Record<string, unknown>;
}

export interface SampleHost {
  readonly sample: SamplePackage;
  readonly dom: DomAdapter;
  readonly view: SpikeViewRenderer;
  readonly api: ApiHost;
  /** Typed UI events the API host emitted (toast, loading, modal). */
  readonly events: readonly HostEvent[];
  /** Compile/launch the first page. Call once. */
  launch(route?: string, query?: Record<string, string>): void;
  /** Deliver one view event to the page handler in the engine. */
  dispatch(event: ViewEvent): void;
  data(): Record<string, unknown>;
  route(): string | null;
  /** Routes in the engine stack, bottom first. */
  pageStack(): string[];
  theme(): ResolvedTheme | null;
  close(): void;
}

const DEFAULT_IDENTITY: RuntimeIdentity = {
  appId: "qchat.sample",
  appVersion: "1.0.0",
  sessionId: "sample",
  runtimeVersion: "0.1.0",
  baseLibraryVersion: "3.18.1",
};

interface OpenPage {
  page: CompiledPage;
  data: Record<string, unknown>;
}

function record(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new SampleError(`${what}: expected an object`);
  }
  return structuredClone(value) as Record<string, unknown>;
}

function ensure(step: EngineEvaluation, what: string): void {
  if (!step.ok) throw new SampleError(`${what}: ${step.error?.message ?? "unknown engine error"}`);
}

function resolveTheme(declared: unknown, host: ResolvedTheme): ResolvedTheme {
  if (declared === "dark") return "dark";
  if (declared === "auto") return host;
  return "light";
}

export function createSampleHost(sample: SamplePackage, options: SampleHostOptions = {}): SampleHost {
  const dom = options.dom ?? new MemoryDomAdapter();
  const hostTheme = options.hostTheme ?? "light";
  const identity = options.identity ?? DEFAULT_IDENTITY;
  const events: HostEvent[] = [];
  const engine = createNodeEngine();
  const tabPages = readTabPages(sample.app);

  let deliverToService: ((event: ViewEvent) => void) | null = null;
  const view = createViewRenderer(dom, {
    onEvent(event) {
      if (deliverToService === null) throw new SampleError("a view event arrived before the SDK was ready");
      deliverToService(event);
    },
  });

  const openPages = new Map<string, OpenPage>();
  let currentPageId: string | null = null;
  let tree: RenderNode | null = null;
  let started = false;
  let closed = false;
  let apiHost: ApiHost | null = null;

  function pageTheme(page: CompiledPage): ResolvedTheme {
    const override = page.config.qxColorScheme;
    if (override === "light" || override === "dark" || override === "auto") {
      return resolveTheme(override, hostTheme);
    }
    return resolveTheme(sample.app.qxColorScheme, hostTheme);
  }

  function currentTheme(): ResolvedTheme {
    const record = currentPageId === null ? undefined : openPages.get(currentPageId);
    return record ? pageTheme(record.page) : resolveTheme(sample.app.qxColorScheme, hostTheme);
  }

  function renderFull(pageId: string): void {
    const record = openPages.get(pageId);
    if (!record) throw new SampleError(`render for an unopened page ${pageId}`);
    const result = renderWxml(record.page.wxml, record.data);
    if (!result.ok) {
      const first = result.diagnostics[0];
      throw new SampleError(`render: ${first ? formatDiagnostic(first) : "invalid render tree"}`);
    }
    currentPageId = pageId;
    tree = result.value;
    view.render(tree);
    view.setTheme(pageTheme(record.page));
  }

  function renderPatch(pageId: string): void {
    if (currentPageId !== pageId) return;
    if (tree === null) {
      renderFull(pageId);
      return;
    }
    const record = openPages.get(pageId);
    if (!record) return;
    const result = renderWxml(record.page.wxml, record.data);
    if (!result.ok) {
      const first = result.diagnostics[0];
      throw new SampleError(`render: ${first ? formatDiagnostic(first) : "invalid render tree"}`);
    }
    const next = result.value;
    const ops = diffRenderTree(tree, next);
    tree = next;
    if (ops.length > 0) view.patch(ops);
  }

  const sdk = createSdkRuntime({
    engine,
    source: { read: (path) => sample.read(path) },
    allowlist: bridgeMethodAllowlist(),
    tabPages,
    maxPageStack: 10,
    onRequest(request) {
      if (apiHost === null) throw new SampleError("an API request arrived before the API host was ready");
      apiHost.handle(request);
    },
    onSync(method, params) {
      if (apiHost === null) return { ok: false, error: { code: "API_UNSUPPORTED", message: "The API host is not ready." } };
      return apiHost.handleSync(method, params);
    },
    onMessage(message) {
      if (message.kind === "page.open" || message.kind === "page.show") {
        const pageId = message.payload.pageId;
        const route = message.payload.route;
        if (typeof pageId !== "string" || typeof route !== "string") throw new SampleError(`${message.kind} without a page`);
        const compiled = sample.pages.get(route);
        if (!compiled) throw new SampleError(`${message.kind} for an uncompiled route ${route}`);
        openPages.set(pageId, { page: compiled, data: record(message.payload.data, `${message.kind} data`) });
        renderFull(pageId);
      } else if (message.kind === "page.setData") {
        const pageId = message.payload.pageId;
        if (typeof pageId !== "string") throw new SampleError("page.setData without a page");
        const existing = openPages.get(pageId);
        if (!existing) return;
        existing.data = record(message.payload.data, "page.setData data");
        renderPatch(pageId);
      } else if (message.kind === "page.close") {
        const pageId = message.payload.pageId;
        if (typeof pageId !== "string") throw new SampleError("page.close without a page");
        openPages.delete(pageId);
        if (currentPageId === pageId) {
          currentPageId = null;
          tree = null;
        }
      }
    },
  });

  const navigation = createNavigationController({ sdk, routes: sample.app.pages, tabPages });

  apiHost = createApiHost({
    identity,
    navigation,
    routes: sample.app.pages,
    tabPages,
    respond: (id, response) => {
      ensure(sdk.respond(id, response), "respond to an API call");
    },
    storage: options.storage ?? new MemoryStorageAdapter(),
    network: options.network,
    domains: options.domains,
    storageQuotaBytes: options.storageQuotaBytes,
    requestTimeoutMs: options.requestTimeoutMs,
    systemInfo: options.systemInfo,
    theme: currentTheme,
    emit(event, payload) {
      events.push({ event, payload: structuredClone(payload) });
    },
  });

  deliverToService = (event) => {
    ensure(sdk.deliver({ handler: event.handler, event }), `handler ${event.handler}`);
  };

  function start(): void {
    if (started) return;
    ensure(sdk.install(), "install the SDK");
    ensure(sdk.loadApp("app.js"), "load app.js");
    started = true;
  }

  return {
    sample,
    dom,
    view,
    api: apiHost,
    events,

    launch(routeName = sample.app.pages[0], query = {}) {
      if (closed) throw new SampleError("the sample host is closed");
      if (currentPageId !== null) throw new SampleError("the sample host is already launched");
      if (!sample.pages.has(routeName)) throw new SampleError(`unknown page ${routeName}`);
      start();
      ensure(sdk.appLaunch({ path: routeName, query }), "App.onLaunch");
      const result = navigation.to("open", routeName, query);
      if (!result.ok) throw new SampleError(`open ${routeName}: ${result.error?.message ?? "navigation failed"}`);
    },

    dispatch(event) {
      if (closed) throw new SampleError("the sample host is closed");
      if (deliverToService === null) throw new SampleError("dispatch before the SDK is ready");
      if (currentPageId === null) throw new SampleError("dispatch before launch");
      deliverToService(event);
    },

    data() {
      const record = currentPageId === null ? undefined : openPages.get(currentPageId);
      return structuredClone(record?.data ?? {});
    },

    route() {
      const record = currentPageId === null ? undefined : openPages.get(currentPageId);
      return record?.page.route ?? null;
    },

    pageStack() {
      const value = engine.call("getCurrentPages", []);
      if (!value.ok || !Array.isArray(value.value)) return [];
      const routes: string[] = [];
      for (const entry of value.value) {
        if (typeof entry === "object" && entry !== null) {
          const route = (entry as Record<string, unknown>).route;
          if (typeof route === "string") routes.push(route);
        }
      }
      return routes;
    },

    theme() {
      return currentPageId === null ? null : currentTheme();
    },

    close() {
      if (closed) return;
      closed = true;
      apiHost?.close();
      sdk.clearTimers();
      sdk.rejectCalls();
      view.destroy();
      engine.terminate();
    },
  };
}

function readTabPages(app: SamplePackage["app"]): string[] {
  const tabBar = app.tabBar;
  if (typeof tabBar !== "object" || tabBar === null || Array.isArray(tabBar)) return [];
  const list = (tabBar as Record<string, unknown>).list;
  if (!Array.isArray(list)) return [];
  return list
    .map((entry) => (typeof entry === "object" && entry !== null ? (entry as Record<string, unknown>).pagePath : undefined))
    .filter((path): path is string => typeof path === "string");
}
