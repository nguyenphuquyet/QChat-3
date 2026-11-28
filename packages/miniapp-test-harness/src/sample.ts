/**
 * Sample package loader.
 *
 * A sample is a native WeChat-style source tree: `app.json`, `app.js`,
 * `app.wxss`, then one `.wxml`, `.wxss`, `.js` and optional `.json` per page.
 * This module reads it from disk, confines every path to the package root and
 * compiles the WXML and WXSS once. The JavaScript is loaded by the harness's
 * engine, never by this module.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  VIEW_BUNDLE_FORMAT,
  VIEW_BUNDLE_PATH,
  VIEW_BUNDLE_VERSION,
  compileWxml,
  compileWxss,
  formatDiagnostic,
  reviveWxml,
  type CompiledWxml,
  type CompiledWxss,
  type CompileResult,
  type ViewBundle,
} from "@qchat/miniapp-compiler";
import { isSafePackagePath, isSafeRoute } from "@qchat/miniapp-contracts";

export type SampleColorScheme = "light" | "dark" | "auto";

export interface SampleAppConfig {
  pages: readonly string[];
  window?: Readonly<Record<string, unknown>>;
  qxColorScheme?: SampleColorScheme;
  [key: string]: unknown;
}

export interface CompiledPage {
  route: string;
  config: Record<string, unknown>;
  wxml: CompiledWxml;
  wxss: CompiledWxss;
  /** App WXSS followed by page WXSS, already compiled. */
  css: string;
}

export interface SamplePackage {
  root: string;
  app: SampleAppConfig;
  appWxss: CompiledWxss;
  pages: ReadonlyMap<string, CompiledPage>;
  /** Read one package file, or `null` when it is absent or unsafe. */
  read(path: string): string | null;
}

export class SampleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SampleError";
  }
}

function readSource(root: string, path: string): string | null {
  if (!isSafePackagePath(path)) return null;
  try {
    return readFileSync(join(root, path), "utf8");
  } catch {
    return null;
  }
}

function parseJson(text: string, file: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (cause) {
    throw new SampleError(`${file}: invalid JSON (${String(cause)})`);
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new SampleError(`${file}: the top level must be an object`);
  }
  return value as Record<string, unknown>;
}

function unwrap<T>(result: CompileResult<T>, file: string): T {
  if (result.ok) return result.value;
  const first = result.diagnostics[0];
  throw new SampleError(`${file}: ${first ? formatDiagnostic(first) : "compilation failed"}`);
}

/**
 * Load and compile a sample package. Every page listed in `app.json` must have
 * a WXML file; a missing WXSS or page JSON is an empty file, as in WeChat.
 */
export function loadSample(root: string): SamplePackage {
  const read = (path: string): string | null => readSource(root, path);

  const appText = read("app.json");
  if (appText === null) throw new SampleError("app.json is missing");
  const app = parseJson(appText, "app.json");

  const pages = app.pages;
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new SampleError("app.json: pages must be a non-empty array");
  }
  for (const route of pages) {
    if (typeof route !== "string" || !isSafeRoute(route) || route.includes("..")) {
      throw new SampleError(`app.json: unsafe page route ${JSON.stringify(route)}`);
    }
  }
  const scheme = app.qxColorScheme;
  if (scheme !== undefined && scheme !== "light" && scheme !== "dark" && scheme !== "auto") {
    throw new SampleError(`app.json: unsupported qxColorScheme ${JSON.stringify(scheme)}`);
  }

  const appWxss = unwrap(
    compileWxss(read("app.wxss") ?? "", "app.wxss", { loadFile: read }),
    "app.wxss",
  );

  const compiled = new Map<string, CompiledPage>();
  for (const route of pages as string[]) {
    const wxmlSource = read(`${route}.wxml`);
    if (wxmlSource === null) throw new SampleError(`${route}.wxml is missing`);
    const wxml = unwrap(
      compileWxml(wxmlSource, `${route}.wxml`, { loadFile: read }),
      `${route}.wxml`,
    );
    const wxss = unwrap(
      compileWxss(read(`${route}.wxss`) ?? "", `${route}.wxss`, { loadFile: read }),
      `${route}.wxss`,
    );
    const configText = read(`${route}.json`);
    const config = configText === null ? {} : parseJson(configText, `${route}.json`);
    compiled.set(route, { route, config, wxml, wxss, css: `${appWxss.css}${wxss.css}` });
  }

  return { root, app: app as unknown as SampleAppConfig, appWxss, pages: compiled, read };
}

function bundleError(message: string): SampleError {
  return new SampleError(`${VIEW_BUNDLE_PATH}: ${message}`);
}

/**
 * Load an installed package: the same source tree plus the compiled bundle the
 * packager produced. No WXML or WXSS is compiled here, so this is the path a
 * device takes after verification. A bundle whose pages do not match `app.json`
 * is rejected instead of falling back to the sources.
 */
export function loadInstalledPackage(root: string): SamplePackage {
  const read = (path: string): string | null => readSource(root, path);

  const appText = read("app.json");
  if (appText === null) throw new SampleError("app.json is missing");
  const app = parseJson(appText, "app.json");
  const pages = app.pages;
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new SampleError("app.json: pages must be a non-empty array");
  }

  const bundleText = read(VIEW_BUNDLE_PATH);
  if (bundleText === null) throw new SampleError(`${VIEW_BUNDLE_PATH} is missing`);
  let raw: unknown;
  try {
    raw = JSON.parse(bundleText);
  } catch {
    throw bundleError("the bundle is not valid JSON");
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw bundleError("the bundle is not an object");
  const bundle = raw as Partial<ViewBundle>;
  if (bundle.format !== VIEW_BUNDLE_FORMAT) throw bundleError("unknown format");
  if (bundle.formatVersion !== VIEW_BUNDLE_VERSION) throw bundleError("unsupported format version");
  if (typeof bundle.appCss !== "string") throw bundleError("appCss is missing");
  if (typeof bundle.pages !== "object" || bundle.pages === null || Array.isArray(bundle.pages)) {
    throw bundleError("pages is missing");
  }

  const declared = pages as string[];
  const built = Object.keys(bundle.pages).sort();
  if (built.length !== declared.length || [...declared].sort().some((route, index) => route !== built[index])) {
    throw bundleError("the compiled pages do not match app.json");
  }

  const compiled = new Map<string, CompiledPage>();
  for (const route of declared) {
    const page = bundle.pages[route];
    if (typeof page !== "object" || page === null) throw bundleError(`page ${route} is missing`);
    const wxml = page.wxml;
    if (
      typeof wxml !== "object" ||
      wxml === null ||
      !Array.isArray(wxml.nodes) ||
      typeof wxml.templates !== "object" ||
      wxml.templates === null ||
      !Array.isArray(wxml.files)
    ) {
      throw bundleError(`page ${route} has a malformed WXML artifact`);
    }
    if (typeof page.css !== "string") throw bundleError(`page ${route} has no CSS`);
    const config =
      typeof page.config === "object" && page.config !== null && !Array.isArray(page.config)
        ? (page.config as Record<string, unknown>)
        : {};
    compiled.set(route, {
      route,
      config,
      wxml: reviveWxml(wxml),
      wxss: { file: `${route}.wxss`, css: page.css, files: [] },
      css: page.css,
    });
  }

  const appWxss: CompiledWxss = { file: "app.wxss", css: bundle.appCss, files: [] };
  return { root, app: app as unknown as SampleAppConfig, appWxss, pages: compiled, read };
}
