/**
 * QChat Mini App Service Runtime — M1 spike.
 *
 * Scope of this spike: `App`, `Page`, `setData`, lifecycle callbacks, the page
 * stack and typed bridge messages. It is deliberately small. The isolated
 * JavaScript engine (ADR 009), module loading, timers and the `wx.*` API
 * implementations arrive in M2/M4. Nothing here imports the legacy QApp
 * runtime.
 *
 * The page's `render(data)` function is a stand-in for the M3 WXML compiler
 * output. It receives page data and returns a render tree; it is the only place
 * the spike turns data into UI, and it never produces HTML.
 */

import {
  MAX_PAGE_STACK,
  VIEW_DESTROY_EVENT,
  VIEW_RENDER_EVENT,
  VIEW_THEME_EVENT,
  canTransitionPage,
  followsHost,
  isResolvedTheme,
  miniAppError,
  parseBridgeMessage,
  resolveTheme,
  validateRenderNode,
  type BridgeBinding,
  type BridgeEvent,
  type BridgeMessage,
  type HostTheme,
  type MiniAppError,
  type PageInstance,
  type PageState,
  type RenderNode,
  type ResolvedTheme,
  type RuntimeIdentity,
  type ThemeDeclaration,
  type ViewEvent,
} from "@qchat/miniapp-contracts";

export * from "./engine.js";
export * from "./node-engine.js";
export * from "./bridge-client.js";

export interface ServiceTransport {
  /** Send one validated bridge message to the host. */
  send(message: BridgeMessage): void;
}

export type PageHandler = (event: ViewEvent) => void;

export interface PageOptions {
  /** Initial page data; deep-copied per page instance. */
  data?: Record<string, unknown>;
  /** Page-level override of the app's `qxColorScheme`. */
  qxColorScheme?: "light" | "dark" | "auto";
  onLoad?(query: Record<string, string>): void;
  onShow?(): void;
  onHide?(): void;
  onUnload?(): void;
  /** Stand-in for compiled WXML: page data to render tree. */
  render(data: Readonly<Record<string, unknown>>): RenderNode;
  /** Event handlers referenced by `events` in the render tree. */
  handlers?: Record<string, PageHandler>;
}

export interface AppOptions {
  onLaunch?(options: { path: string; query: Record<string, string> }): void;
  onShow?(options: { path: string; query: Record<string, string> }): void;
  onHide?(): void;
  onError?(error: MiniAppError): void;
}

export interface ServiceRuntimeOptions {
  identity: RuntimeIdentity;
  transport: ServiceTransport;
  /** App-level theme; a page may override it. */
  theme: ThemeDeclaration;
  /** Host's effective theme; only used by `auto`. */
  hostTheme?: HostTheme;
  /** Page definitions, keyed by route. */
  pages: Record<string, PageOptions>;
  app?: AppOptions;
}

export interface OpenPageResult {
  ok: boolean;
  pageId?: string;
  error?: MiniAppError;
}

interface PageRecord {
  instance: PageInstance;
  options: PageOptions;
  data: Record<string, unknown>;
  declaration: ThemeDeclaration;
}

export interface ServiceRuntime {
  readonly identity: RuntimeIdentity;
  launch(route: string, query?: Record<string, string>): OpenPageResult;
  navigateTo(route: string, query?: Record<string, string>): OpenPageResult;
  navigateBack(delta?: number): OpenPageResult;
  /** Apply a `setData` patch to the top page and render it. */
  setData(patch: Record<string, unknown>): OpenPageResult;
  /** Route one event from the View Runtime to the top page handler. */
  dispatchViewEvent(event: ViewEvent): OpenPageResult;
  /** Consume a bridge message from the host. */
  handleMessage(value: unknown): MiniAppError | null;
  /** Change the host theme; fixed-theme pages receive nothing. */
  setHostTheme(theme: HostTheme): MiniAppError | null;
  currentPage(): Readonly<PageInstance> | null;
  pageStack(): readonly Readonly<PageInstance>[];
  pageData(pageId?: string): Readonly<Record<string, unknown>> | null;
  resolvedTheme(pageId?: string): ResolvedTheme | null;
  close(): void;
}

const ROUTE = /^[a-zA-Z0-9_][a-zA-Z0-9_./-]{0,255}$/;

function clone<T>(value: T): T {
  return structuredClone(value);
}

/**
 * Parse a `setData` key: `a.b`, `list[0].name`, `map["k"]` is rejected. Only
 * dot and numeric index paths are accepted, so a key can never address a
 * prototype or a host object.
 */
const FORBIDDEN_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

export function parseDataPath(key: string): (string | number)[] | null {
  if (typeof key !== "string" || key.length === 0 || key.length > 256) return null;
  const segments: (string | number)[] = [];
  for (const part of key.split(".")) {
    if (part.length === 0) return null;
    const match = /^([A-Za-z_$][A-Za-z0-9_$]*)((?:\[\d+\])*)$/.exec(part);
    if (!match) return null;
    if (FORBIDDEN_SEGMENTS.has(match[1])) return null;
    segments.push(match[1]);
    const indexes = match[2].match(/\d+/g) ?? [];
    for (const index of indexes) {
      const parsed = Number(index);
      if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 100_000) return null;
      segments.push(parsed);
    }
  }
  return segments;
}

function assignPath(target: Record<string, unknown>, segments: readonly (string | number)[], value: unknown): boolean {
  let cursor: unknown = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const next = segments[index + 1];
    if (typeof segment === "number") {
      if (!Array.isArray(cursor) || segment >= cursor.length) return false;
      cursor = cursor[segment];
    } else {
      if (typeof cursor !== "object" || cursor === null || Array.isArray(cursor)) return false;
      const record = cursor as Record<string, unknown>;
      if (!Object.prototype.hasOwnProperty.call(record, segment)) {
        // Create the container the next segment needs.
        record[segment] = typeof next === "number" ? [] : {};
      }
      cursor = record[segment];
    }
  }
  const last = segments[segments.length - 1];
  if (typeof last === "number") {
    if (!Array.isArray(cursor)) return false;
    cursor[last] = value;
    return true;
  }
  if (typeof cursor !== "object" || cursor === null || Array.isArray(cursor)) return false;
  (cursor as Record<string, unknown>)[last] = value;
  return true;
}

export function createServiceRuntime(options: ServiceRuntimeOptions): ServiceRuntime {
  const { identity, transport, pages, app } = options;
  const stack: PageRecord[] = [];
  let hostTheme: HostTheme = options.hostTheme ?? "light";
  let pageCounter = 0;
  let launched = false;
  let closed = false;

  const bindingFor = (page: PageRecord): BridgeBinding => ({
    appId: identity.appId,
    sessionId: identity.sessionId,
    pageId: page.instance.pageId,
  });

  function emit(page: PageRecord, event: string, payload: Record<string, unknown>): void {
    const message: BridgeEvent = {
      v: 1,
      kind: "event",
      appId: identity.appId,
      sessionId: identity.sessionId,
      pageId: page.instance.pageId,
      event,
      payload,
    };
    const parsed = parseBridgeMessage(message, bindingFor(page));
    if (!parsed.ok) throw new Error(`service produced an invalid message: ${parsed.error.code}`);
    transport.send(parsed.message);
  }

  function declarationFor(route: string): ThemeDeclaration {
    const page = pages[route];
    const pageScheme = page?.qxColorScheme;
    const declaration: ThemeDeclaration = { app: options.theme.app };
    if (options.theme.page) declaration.page = options.theme.page;
    if (pageScheme === "light" || pageScheme === "dark" || pageScheme === "auto") {
      declaration.page = pageScheme;
    }
    return declaration;
  }

  function resolvedFor(page: PageRecord): ResolvedTheme {
    return resolveTheme(page.declaration, hostTheme);
  }

  function render(page: PageRecord): OpenPageResult {
    const theme = resolvedFor(page);
    const tree = page.options.render(page.data);
    if (!validateRenderNode(tree)) {
      const error = miniAppError("RUNTIME_SCRIPT_ERROR", "The page render tree is invalid.");
      app?.onError?.(error);
      return { ok: false, error };
    }
    emit(page, VIEW_RENDER_EVENT, { tree: tree as unknown as Record<string, unknown>, theme });
    return { ok: true, pageId: page.instance.pageId };
  }

  function transition(page: PageRecord, to: PageState): boolean {
    if (!canTransitionPage(page.instance.state, to)) return false;
    page.instance = { ...page.instance, state: to };
    return true;
  }

  function top(): PageRecord | undefined {
    return stack[stack.length - 1];
  }

  function open(route: string, query: Record<string, string> = {}): OpenPageResult {
    if (closed) return { ok: false, error: miniAppError("RUNTIME_CRASH", "The runtime is closed.") };
    if (typeof route !== "string" || !ROUTE.test(route) || route.includes("..")) {
      return { ok: false, error: miniAppError("NAVIGATION_INVALID_ROUTE", undefined, { route }) };
    }
    const pageOptions = pages[route];
    if (!pageOptions) {
      return { ok: false, error: miniAppError("NAVIGATION_INVALID_ROUTE", undefined, { route }) };
    }
    if (stack.length >= MAX_PAGE_STACK) {
      return { ok: false, error: miniAppError("NAVIGATION_STACK_LIMIT", undefined, { limit: MAX_PAGE_STACK }) };
    }

    if (!launched) {
      launched = true;
      app?.onLaunch?.({ path: route, query });
    }

    const previous = top();
    if (previous) {
      previous.options.onHide?.();
      transition(previous, "hidden");
    }

    pageCounter += 1;
    const page: PageRecord = {
      instance: { pageId: `p${pageCounter}`, route, state: "created", index: stack.length },
      options: pageOptions,
      data: clone(pageOptions.data ?? {}),
      declaration: declarationFor(route),
    };
    stack.push(page);
    transition(page, "loading");
    try {
      pageOptions.onLoad?.(query);
    } catch (cause) {
      app?.onError?.(miniAppError("RUNTIME_SCRIPT_ERROR", String(cause)));
      stack.pop();
      return { ok: false, error: miniAppError("RUNTIME_SCRIPT_ERROR", String(cause)) };
    }
    pageOptions.onShow?.();
    transition(page, "ready");
    return render(page);
  }

  function pageById(pageId: string | undefined): PageRecord | undefined {
    if (!pageId) return top();
    return stack.find((page) => page.instance.pageId === pageId);
  }

  return {
    identity,

    launch(route, query = {}) {
      if (stack.length > 0) return { ok: false, error: miniAppError("NAVIGATION_INVALID_ROUTE", "The app is already launched.") };
      return open(route, query);
    },

    navigateTo(route, query = {}) {
      return open(route, query);
    },

    navigateBack(delta = 1) {
      if (!Number.isSafeInteger(delta) || delta < 1) {
        return { ok: false, error: miniAppError("NAVIGATION_INVALID_ROUTE", "delta must be a positive integer.") };
      }
      if (stack.length <= 1) {
        return { ok: false, error: miniAppError("NAVIGATION_STACK_LIMIT", "There is no page to go back to.") };
      }
      const target = Math.max(0, stack.length - 1 - delta);
      while (stack.length - 1 > target) {
        const page = stack.pop();
        if (!page) break;
        page.options.onHide?.();
        page.options.onUnload?.();
        transition(page, "unloaded");
        emit(page, VIEW_DESTROY_EVENT, {});
      }
      const current = top();
      if (current) {
        transition(current, "ready");
        current.options.onShow?.();
        return render(current);
      }
      return { ok: true };
    },

    setData(patch) {
      const page = top();
      if (!page) return { ok: false, error: miniAppError("BRIDGE_PAGE_CLOSED") };
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
        return { ok: false, error: miniAppError("API_INVALID_ARGUMENT", "setData needs an object.") };
      }
      const next = clone(page.data);
      for (const [key, value] of Object.entries(patch)) {
        const segments = parseDataPath(key);
        if (!segments) {
          return { ok: false, error: miniAppError("API_INVALID_ARGUMENT", "Invalid setData key.", { key }) };
        }
        if (!assignPath(next, segments, clone(value))) {
          return { ok: false, error: miniAppError("API_INVALID_ARGUMENT", "setData path does not exist.", { key }) };
        }
      }
      page.data = next;
      return render(page);
    },

    dispatchViewEvent(event) {
      const page = top();
      if (!page) return { ok: false, error: miniAppError("BRIDGE_PAGE_CLOSED") };
      if (!event || typeof event.handler !== "string") {
        return { ok: false, error: miniAppError("BRIDGE_INVALID_MESSAGE", "A view event needs a handler.") };
      }
      const handler = page.options.handlers?.[event.handler];
      if (!handler) {
        return { ok: false, error: miniAppError("BRIDGE_UNKNOWN_METHOD", "The page has no such handler.", { handler: event.handler }) };
      }
      try {
        handler(event);
      } catch (cause) {
        const error = miniAppError("RUNTIME_SCRIPT_ERROR", String(cause), { handler: event.handler });
        app?.onError?.(error);
        return { ok: false, error };
      }
      return { ok: true, pageId: page.instance.pageId };
    },

    handleMessage(value) {
      const page = top();
      if (!page) return miniAppError("BRIDGE_PAGE_CLOSED");
      const parsed = parseBridgeMessage(value, bindingFor(page));
      if (!parsed.ok) return parsed.error;
      if (parsed.message.kind === "event" && parsed.message.event === "host.themeChange") {
        const theme = parsed.message.payload.theme;
        if (!isResolvedTheme(theme)) return miniAppError("THEME_INVALID_VALUE");
        return this.setHostTheme(theme);
      }
      return miniAppError("BRIDGE_UNKNOWN_METHOD", "The service runtime does not handle this event.", { event: parsed.message.kind === "event" ? parsed.message.event : parsed.message.kind });
    },

    setHostTheme(theme) {
      if (!isResolvedTheme(theme)) return miniAppError("THEME_INVALID_VALUE");
      if (hostTheme === theme) return null;
      hostTheme = theme;
      for (const page of stack) {
        if (!followsHost(page.declaration)) continue;
        emit(page, VIEW_THEME_EVENT, { theme: resolvedFor(page) });
      }
      return null;
    },

    currentPage() {
      return top()?.instance ?? null;
    },

    pageStack() {
      return stack.map((page) => page.instance);
    },

    pageData(pageId) {
      const page = pageById(pageId);
      return page ? clone(page.data) : null;
    },

    resolvedTheme(pageId) {
      const page = pageById(pageId);
      return page ? resolvedFor(page) : null;
    },

    close() {
      if (closed) return;
      closed = true;
      while (stack.length > 0) {
        const page = stack.pop();
        if (!page) break;
        page.options.onHide?.();
        page.options.onUnload?.();
        transition(page, "unloaded");
        emit(page, VIEW_DESTROY_EVENT, {});
      }
      app?.onHide?.();
    },
  };
}
