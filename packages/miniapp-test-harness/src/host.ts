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
  type EventBinding,
  type RenderNode,
  type ResolvedTheme,
  type RuntimeIdentity,
  type ViewEvent,
} from "@qchat/miniapp-contracts";
import {
  formatDiagnostic,
  renderWxml,
  type ComponentRenderRequest,
} from "@qchat/miniapp-compiler";
import {
  MemoryStorageAdapter,
  createApiHost,
  createNavigationController,
  createNodeEngine,
  createSdkRuntime,
  invokeWxsEvent,
  wxsEventDetail,
  type ApiHost,
  type EngineEvaluation,
  type NetworkAdapter,
  type StorageAdapter,
} from "@qchat/miniapp-service-runtime";
import {
  MemoryDomAdapter,
  createViewRenderer,
  createWxsRuntime,
  type SpikeViewRenderer,
  type WxsRuntime,
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

interface ComponentInstanceRecord {
  pageId: string;
  events: Record<string, EventBinding>;
}

interface PendingComponentEvent {
  key: string;
  name: string;
  detail: Record<string, unknown>;
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
  const componentInstances = new Map<string, ComponentInstanceRecord>();
  const loadedModules = new Set<string>();
  const pendingComponentEvents: PendingComponentEvent[] = [];
  const wxsRuntimes = new WeakMap<CompiledPage["wxml"], WxsRuntime>();
  let rendering = false;
  let pendingRerender = false;

  /** One WXS interpreter per compiled page, shared by templates and handlers. */
  function wxsFor(page: CompiledPage): WxsRuntime | null {
    if (!page.wxml.wxs) return null;
    const existing = wxsRuntimes.get(page.wxml);
    if (existing) return existing;
    const runtime = createWxsRuntime(page.wxml.wxs);
    wxsRuntimes.set(page.wxml, runtime);
    return runtime;
  }

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

  /**
   * Turn page data into a tree. Every custom component in the tree asks the
   * engine for its instance data; the page module never sees the component's
   * markup and the component never sees the page's data.
   */
  function renderPageTree(pageId: string, record: OpenPage): RenderNode {
    const seen = new Set<string>();
    const options = {
      componentData(request: ComponentRenderRequest): Record<string, unknown> | null {
        const key = `${pageId}:${request.instanceKey}`;
        seen.add(key);
        componentInstances.set(key, { pageId, events: request.events });
        if (!loadedModules.has(request.path)) {
          const loaded = sdk.loadPage(request.path);
          if (!loaded.ok) {
            throw new SampleError(`component ${request.path}: ${loaded.error?.message ?? "load failed"}`);
          }
          loadedModules.add(request.path);
        }
        const mounted = sdk.componentMount({ key, path: request.path, props: request.props });
        if (!mounted.ok) {
          throw new SampleError(`component ${request.path}: ${mounted.error?.message ?? "mount failed"}`);
        }
        const value = mounted.value as { ok?: boolean; data?: unknown; message?: string } | undefined;
        if (!value || value.ok !== true || typeof value.data !== "object" || value.data === null) {
          throw new SampleError(`component ${request.path}: ${value?.message ?? "no instance data"}`);
        }
        return value.data as Record<string, unknown>;
      },
      componentHandler(request: { path: string; instanceKey: string; handler: string }): string {
        return `component:${pageId}:${request.instanceKey}:${request.handler}`;
      },
      ...(wxsFor(record.page) ? { wxs: wxsFor(record.page)! } : {}),
    };
    const result = renderWxml(record.page.wxml, record.data, options);
    if (!result.ok) {
      const first = result.diagnostics[0];
      throw new SampleError(`render: ${first ? formatDiagnostic(first) : "invalid render tree"}`);
    }
    // A component that the new tree no longer contains is unmounted, so a
    // stale instance cannot deliver an event into the page.
    for (const [key, entry] of componentInstances) {
      if (entry.pageId === pageId && !seen.has(key)) {
        sdk.componentUnmount(key);
        componentInstances.delete(key);
      }
    }
    return result.value;
  }

  function flushPending(): void {
    while (pendingComponentEvents.length > 0) {
      const entry = pendingComponentEvents.shift();
      if (entry) deliverComponentEvent(entry);
    }
    if (pendingRerender) {
      pendingRerender = false;
      if (currentPageId !== null) renderPatch(currentPageId);
    }
  }

  function renderFull(pageId: string): void {
    const record = openPages.get(pageId);
    if (!record) throw new SampleError(`render for an unopened page ${pageId}`);
    rendering = true;
    try {
      const next = renderPageTree(pageId, record);
      currentPageId = pageId;
      tree = next;
      view.render(tree);
      view.setTheme(pageTheme(record.page));
    } finally {
      rendering = false;
      flushPending();
    }
  }

  function renderPatch(pageId: string): void {
    if (currentPageId !== pageId) return;
    if (tree === null) {
      renderFull(pageId);
      return;
    }
    const record = openPages.get(pageId);
    if (!record) return;
    rendering = true;
    try {
      const next = renderPageTree(pageId, record);
      const ops = diffRenderTree(tree, next);
      tree = next;
      if (ops.length > 0) view.patch(ops);
    } finally {
      rendering = false;
      flushPending();
    }
  }

  function deliverComponentEvent(entry: PendingComponentEvent): void {
    const record = componentInstances.get(entry.key);
    if (!record || record.pageId !== currentPageId) return;
    const binding = record.events[entry.name];
    if (!binding) return;
    const event: ViewEvent = {
      handler: binding.handler,
      type: entry.name,
      detail: entry.detail,
      dataset: {},
      catch: binding.catch ?? false,
      timeStamp: Date.now(),
    };
    ensure(sdk.deliver({ ...event }), `component event ${entry.name}`);
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
        sdk.unmountPageComponents(pageId);
        for (const [key, entry] of componentInstances) {
          if (entry.pageId === pageId) componentInstances.delete(key);
        }
        openPages.delete(pageId);
        if (currentPageId === pageId) {
          currentPageId = null;
          tree = null;
        }
      } else if (message.kind === "component.setData") {
        const key = message.payload.key;
        if (typeof key !== "string") throw new SampleError("component.setData without a key");
        if (rendering) {
          pendingRerender = true;
        } else if (currentPageId !== null) {
          renderPatch(currentPageId);
        }
      } else if (message.kind === "component.event") {
        const key = message.payload.key;
        const name = message.payload.name;
        if (typeof key !== "string" || typeof name !== "string") {
          throw new SampleError("component.event is malformed");
        }
        const entry: PendingComponentEvent = {
          key,
          name,
          detail: record(message.payload.detail ?? {}, "component.event detail"),
        };
        if (rendering) pendingComponentEvents.push(entry);
        else deliverComponentEvent(entry);
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

  /**
   * Route one view event. A handler inside a component template is namespaced
   * by the compiler (`component:<page>:<instance>:<method>`); it belongs to the
   * component instance, not to the page. Everything else is a page handler.
   */
  function routeEvent(event: ViewEvent): void {
    if (event.handler.startsWith("wxs:")) {
      const page = currentPageId === null ? undefined : openPages.get(currentPageId);
      const runtime = page ? wxsFor(page.page) : null;
      if (!runtime) throw new SampleError(`no WXS runtime for ${event.handler}`);
      try {
        invokeWxsEvent(runtime, event.handler.slice("wxs:".length), event, (name, data) => {
          ensure(
            sdk.deliver({
              handler: name,
              type: event.type,
              detail: wxsEventDetail(data),
              dataset: event.dataset,
              catch: false,
              timeStamp: Date.now(),
            }),
            `WXS callMethod ${name}`,
          );
        });
      } catch (cause) {
        throw new SampleError(`WXS handler ${event.handler}: ${cause instanceof Error ? cause.message : String(cause)}`);
      }
      return;
    }
    if (event.handler.startsWith("component:")) {
      const parts = event.handler.split(":");
      if (parts.length < 4) throw new SampleError(`malformed component handler ${event.handler}`);
      const pageId = parts[1];
      const instanceKey = parts[2];
      const handler = parts.slice(3).join(":");
      const delivered = sdk.componentDeliver({ key: `${pageId}:${instanceKey}`, handler, event: { ...event } });
      ensure(delivered, `component handler ${handler}`);
      const value = delivered.value as { ok?: boolean; code?: string; message?: string } | undefined;
      if (value && value.ok === false) {
        throw new SampleError(`component handler ${handler}: ${value.code ?? value.message ?? "failed"}`);
      }
      return;
    }
    ensure(sdk.deliver({ ...event }), `handler ${event.handler}`);
  }

  deliverToService = (event) => {
    routeEvent(event);
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
      routeEvent(event);
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
