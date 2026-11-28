/**
 * Host-side `wx.*` API implementation (specification section 8, MVP).
 *
 * The engine sends one typed request; this module validates it, applies the
 * policy and answers by id. It owns no engine and no UI: navigation goes through
 * the page stack, storage through the host adapter, network through the injected
 * transport, and UI through typed host events. A missing adapter is
 * `API_UNSUPPORTED`, never a silent fallback.
 */

import {
  API_REGISTRY,
  ERROR_CODES,
  SYSTEM_INFO_FIELDS,
  apiByName,
  miniAppError,
  type ErrorCode,
  type MiniAppError,
  type ResolvedTheme,
  type RuntimeIdentity,
} from "@qchat/miniapp-contracts";
import type { NavigationController } from "./navigation.js";
import { NetworkAdapterError, type NetworkAdapter } from "./network.js";
import type { SdkBridgeRequest, SyncApiResult } from "./sdk-runtime.js";
import { utf8Bytes, type StorageAdapter } from "./storage.js";

export const DEFAULT_STORAGE_QUOTA_BYTES = 10 * 1024 * 1024;
export const DEFAULT_MAX_VALUE_BYTES = 1024 * 1024;
export const DEFAULT_MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
export const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
export const HOST_TOAST_EVENT = "host.toast" as const;
export const HOST_LOADING_EVENT = "host.loading" as const;
export const HOST_MODAL_EVENT = "host.modal" as const;
export const HOST_MODAL_RESULT_EVENT = "host.modalResult" as const;

const METHODS = new Set(["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS", "PATCH"]);
const FORBIDDEN_HEADERS = new Set(["cookie", "set-cookie", "host", "connection", "content-length", "transfer-encoding"]);
const TOAST_ICONS = new Set(["success", "error", "loading", "none"]);

export interface ApiHostOptions {
  identity: RuntimeIdentity;
  navigation: NavigationController;
  /** Routes declared by the package; only these can open. */
  routes: readonly string[];
  /** Tab pages declared by `app.json`; empty means there is no tab bar. */
  tabPages?: readonly string[];
  /** Sends a response back into the engine for one request id. */
  respond: (id: string, response: SyncApiResult) => void;
  /** Durable storage; absent means `wx.*Storage*` is unsupported. */
  storage?: StorageAdapter;
  /** Network transport; absent means `wx.request` is unsupported. */
  network?: NetworkAdapter;
  /** HTTPS hostnames this app may call; empty rejects every request. */
  domains?: readonly string[];
  storageQuotaBytes?: number;
  maxResponseBytes?: number;
  requestTimeoutMs?: number;
  /** Fields the host measured; `theme` is always the resolved theme. */
  systemInfo?: Readonly<Record<string, unknown>>;
  /** Resolved theme of the current page. */
  theme: () => ResolvedTheme;
  /** Typed host events (toast, loading, modal) drawn outside the WebView. */
  emit?: (event: string, payload: Record<string, unknown>) => void;
  now?: () => number;
}

export interface ApiHost {
  /** Dispatch one validated request from the SDK. */
  handle(request: SdkBridgeRequest): void;
  /** Answer a synchronous API; called from inside the engine call. */
  handleSync(method: string, params: Record<string, unknown>): SyncApiResult;
  /** Consume a host event, e.g. the result of `wx.showModal`. */
  handleHostEvent(value: unknown): MiniAppError | null;
  /** Requests waiting for a host result (a modal). */
  pending(): number;
  /** Fail everything still waiting. */
  close(): void;
}

function failure(code: ErrorCode, message?: string): SyncApiResult {
  return { ok: false, error: { code, message: message ?? ERROR_CODES[code].message } };
}

function success(result: Record<string, unknown> = {}): SyncApiResult {
  return { ok: true, result };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= max ? value : null;
}

/** Optional text: absent is `fallback`, an empty string stays empty. */
function readText(value: unknown, max: number, fallback = ""): string | null {
  if (value === undefined) return fallback;
  return typeof value === "string" && value.length <= max ? value : null;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readInteger(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) return null;
  return value;
}

/** `key` rules shared by every storage API. */
export function validateStorageKey(value: unknown): string | null {
  const key = readString(value, 256);
  if (key === null) return null;
  if (/[\u0000-\u001f\u007f]/.test(key)) return null;
  return key;
}

export interface ParsedRoute {
  route: string;
  query: Record<string, string>;
}

/**
 * Parse a navigation URL. Only declared package routes are accepted; a scheme,
 * a fragment, `..`, a backslash or an empty route is rejected.
 */
export function parseRouteUrl(
  raw: unknown,
  declared: ReadonlySet<string>,
): { ok: true; value: ParsedRoute } | { ok: false; error: MiniAppError } {
  const invalid = (): { ok: false; error: MiniAppError } => ({
    ok: false,
    error: miniAppError("NAVIGATION_INVALID_ROUTE", undefined, { url: typeof raw === "string" ? raw.slice(0, 256) : "" }),
  });
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048) return invalid();
  if (/[\u0000-\u001f\u007f\\#]/.test(raw) || raw.includes("..")) return invalid();
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return invalid();

  const withoutSlash = raw.startsWith("/") ? raw.slice(1) : raw;
  const mark = withoutSlash.indexOf("?");
  const route = mark === -1 ? withoutSlash : withoutSlash.slice(0, mark);
  const queryText = mark === -1 ? "" : withoutSlash.slice(mark + 1);
  if (!/^[A-Za-z0-9_][A-Za-z0-9_./-]{0,255}$/.test(route)) return invalid();
  if (!declared.has(route)) return invalid();

  const query: Record<string, string> = {};
  if (queryText.length > 0) {
    let params: URLSearchParams;
    try {
      params = new URLSearchParams(queryText);
    } catch {
      return invalid();
    }
    let count = 0;
    for (const [key, value] of params) {
      count += 1;
      if (count > 32 || key.length === 0 || key.length > 128 || value.length > 512) return invalid();
      if (Object.prototype.hasOwnProperty.call(query, key)) return invalid();
      query[key] = value;
    }
  }
  return { ok: true, value: { route, query } };
}

/** Exact hostname, or a `*.example.com` entry that matches a real subdomain. */
export function hostnameAllowed(hostname: string, domains: readonly string[]): boolean {
  const host = hostname.toLowerCase();
  return domains.some((entry) => {
    const pattern = entry.toLowerCase();
    if (pattern.startsWith("*.")) {
      const suffix = pattern.slice(1);
      return host.length > suffix.length && host.endsWith(suffix);
    }
    return host === pattern;
  });
}

export function createApiHost(options: ApiHostOptions): ApiHost {
  const { identity, navigation, respond, storage, network, theme } = options;
  const declared = new Set(options.routes);
  const tabs = new Set(options.tabPages ?? []);
  const quota = options.storageQuotaBytes ?? DEFAULT_STORAGE_QUOTA_BYTES;
  const maxResponse = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  const requestTimeout = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const domains = options.domains ?? [];
  const modals = new Map<string, string>();
  let modalSeq = 0;

  // The API host answers only registered methods; this set is derived, never
  // hand-written, so an unregistered name can never reach a handler.
  const known = new Set(API_REGISTRY.map((api) => api.name));

  function answer(id: string, method: string, response: SyncApiResult): void {
    if (!response.ok) {
      const error = response.error;
      respond(id, { ok: false, error: { ...error, errMsg: `${method}:fail ${error.message}` } });
      return;
    }
    const result = response.result;
    if (isRecord(result)) {
      respond(id, { ok: true, result: { ...result, errMsg: `${method}:ok` } });
    } else {
      respond(id, { ok: true, result: result ?? { errMsg: `${method}:ok` } });
    }
  }

  function routeFor(params: Record<string, unknown>, kind: "open" | "redirect" | "reLaunch" | "switchTab"): {
    route?: string;
    query?: Record<string, string>;
    error?: SyncApiResult;
  } {
    const parsed = parseRouteUrl(params.url, declared);
    if (!parsed.ok) return { error: { ok: false, error: parsed.error } };
    if (kind === "switchTab" && Object.keys(parsed.value.query).length > 0) {
      return { error: failure("NAVIGATION_INVALID_ROUTE", "switchTab does not accept a query.") };
    }
    if (kind === "switchTab" && !tabs.has(parsed.value.route)) {
      return { error: failure("NAVIGATION_NO_TAB_BAR") };
    }
    return { route: parsed.value.route, query: parsed.value.query };
  }

  function navigate(id: string, method: string, kind: "open" | "redirect" | "reLaunch" | "switchTab", params: Record<string, unknown>): void {
    const target = routeFor(params, kind);
    if (target.error) {
      answer(id, method, target.error);
      return;
    }
    const result = navigation.to(kind, target.route!, target.query);
    if (!result.ok) {
      answer(id, method, { ok: false, error: result.error ?? miniAppError("API_FAILED") });
      return;
    }
    answer(id, method, success());
  }

  function storageUsage(): number {
    if (!storage) return 0;
    return storage.entries().reduce((total, [key, value]) => total + utf8Bytes(key) + utf8Bytes(value), 0);
  }

  function encodeValue(value: unknown): string | SyncApiResult {
    if (value === undefined) return failure("API_INVALID_ARGUMENT", "data must be JSON-serialisable.");
    let encoded: string | undefined;
    try {
      encoded = JSON.stringify(value);
    } catch {
      return failure("API_INVALID_ARGUMENT", "data must be JSON-serialisable.");
    }
    if (encoded === undefined) return failure("API_INVALID_ARGUMENT", "data must be JSON-serialisable.");
    if (utf8Bytes(encoded) > DEFAULT_MAX_VALUE_BYTES) {
      return failure("STORAGE_QUOTA_EXCEEDED", "A single value may not exceed 1 MB.");
    }
    return encoded;
  }

  function setStorageValue(key: string, value: unknown): SyncApiResult {
    if (!storage) return failure("API_UNSUPPORTED", "The host has no storage adapter.");
    const encoded = encodeValue(value);
    if (typeof encoded !== "string") return encoded;
    const previous = storage.read(key);
    const used = storageUsage() - (previous === null ? 0 : utf8Bytes(key) + utf8Bytes(previous));
    if (used + utf8Bytes(key) + utf8Bytes(encoded) > quota) {
      return failure("STORAGE_QUOTA_EXCEEDED");
    }
    storage.write(key, encoded);
    return success();
  }

  function readStorageValue(key: string): { ok: true; found: boolean; value: unknown } | { ok: false; error: SyncApiResult } {
    if (!storage) return { ok: false, error: failure("API_UNSUPPORTED", "The host has no storage adapter.") };
    const raw = storage.read(key);
    if (raw === null) return { ok: true, found: false, value: "" };
    try {
      return { ok: true, found: true, value: JSON.parse(raw) as unknown };
    } catch {
      return { ok: false, error: failure("STORAGE_CORRUPT") };
    }
  }

  function systemInformation(): Record<string, unknown> {
    const info: Record<string, unknown> = {};
    for (const field of SYSTEM_INFO_FIELDS) {
      if (field === "theme") continue;
      if (options.systemInfo && Object.prototype.hasOwnProperty.call(options.systemInfo, field)) {
        info[field] = options.systemInfo[field];
      }
    }
    info.theme = theme();
    info.SDKVersion = identity.baseLibraryVersion;
    return info;
  }

  async function requestApi(id: string, method: string, params: Record<string, unknown>): Promise<void> {
    if (!network) {
      answer(id, method, failure("API_UNSUPPORTED", "The host has no network adapter."));
      return;
    }
    const rawUrl = readString(params.url, 2048);
    if (rawUrl === null) {
      answer(id, method, failure("API_INVALID_ARGUMENT", "url must be a non-empty string."));
      return;
    }
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      answer(id, method, failure("API_INVALID_ARGUMENT", "url is not a valid URL."));
      return;
    }
    if (url.protocol !== "https:") {
      answer(id, method, failure("NETWORK_HTTPS_REQUIRED"));
      return;
    }
    if (url.username !== "" || url.password !== "" || (url.port !== "" && url.port !== "443")) {
      answer(id, method, failure("NETWORK_DOMAIN_REJECTED", "Credentials and non-default ports are not allowed."));
      return;
    }
    if (!hostnameAllowed(url.hostname, domains)) {
      answer(id, method, failure("NETWORK_DOMAIN_REJECTED"));
      return;
    }

    const methodName = typeof params.method === "string" ? params.method.toUpperCase() : "GET";
    if (!METHODS.has(methodName)) {
      answer(id, method, failure("API_INVALID_ARGUMENT", "Unsupported HTTP method."));
      return;
    }
    if (params.responseType !== undefined && params.responseType !== "text") {
      answer(id, method, failure("API_UNSUPPORTED", "Only a text response is supported in the MVP."));
      return;
    }

    const header: Record<string, string> = {};
    if (params.header !== undefined) {
      if (!isRecord(params.header)) {
        answer(id, method, failure("API_INVALID_ARGUMENT", "header must be an object."));
        return;
      }
      const names = Object.keys(params.header);
      if (names.length > 50) {
        answer(id, method, failure("API_INVALID_ARGUMENT", "Too many request headers."));
        return;
      }
      let bytes = 0;
      for (const name of names) {
        const lower = name.toLowerCase();
        const value = params.header[name];
        if (!/^[A-Za-z0-9!#$%&'*+.^_`|~-]{1,64}$/.test(name) || typeof value !== "string" || value.length > 1024) {
          answer(id, method, failure("API_INVALID_ARGUMENT", "Invalid request header."));
          return;
        }
        if (FORBIDDEN_HEADERS.has(lower)) {
          answer(id, method, failure("API_INVALID_ARGUMENT", "This header is controlled by the host."));
          return;
        }
        bytes += utf8Bytes(name) + utf8Bytes(value);
        if (bytes > 8 * 1024) {
          answer(id, method, failure("API_INVALID_ARGUMENT", "Request headers are too large."));
          return;
        }
        header[name] = value;
      }
    }

    let body: string | undefined;
    if (params.data !== undefined) {
      if (methodName === "GET" || methodName === "HEAD") {
        if (isRecord(params.data)) {
          for (const [key, value] of Object.entries(params.data)) {
            if (value === undefined || value === null) continue;
            url.searchParams.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
          }
        } else if (params.data !== null) {
          url.searchParams.set("data", String(params.data));
        }
      } else if (typeof params.data === "string") {
        body = params.data;
      } else {
        try {
          body = JSON.stringify(params.data);
        } catch {
          answer(id, method, failure("API_INVALID_ARGUMENT", "data must be JSON-serialisable."));
          return;
        }
        if (!Object.keys(header).some((name) => name.toLowerCase() === "content-type")) {
          header["content-type"] = "application/json";
        }
      }
    }

    const timeoutMs = params.timeout === undefined ? requestTimeout : readInteger(params.timeout, 1, 60_000);
    if (timeoutMs === null) {
      answer(id, method, failure("API_INVALID_ARGUMENT", "timeout must be 1-60000 ms."));
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const response = await Promise.race([
        network.request({
          url: url.toString(),
          method: methodName,
          header,
          body,
          timeoutMs,
          maxBytes: maxResponse,
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new NetworkAdapterError("NETWORK_TIMEOUT", "The request timed out.")), timeoutMs);
        }),
      ]);
      if (utf8Bytes(response.body) > maxResponse) {
        answer(id, method, failure("NETWORK_RESPONSE_TOO_LARGE"));
        return;
      }
      const contentType = Object.entries(response.header).find(([name]) => name.toLowerCase() === "content-type")?.[1] ?? "";
      const dataType = typeof params.dataType === "string" ? params.dataType : "json";
      let data: unknown = response.body;
      if (dataType === "json" && /json/i.test(contentType)) {
        try {
          data = JSON.parse(response.body) as unknown;
        } catch {
          data = response.body;
        }
      }
      answer(id, method, success({ data, statusCode: response.statusCode, header: response.header }));
    } catch (cause) {
      if (cause instanceof NetworkAdapterError) {
        answer(id, method, failure(cause.code));
      } else {
        answer(id, method, failure("API_FAILED", String(cause).slice(0, 512)));
      }
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  function showModal(id: string, method: string, params: Record<string, unknown>): void {
    const title = readText(params.title, 64);
    const content = readText(params.content, 512);
    if (title === null || content === null) {
      answer(id, method, failure("API_INVALID_ARGUMENT", "title or content is too long."));
      return;
    }
    modalSeq += 1;
    const modalId = `m${modalSeq}`;
    modals.set(modalId, id);
    options.emit?.(HOST_MODAL_EVENT, {
      id: modalId,
      title,
      content,
      showCancel: readBoolean(params.showCancel, true),
      confirmText: readText(params.confirmText, 8, "OK") ?? "OK",
      cancelText: readText(params.cancelText, 8, "Cancel") ?? "Cancel",
    });
  }

  return {
    handle(request) {
      const { id, method, params } = request;
      if (!/^s[0-9]{1,9}$/.test(id)) return;
      if (!known.has(method)) {
        respond(id, { ok: false, error: { code: "BRIDGE_UNKNOWN_METHOD", message: "The bridge method is not registered.", errMsg: `${method}:fail unknown method` } });
        return;
      }

      switch (method) {
        case "wx.navigateTo":
          return navigate(id, method, "open", params);
        case "wx.redirectTo":
          return navigate(id, method, "redirect", params);
        case "wx.reLaunch":
          return navigate(id, method, "reLaunch", params);
        case "wx.switchTab":
          return navigate(id, method, "switchTab", params);
        case "wx.navigateBack": {
          const delta = params.delta === undefined ? 1 : readInteger(params.delta, 1, 100);
          if (delta === null) {
            answer(id, method, failure("API_INVALID_ARGUMENT", "delta must be an integer from 1 to 100."));
            return;
          }
          const result = navigation.back(delta);
          answer(id, method, result.ok ? success({ pageId: result.pageId }) : { ok: false, error: result.error ?? miniAppError("API_FAILED") });
          return;
        }
        case "wx.setStorage": {
          const key = validateStorageKey(params.key);
          if (key === null) return answer(id, method, failure("STORAGE_KEY_INVALID"));
          return answer(id, method, setStorageValue(key, params.data));
        }
        case "wx.getStorage": {
          const key = validateStorageKey(params.key);
          if (key === null) return answer(id, method, failure("STORAGE_KEY_INVALID"));
          const value = readStorageValue(key);
          if (!value.ok) return answer(id, method, value.error);
          if (!value.found) return answer(id, method, failure("API_FAILED", "The key does not exist."));
          return answer(id, method, success({ data: value.value }));
        }
        case "wx.removeStorage": {
          const key = validateStorageKey(params.key);
          if (key === null) return answer(id, method, failure("STORAGE_KEY_INVALID"));
          if (!storage) return answer(id, method, failure("API_UNSUPPORTED", "The host has no storage adapter."));
          storage.remove(key);
          return answer(id, method, success());
        }
        case "wx.clearStorage": {
          if (!storage) return answer(id, method, failure("API_UNSUPPORTED", "The host has no storage adapter."));
          storage.clear();
          return answer(id, method, success());
        }
        case "wx.request":
          void requestApi(id, method, params);
          return;
        case "wx.showToast": {
          const title = readString(params.title, 128);
          if (title === null) return answer(id, method, failure("API_INVALID_ARGUMENT", "title is required."));
          const icon = typeof params.icon === "string" && TOAST_ICONS.has(params.icon) ? params.icon : "success";
          const duration = params.duration === undefined ? 1500 : readInteger(params.duration, 0, 10_000);
          if (duration === null) return answer(id, method, failure("API_INVALID_ARGUMENT", "duration must be 0-10000 ms."));
          options.emit?.(HOST_TOAST_EVENT, { title, icon, duration });
          return answer(id, method, success());
        }
        case "wx.showModal":
          return showModal(id, method, params);
        case "wx.showLoading": {
          const title = readString(params.title, 64);
          if (title === null) return answer(id, method, failure("API_INVALID_ARGUMENT", "title is required."));
          options.emit?.(HOST_LOADING_EVENT, { visible: true, title, mask: readBoolean(params.mask, false) });
          return answer(id, method, success());
        }
        case "wx.hideLoading":
          options.emit?.(HOST_LOADING_EVENT, { visible: false });
          return answer(id, method, success());
        default:
          return answer(id, method, failure("API_UNSUPPORTED"));
      }
    },

    handleSync(method, params) {
      switch (method) {
        case "wx.setStorageSync": {
          const key = validateStorageKey(params.key);
          if (key === null) return failure("STORAGE_KEY_INVALID");
          return setStorageValue(key, params.data);
        }
        case "wx.getStorageSync": {
          const key = validateStorageKey(params.key);
          if (key === null) return failure("STORAGE_KEY_INVALID");
          const value = readStorageValue(key);
          return value.ok ? { ok: true, result: value.value } : value.error;
        }
        case "wx.removeStorageSync": {
          const key = validateStorageKey(params.key);
          if (key === null) return failure("STORAGE_KEY_INVALID");
          if (!storage) return failure("API_UNSUPPORTED", "The host has no storage adapter.");
          storage.remove(key);
          return success();
        }
        case "wx.clearStorageSync": {
          if (!storage) return failure("API_UNSUPPORTED", "The host has no storage adapter.");
          storage.clear();
          return success();
        }
        case "wx.getSystemInfoSync":
          return { ok: true, result: systemInformation() };
        default:
          return failure("API_UNSUPPORTED");
      }
    },

    handleHostEvent(value) {
      if (!isRecord(value) || value.event !== HOST_MODAL_RESULT_EVENT || !isRecord(value.payload)) {
        return miniAppError("BRIDGE_INVALID_MESSAGE", "Unknown host event.");
      }
      const payload = value.payload;
      const modalId = readString(payload.id, 32);
      if (modalId === null || typeof payload.confirm !== "boolean") {
        return miniAppError("BRIDGE_INVALID_MESSAGE", "A modal result needs an id and confirm.");
      }
      const requestId = modals.get(modalId);
      if (requestId === undefined) return miniAppError("BRIDGE_INVALID_MESSAGE", "No modal waits for this id.");
      modals.delete(modalId);
      const result: Record<string, unknown> = { confirm: payload.confirm, cancel: payload.confirm === false };
      if (typeof payload.content === "string") result.content = payload.content.slice(0, 512);
      answer(requestId, "wx.showModal", success(result));
      return null;
    },

    pending() {
      return modals.size;
    },

    close() {
      for (const [modalId, requestId] of modals) {
        modals.delete(modalId);
        answer(requestId, "wx.showModal", failure("BRIDGE_PAGE_CLOSED"));
      }
    },
  };
}
