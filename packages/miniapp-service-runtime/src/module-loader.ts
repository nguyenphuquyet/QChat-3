/**
 * Module loader for the Service Runtime.
 *
 * WeChat packages are a set of files; `require('./util')` resolves relative to
 * the requiring module. The host reads the source from the verified package and
 * evaluates it in the same engine context, so every module shares the SDK
 * globals but never sees the host. Resolution is confined to the package root:
 * a path that escapes it is rejected before a file is read.
 */

import { miniAppError, type MiniAppError } from "@qchat/miniapp-contracts";
import type { EngineEvaluation, ServiceEngine } from "./engine.js";

export interface ModuleSource {
  /** Return the source of a package path, or `null` when it does not exist. */
  read(path: string): string | null;
}

export interface ModuleLoaderOptions {
  engine: ServiceEngine;
  source: ModuleSource;
  /** Called before a module body runs, so `Page()` knows its route. */
  beforeEvaluate?: (path: string) => void;
  /** Called after a module body finishes, including on failure. */
  afterEvaluate?: (path: string) => void;
}

export interface ModuleLoader {
  /** Load an entry module and return its exports. */
  load(entry: string): EngineEvaluation;
  /** Paths already evaluated, in order. */
  loaded(): readonly string[];
  has(path: string): boolean;
}

/** Resolve `request` from `from` without leaving the package root. */
export function resolveModulePath(from: string, request: string): string | null {
  if (typeof request !== "string" || request.length === 0 || request.length > 512) return null;
  if (request.startsWith("/") || request.includes("\\") || request.includes("\0")) return null;
  if (/^[A-Za-z]:/.test(request)) return null;
  const base = request.startsWith(".")
    ? from.slice(0, Math.max(0, from.lastIndexOf("/") + 1)) + request
    : request;
  const segments: string[] = [];
  for (const segment of base.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (segments.length === 0) return null;
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  if (segments.length === 0) return null;
  const joined = segments.join("/");
  if (joined.startsWith("node_modules/")) return null;
  return joined.endsWith(".js") ? joined : `${joined}.js`;
}

export function createModuleLoader(options: ModuleLoaderOptions): ModuleLoader {
  const { engine, source } = options;
  const cache = new Map<string, unknown>();
  const order: string[] = [];
  let loading = new Set<string>();
  let currentFrom = "";

  function fail(error: MiniAppError): EngineEvaluation {
    return { ok: false, error, durationMs: 0 };
  }

  function loadModule(path: string): EngineEvaluation {
    if (cache.has(path)) return { ok: true, value: cache.get(path), durationMs: 0 };
    if (loading.has(path)) {
      return fail(miniAppError("RUNTIME_SCRIPT_ERROR", "Circular require.", { path }));
    }
    const code = source.read(path);
    if (code === null) {
      return fail(miniAppError("NAVIGATION_INVALID_ROUTE", "Module not found.", { path }));
    }
    if (code.length > 8 * 1024 * 1024) {
      return fail(miniAppError("RUNTIME_SCRIPT_ERROR", "Module is too large.", { path }));
    }

    loading.add(path);
    options.beforeEvaluate?.(path);
    const previousFrom = currentFrom;
    currentFrom = path;

    const wrapper = `globalThis.__qchatModuleFn = (function (require, module, exports) {\n${code}\n});\ntrue;`;
    const prepared = engine.evaluate(wrapper, path);
    if (!prepared.ok) {
      loading.delete(path);
      currentFrom = previousFrom;
      options.afterEvaluate?.(path);
      return prepared;
    }

    const executed = engine.evaluate(
      `globalThis.__qchatModuleObj = { exports: {} };
       globalThis.__qchatModuleFn(globalThis.__qchatRequireHost, globalThis.__qchatModuleObj, globalThis.__qchatModuleObj.exports);
       globalThis.__qchatModuleObj.exports`,
      `${path}#run`,
    );
    loading.delete(path);
    currentFrom = previousFrom;
    options.afterEvaluate?.(path);
    if (!executed.ok) return executed;
    cache.set(path, executed.value);
    order.push(path);
    return executed;
  }

  // The host function the module wrapper calls. It is installed once and reads
  // `currentFrom`, which the loader sets around each evaluation.
  engine.defineGlobal("__qchatRequireHost", (request: string) => {
    const resolved = resolveModulePath(currentFrom, request);
    if (!resolved) throw new Error(`cannot resolve require(${JSON.stringify(request)})`);
    const result = loadModule(resolved);
    if (!result.ok) throw new Error(result.error?.message ?? "module load failed");
    return result.value;
  });

  return {
    load(entry) {
      const resolved = resolveModulePath("", entry);
      if (!resolved) return fail(miniAppError("NAVIGATION_INVALID_ROUTE", "Invalid module path.", { entry }));
      return loadModule(resolved);
    },
    loaded() {
      return [...order];
    },
    has(path) {
      return cache.has(path);
    },
  };
}
