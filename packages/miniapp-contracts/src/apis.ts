/**
 * API contract (specification section 8).
 *
 * Every `wx.*` API has one registry entry: name, parameters, result, callback
 * and Promise behaviour, permission, platform support, errors and status. The
 * service runtime may only call an API that exists here; the bridge allowlist is
 * derived from this registry.
 */

import { ERROR_CODES, type ErrorCode } from "./errors.js";
import type { Permission } from "./permissions.js";

export const APIS_VERSION = 1 as const;

export const API_STATUSES = ["Not started", "Supported", "Partial", "Unsupported", "Experimental"] as const;
export type ApiStatus = (typeof API_STATUSES)[number];

export const PLATFORMS = ["android", "ios"] as const;
export type Platform = (typeof PLATFORMS)[number];

/** Minimal JSON-ish parameter description used for validation and docs. */
export type ParamType = "string" | "number" | "boolean" | "object" | "array" | "function" | "any";

export interface ApiParam {
  name: string;
  type: ParamType;
  required: boolean;
  description: string;
}

export interface ApiDefinition {
  /** WeChat API name, e.g. `wx.navigateTo`. */
  name: string;
  /** Short description used in the developer docs. */
  summary: string;
  params: readonly ApiParam[];
  /** Type of the success result. */
  result: ParamType | "void";
  /** `callback` APIs take success/fail/complete; `sync` return the result directly. */
  calling: "callback" | "sync";
  /** Promise support is additive; the callback form must keep working. */
  promise: boolean;
  permission: Permission | null;
  platforms: readonly Platform[];
  errors: readonly ErrorCode[];
  status: ApiStatus;
  /** Milestone that must deliver the API. */
  milestone: "M4" | "M7";
}

const p = (name: string, type: ParamType, required: boolean, description: string): ApiParam => ({ name, type, required, description });

export const API_REGISTRY: readonly ApiDefinition[] = [
  {
    name: "wx.navigateTo",
    summary: "Open a new page on top of the stack.",
    params: [p("url", "string", true, "Declared page route, optionally with a query."), p("events", "object", false, "Page-to-page event handlers.")],
    result: "void",
    calling: "callback",
    promise: true,
    permission: null,
    platforms: ["android", "ios"],
    errors: ["NAVIGATION_INVALID_ROUTE", "NAVIGATION_STACK_LIMIT", "BRIDGE_TIMEOUT"],
    status: "Not started",
    milestone: "M4",
  },
  {
    name: "wx.redirectTo",
    summary: "Replace the current page.",
    params: [p("url", "string", true, "Declared page route.")],
    result: "void",
    calling: "callback",
    promise: true,
    permission: null,
    platforms: ["android", "ios"],
    errors: ["NAVIGATION_INVALID_ROUTE", "BRIDGE_TIMEOUT"],
    status: "Not started",
    milestone: "M4",
  },
  {
    name: "wx.switchTab",
    summary: "Switch to a tab bar page.",
    params: [p("url", "string", true, "Declared tab page route.")],
    result: "void",
    calling: "callback",
    promise: true,
    permission: null,
    platforms: ["android", "ios"],
    errors: ["NAVIGATION_INVALID_ROUTE", "NAVIGATION_NO_TAB_BAR", "BRIDGE_TIMEOUT"],
    status: "Not started",
    milestone: "M4",
  },
  {
    name: "wx.navigateBack",
    summary: "Close pages and return to a lower page.",
    params: [p("delta", "number", false, "Number of pages to close; default 1.")],
    result: "void",
    calling: "callback",
    promise: true,
    permission: null,
    platforms: ["android", "ios"],
    errors: ["NAVIGATION_STACK_LIMIT", "BRIDGE_TIMEOUT"],
    status: "Not started",
    milestone: "M4",
  },
  {
    name: "wx.reLaunch",
    summary: "Close every page and open a route.",
    params: [p("url", "string", true, "Declared page route.")],
    result: "void",
    calling: "callback",
    promise: true,
    permission: null,
    platforms: ["android", "ios"],
    errors: ["NAVIGATION_INVALID_ROUTE", "BRIDGE_TIMEOUT"],
    status: "Not started",
    milestone: "M4",
  },
  {
    name: "wx.setStorage",
    summary: "Store a value asynchronously in the Mini App sandbox.",
    params: [p("key", "string", true, "Key, 1-256 characters."), p("data", "any", true, "JSON-serialisable value.")],
    result: "void",
    calling: "callback",
    promise: true,
    permission: "storage",
    platforms: ["android", "ios"],
    errors: ["STORAGE_KEY_INVALID", "STORAGE_QUOTA_EXCEEDED", "BRIDGE_TIMEOUT"],
    status: "Not started",
    milestone: "M4",
  },
  {
    name: "wx.setStorageSync",
    summary: "Store a value synchronously.",
    params: [p("key", "string", true, "Key, 1-256 characters."), p("data", "any", true, "JSON-serialisable value.")],
    result: "void",
    calling: "sync",
    promise: false,
    permission: "storage",
    platforms: ["android", "ios"],
    errors: ["STORAGE_KEY_INVALID", "STORAGE_QUOTA_EXCEEDED"],
    status: "Not started",
    milestone: "M4",
  },
  {
    name: "wx.getStorage",
    summary: "Read a value asynchronously.",
    params: [p("key", "string", true, "Key.")],
    result: "any",
    calling: "callback",
    promise: true,
    permission: "storage",
    platforms: ["android", "ios"],
    errors: ["STORAGE_KEY_INVALID", "STORAGE_CORRUPT", "BRIDGE_TIMEOUT"],
    status: "Not started",
    milestone: "M4",
  },
  {
    name: "wx.getStorageSync",
    summary: "Read a value synchronously.",
    params: [p("key", "string", true, "Key.")],
    result: "any",
    calling: "sync",
    promise: false,
    permission: "storage",
    platforms: ["android", "ios"],
    errors: ["STORAGE_KEY_INVALID", "STORAGE_CORRUPT"],
    status: "Not started",
    milestone: "M4",
  },
  {
    name: "wx.removeStorage",
    summary: "Remove one key asynchronously.",
    params: [p("key", "string", true, "Key.")],
    result: "void",
    calling: "callback",
    promise: true,
    permission: "storage",
    platforms: ["android", "ios"],
    errors: ["STORAGE_KEY_INVALID", "BRIDGE_TIMEOUT"],
    status: "Not started",
    milestone: "M4",
  },
  {
    name: "wx.removeStorageSync",
    summary: "Remove one key synchronously.",
    params: [p("key", "string", true, "Key.")],
    result: "void",
    calling: "sync",
    promise: false,
    permission: "storage",
    platforms: ["android", "ios"],
    errors: ["STORAGE_KEY_INVALID"],
    status: "Not started",
    milestone: "M4",
  },
  {
    name: "wx.clearStorage",
    summary: "Remove every key of this Mini App asynchronously.",
    params: [],
    result: "void",
    calling: "callback",
    promise: true,
    permission: "storage",
    platforms: ["android", "ios"],
    errors: ["BRIDGE_TIMEOUT"],
    status: "Not started",
    milestone: "M4",
  },
  {
    name: "wx.clearStorageSync",
    summary: "Remove every key of this Mini App synchronously.",
    params: [],
    result: "void",
    calling: "sync",
    promise: false,
    permission: "storage",
    platforms: ["android", "ios"],
    errors: [],
    status: "Not started",
    milestone: "M4",
  },
  {
    name: "wx.request",
    summary: "HTTPS request to an allowlisted domain.",
    params: [
      p("url", "string", true, "HTTPS URL on the Mini App domain allowlist."),
      p("method", "string", false, "HTTP method; default GET."),
      p("data", "any", false, "Request body or query data."),
      p("header", "object", false, "Request headers."),
      p("timeout", "number", false, "Timeout in milliseconds."),
    ],
    result: "object",
    calling: "callback",
    promise: true,
    permission: "network",
    platforms: ["android", "ios"],
    errors: ["NETWORK_DOMAIN_REJECTED", "NETWORK_HTTPS_REQUIRED", "NETWORK_TIMEOUT", "NETWORK_RESPONSE_TOO_LARGE", "BRIDGE_TIMEOUT"],
    status: "Not started",
    milestone: "M4",
  },
  {
    name: "wx.showToast",
    summary: "Show a short host-drawn toast.",
    params: [p("title", "string", true, "Text."), p("icon", "string", false, "success, error, loading or none."), p("duration", "number", false, "Milliseconds.")],
    result: "void",
    calling: "callback",
    promise: true,
    permission: null,
    platforms: ["android", "ios"],
    errors: ["BRIDGE_TIMEOUT"],
    status: "Not started",
    milestone: "M4",
  },
  {
    name: "wx.showModal",
    summary: "Show a host-drawn modal with confirm and cancel.",
    params: [p("title", "string", false, "Title."), p("content", "string", false, "Body."), p("showCancel", "boolean", false, "Show cancel; default true.")],
    result: "object",
    calling: "callback",
    promise: true,
    permission: null,
    platforms: ["android", "ios"],
    errors: ["BRIDGE_TIMEOUT", "BRIDGE_CANCELLED"],
    status: "Not started",
    milestone: "M4",
  },
  {
    name: "wx.showLoading",
    summary: "Show a host-drawn loading overlay.",
    params: [p("title", "string", true, "Text."), p("mask", "boolean", false, "Block taps.")],
    result: "void",
    calling: "callback",
    promise: true,
    permission: null,
    platforms: ["android", "ios"],
    errors: ["BRIDGE_TIMEOUT"],
    status: "Not started",
    milestone: "M4",
  },
  {
    name: "wx.hideLoading",
    summary: "Hide the loading overlay.",
    params: [],
    result: "void",
    calling: "callback",
    promise: true,
    permission: null,
    platforms: ["android", "ios"],
    errors: ["BRIDGE_TIMEOUT"],
    status: "Not started",
    milestone: "M4",
  },
  {
    name: "wx.getSystemInfoSync",
    summary: "Read the documented system information fields, including the resolved theme.",
    params: [],
    result: "object",
    calling: "sync",
    promise: false,
    permission: null,
    platforms: ["android", "ios"],
    errors: [],
    status: "Not started",
    milestone: "M4",
  },
  {
    name: "wx.onThemeChange",
    summary: "Listen for a change of the resolved theme.",
    params: [p("callback", "function", true, "Called with the resolved theme.")],
    result: "void",
    calling: "sync",
    promise: false,
    permission: null,
    platforms: ["android", "ios"],
    errors: [],
    status: "Not started",
    milestone: "M7",
  },
  {
    name: "wx.offThemeChange",
    summary: "Remove a resolved-theme listener.",
    params: [p("callback", "function", false, "Listener to remove; all when omitted.")],
    result: "void",
    calling: "sync",
    promise: false,
    permission: null,
    platforms: ["android", "ios"],
    errors: [],
    status: "Not started",
    milestone: "M7",
  },
] as const;

export function apiByName(name: string): ApiDefinition | undefined {
  return API_REGISTRY.find((api) => api.name === name);
}

/** The bridge method allowlist is derived from the registry, never hand-written. */
export function bridgeMethodAllowlist(): string[] {
  return API_REGISTRY.map((api) => api.name);
}

/** Fields returned by `wx.getSystemInfoSync` in this runtime version. */
export const SYSTEM_INFO_FIELDS = [
  "platform",
  "system",
  "brand",
  "model",
  "pixelRatio",
  "screenWidth",
  "screenHeight",
  "windowWidth",
  "windowHeight",
  "statusBarHeight",
  "safeArea",
  "language",
  "version",
  "SDKVersion",
  "theme",
] as const;

export type SystemInfoField = (typeof SYSTEM_INFO_FIELDS)[number];

/** Error codes that are API-level and may appear in a failed response. */
export const API_ERROR_CODES: readonly ErrorCode[] = Object.keys(ERROR_CODES).filter(
  (code) => code.startsWith("API_") || code.startsWith("NAVIGATION_") || code.startsWith("STORAGE_") || code.startsWith("NETWORK_"),
) as ErrorCode[];
