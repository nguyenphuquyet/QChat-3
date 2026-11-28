/**
 * Host-side navigation controller.
 *
 * The engine owns the page stack and lifecycle; the host owns module loading and
 * page ids. This controller joins them: it loads a page module once, allocates a
 * `p<n>` id, and calls the engine navigation primitive. It never invents a route:
 * only pages declared by the package can be opened.
 */

import { ERROR_CODES, miniAppError, type ErrorCode, type MiniAppError } from "@qchat/miniapp-contracts";
import type { NavigationKind, SdkRuntime } from "./sdk-runtime.js";

export interface NavigationResult {
  ok: boolean;
  pageId?: string;
  error?: MiniAppError;
}

export interface NavigationOptions {
  sdk: SdkRuntime;
  /** Routes declared by the package; the only routes that can open. */
  routes: readonly string[];
  tabPages?: readonly string[];
}

export interface NavigationController {
  /** Open a route on top of the stack. */
  to(kind: NavigationKind, route: string, query?: Record<string, string>): NavigationResult;
  /** Close pages and return to a lower page. */
  back(delta?: number): NavigationResult;
}

function engineFailure(code: unknown, fallback: ErrorCode): MiniAppError {
  if (typeof code === "string" && Object.prototype.hasOwnProperty.call(ERROR_CODES, code)) {
    return miniAppError(code as ErrorCode);
  }
  return miniAppError(fallback);
}

export function createNavigationController(options: NavigationOptions): NavigationController {
  const { sdk, routes, tabPages = [] } = options;
  const declared = new Set(routes);
  const tabs = new Set(tabPages);
  const loaded = new Set<string>();
  let counter = 0;

  function nextPageId(): string | null {
    counter += 1;
    if (counter > 999_999) return null;
    return `p${counter}`;
  }

  function load(route: string): MiniAppError | null {
    if (loaded.has(route)) return null;
    const result = sdk.loadPage(route);
    if (!result.ok) return result.error ?? miniAppError("RUNTIME_SCRIPT_ERROR", "The page module failed to load.");
    loaded.add(route);
    return null;
  }

  function readValue(result: { ok: boolean; value?: unknown; error?: MiniAppError }): {
    ok: boolean;
    pageId?: string;
    code?: unknown;
  } {
    if (!result.ok) return { ok: false };
    const value = result.value;
    if (typeof value !== "object" || value === null) return { ok: false };
    const record = value as Record<string, unknown>;
    return {
      ok: record.ok === true,
      pageId: typeof record.pageId === "string" ? record.pageId : undefined,
      code: record.code,
    };
  }

  return {
    to(kind, route, query = {}) {
      if (!declared.has(route)) {
        return { ok: false, error: miniAppError("NAVIGATION_INVALID_ROUTE", undefined, { route }) };
      }
      if (kind === "switchTab" && !tabs.has(route)) {
        return { ok: false, error: miniAppError("NAVIGATION_NO_TAB_BAR", undefined, { route }) };
      }
      const failed = load(route);
      if (failed) return { ok: false, error: failed };

      const pageId = nextPageId();
      if (pageId === null) return { ok: false, error: miniAppError("RUNTIME_CRASH", "The page id space is exhausted.") };

      const result = sdk.navigate(kind, route, query, pageId);
      if (!result.ok) return { ok: false, error: result.error ?? miniAppError("RUNTIME_SCRIPT_ERROR") };
      const value = readValue(result);
      if (!value.ok) return { ok: false, error: engineFailure(value.code, "NAVIGATION_INVALID_ROUTE") };
      return { ok: true, pageId: value.pageId ?? pageId };
    },

    back(delta = 1) {
      if (!Number.isSafeInteger(delta) || delta < 1 || delta > 100) {
        return { ok: false, error: miniAppError("API_INVALID_ARGUMENT", "delta must be an integer from 1 to 100.") };
      }
      const result = sdk.back(delta);
      if (!result.ok) return { ok: false, error: result.error ?? miniAppError("RUNTIME_SCRIPT_ERROR") };
      const value = readValue(result);
      if (!value.ok) return { ok: false, error: engineFailure(value.code, "NAVIGATION_STACK_LIMIT") };
      return { ok: true, pageId: value.pageId };
    },
  };
}
