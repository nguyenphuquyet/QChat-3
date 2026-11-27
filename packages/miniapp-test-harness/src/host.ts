/**
 * Sample host: the Node stand-in for the Android/iOS container.
 *
 * It wires the real pieces together in the same order the device will:
 * the isolated engine runs the sample's JavaScript, the SDK turns `Page`,
 * `setData` and events into messages, the compiler turns WXML into a typed
 * render tree, and the View Runtime draws it through a DOM adapter. A tap is
 * delivered to the engine, `setData` returns as a full data snapshot, and only
 * the changed paths are patched into the view.
 */

import {
  diffRenderTree,
  type DomAdapter,
  type RenderNode,
  type ResolvedTheme,
  type ViewEvent,
} from "@qchat/miniapp-contracts";
import { formatDiagnostic, renderWxml } from "@qchat/miniapp-compiler";
import {
  createNodeEngine,
  createSdkRuntime,
  type EngineEvaluation,
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
  /** Page id sent to the service runtime. */
  pageId?: string;
  /** The host appearance, used only when the sample declares `auto`. */
  hostTheme?: ResolvedTheme;
}

export interface SampleHost {
  readonly sample: SamplePackage;
  readonly dom: DomAdapter;
  readonly view: SpikeViewRenderer;
  /** Compile/launch the first page. Call once. */
  launch(route?: string, query?: Record<string, string>): void;
  /** Deliver one view event to the page handler in the engine. */
  dispatch(event: ViewEvent): void;
  data(): Record<string, unknown>;
  route(): string | null;
  theme(): ResolvedTheme | null;
  close(): void;
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

function resolveTheme(declared: SamplePackage["app"]["qxColorScheme"], host: ResolvedTheme): ResolvedTheme {
  if (declared === "dark") return "dark";
  if (declared === "auto") return host;
  return "light";
}

export function createSampleHost(sample: SamplePackage, options: SampleHostOptions = {}): SampleHost {
  const dom = options.dom ?? new MemoryDomAdapter();
  const pageId = options.pageId ?? "p1";
  if (!/^p[0-9]{1,9}$/.test(pageId)) throw new SampleError(`invalid page id ${JSON.stringify(pageId)}`);
  const theme = resolveTheme(sample.app.qxColorScheme, options.hostTheme ?? "light");
  const engine = createNodeEngine();
  // The view is built before the SDK, so it forwards through a late-bound
  // function; a DOM event then travels the same path a device tap does.
  let deliverToService: ((event: ViewEvent) => void) | null = null;
  const view = createViewRenderer(dom, {
    onEvent(event) {
      if (deliverToService === null) throw new SampleError("a view event arrived before the SDK was ready");
      deliverToService(event);
    },
  });

  let page: CompiledPage | null = null;
  let route: string | null = null;
  let data: Record<string, unknown> = {};
  let tree: RenderNode | null = null;
  let started = false;
  let closed = false;

  function renderFull(): void {
    if (!page) throw new SampleError("render before a page is open");
    const result = renderWxml(page.wxml, data);
    if (!result.ok) {
      const first = result.diagnostics[0];
      throw new SampleError(`render: ${first ? formatDiagnostic(first) : "invalid render tree"}`);
    }
    tree = result.value;
    view.render(tree);
    view.setTheme(theme);
  }

  function renderPatch(): void {
    if (!page || tree === null) {
      renderFull();
      return;
    }
    const result = renderWxml(page.wxml, data);
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
    onMessage(message) {
      if (message.kind === "page.open") {
        const opened = message.payload.route;
        if (typeof opened !== "string") throw new SampleError("page.open without a route");
        const compiled = sample.pages.get(opened);
        if (!compiled) throw new SampleError(`page.open for an uncompiled route ${opened}`);
        page = compiled;
        route = opened;
        data = record(message.payload.data, "page.open data");
        renderFull();
      } else if (message.kind === "page.setData") {
        data = record(message.payload.data, "page.setData data");
        renderPatch();
      } else if (message.kind === "page.close") {
        view.destroy();
        tree = null;
      }
    },
  });

  function start(): void {
    if (started) return;
    ensure(sdk.install(), "install the SDK");
    ensure(sdk.loadApp("app.js"), "load app.js");
    started = true;
  }

  deliverToService = (event) => {
    ensure(sdk.deliver({ handler: event.handler, event }), `handler ${event.handler}`);
  };

  return {
    sample,
    dom,
    view,

    launch(routeName = sample.app.pages[0], query = {}) {
      if (closed) throw new SampleError("the sample host is closed");
      if (route !== null) throw new SampleError("the sample host is already launched");
      if (!sample.pages.has(routeName)) throw new SampleError(`unknown page ${routeName}`);
      start();
      ensure(sdk.loadPage(routeName), `load ${routeName}.js`);
      ensure(sdk.appLaunch({ path: routeName, query }), "App.onLaunch");
      ensure(sdk.open(routeName, query, pageId), `open ${routeName}`);
    },

    dispatch(event) {
      if (closed) throw new SampleError("the sample host is closed");
      if (route === null) throw new SampleError("dispatch before launch");
      if (deliverToService === null) throw new SampleError("dispatch before the SDK is ready");
      deliverToService(event);
    },

    data() {
      return structuredClone(data);
    },

    route() {
      return route;
    },

    theme() {
      return route === null ? null : theme;
    },

    close() {
      if (closed) return;
      closed = true;
      sdk.clearTimers();
      sdk.rejectCalls();
      view.destroy();
      engine.terminate();
    },
  };
}
