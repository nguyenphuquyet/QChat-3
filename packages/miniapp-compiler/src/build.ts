/**
 * Build-time view artifacts and the compile-and-package entry point
 * (specification sections 4.2 and 10).
 *
 * A Mini App runs on a phone that has no Node.js and no compiler. The packager
 * therefore compiles every page's WXML and WXSS once and ships the result as
 * `build/view.json`, a versioned JSON document the host can read without a
 * compiler. The original sources stay in the package for traceability and for
 * rebuilding, but they are never parsed on the device.
 *
 * The bundle is JSON only: no HTML, no JavaScript, no evaluated data. Every
 * expression is a typed node, so a host that renders it cannot execute page
 * data as code.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  isSafeRoute,
  miniAppError,
  type MiniAppError,
} from "@qchat/miniapp-contracts";
import {
  compileWxml,
  type CompiledWxml,
  type TemplateNode,
} from "./wxml-compiler.js";
import {
  loadComponentRegistry,
  type CompiledComponent,
  type ComponentStyleIsolation,
} from "./components.js";
import { compileWxss, type CompiledWxss } from "./wxss.js";
import type { CompileResult, Diagnostic } from "./diagnostics.js";
import {
  createPackage,
  isAllowedPackageFile,
  type CreatePackageOptions,
  type CreatedPackage,
  type PackageFileInput,
  type PackageResult,
} from "./package.js";

export const VIEW_BUNDLE_PATH = "build/view.json";
export const VIEW_BUNDLE_FORMAT = "qchat-view-bundle";
export const VIEW_BUNDLE_VERSION = 1;

/** `CompiledWxml` with its `templates` map turned into a plain object. */
export interface SerializedWxml {
  file: string;
  nodes: TemplateNode[];
  templates: Record<string, TemplateNode[]>;
  /** Local component tag to component path. */
  componentTags: Record<string, string>;
  files: string[];
}

export interface SerializedComponent {
  path: string;
  wxml: SerializedWxml;
  /** The component's own WXSS, scoped to its wrapper element. */
  css: string;
  styleIsolation: ComponentStyleIsolation;
}

export interface ViewBundlePage {
  /** Compiled WXML for this route. */
  wxml: SerializedWxml;
  /** App WXSS followed by page WXSS, already compiled. */
  css: string;
  /** The page's `json` config, or `{}` when the page has none. */
  config: Record<string, unknown>;
}

export interface ViewBundle {
  format: typeof VIEW_BUNDLE_FORMAT;
  formatVersion: typeof VIEW_BUNDLE_VERSION;
  /** App WXSS on its own, for hosts that apply it to a shared root. */
  appCss: string;
  pages: Record<string, ViewBundlePage>;
  /** Compiled custom component templates, keyed by package path. */
  components: Record<string, SerializedComponent>;
}

export interface BuiltViewBundle {
  bundle: ViewBundle;
  /** Every source file the build read, including `@import` targets. */
  sources: string[];
  diagnostics: Diagnostic[];
}

export interface AppPackageOptions extends CreatePackageOptions {
  /** Custom components the compiler knows about (M7); unknown tags fail. */
  components?: readonly string[];
  /** Extra files (images, fonts, media) to ship verbatim. */
  assets?: readonly PackageFileInput[];
}

export interface AppPackageResult {
  ok: boolean;
  created?: CreatedPackage;
  bundle?: ViewBundle;
  error?: MiniAppError;
  diagnostics: Diagnostic[];
}

function at(file: string, message: string, code: Diagnostic["code"] = "COMPILER_DIAGNOSTIC"): Diagnostic {
  return { code, message, file, line: 1, column: 1 };
}

function parseJsonObject(
  text: string,
  file: string,
): { ok: true; value: Record<string, unknown> } | { ok: false; diagnostic: Diagnostic } {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, diagnostic: at(file, "The file is not valid JSON.") };
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, diagnostic: at(file, "The top level must be an object.") };
  }
  return { ok: true, value: value as Record<string, unknown> };
}

function serializeWxml(compiled: CompiledWxml): SerializedWxml {
  return {
    file: compiled.file,
    nodes: compiled.nodes,
    templates: Object.fromEntries(compiled.templates),
    componentTags: { ...compiled.componentTags },
    files: [...compiled.files],
  };
}

function serializeComponent(component: CompiledComponent): SerializedComponent {
  return {
    path: component.path,
    wxml: serializeWxml(component.wxml),
    css: component.css.css,
    styleIsolation: component.styleIsolation,
  };
}

/** Turn a bundle page back into the compiler's `CompiledWxml` shape. */
export function reviveWxml(
  serialized: SerializedWxml,
  componentTemplates: Readonly<Record<string, CompiledComponent>> = {},
): CompiledWxml {
  return {
    file: serialized.file,
    nodes: serialized.nodes,
    templates: new Map(Object.entries(serialized.templates)),
    componentTags: { ...(serialized.componentTags ?? {}) },
    componentTemplates,
    files: serialized.files,
  };
}

/**
 * Compile every page in `app.json` and return one JSON bundle. A missing
 * `app.js`, page `.js` or page `.wxml` is a build error, because the manifest
 * requires them; a missing `app.wxss`, page `.wxss` or page `.json` is allowed,
 * exactly as in WeChat.
 */
export function buildViewBundle(
  read: (path: string) => string | null,
  options: { components?: readonly string[] } = {},
): CompileResult<BuiltViewBundle> {
  const diagnostics: Diagnostic[] = [];
  const sources = new Set<string>();

  const appText = read("app.json");
  if (appText === null) {
    return { ok: false, diagnostics: [at("app.json", "app.json is missing.")] };
  }
  sources.add("app.json");
  const parsedApp = parseJsonObject(appText, "app.json");
  if (!parsedApp.ok) return { ok: false, diagnostics: [parsedApp.diagnostic] };
  const app = parsedApp.value;

  const pages = app.pages;
  if (!Array.isArray(pages) || pages.length === 0) {
    return { ok: false, diagnostics: [at("app.json", "pages must be a non-empty array.")] };
  }
  for (const route of pages) {
    if (typeof route !== "string" || !isSafeRoute(route) || route.includes("..")) {
      return { ok: false, diagnostics: [at("app.json", `Unsafe page route ${JSON.stringify(route)}.`)] };
    }
  }

  if (read("app.js") === null) {
    return { ok: false, diagnostics: [at("app.js", "app.js is missing.")] };
  }
  sources.add("app.js");

  const appWxssSource = read("app.wxss");
  let appWxss: CompiledWxss = { file: "app.wxss", css: "", files: [] };
  if (appWxssSource !== null) {
    sources.add("app.wxss");
    const compiled = compileWxss(appWxssSource, "app.wxss", { loadFile: read });
    diagnostics.push(...compiled.diagnostics);
    if (!compiled.ok) return { ok: false, diagnostics };
    appWxss = compiled.value;
    for (const file of appWxss.files) sources.add(file);
  }

  const bundlePages: Record<string, ViewBundlePage> = {};
  const bundleComponents: Record<string, SerializedComponent> = {};
  for (const route of pages as string[]) {
    const configText = read(`${route}.json`);
    let config: Record<string, unknown> = {};
    if (configText !== null) {
      sources.add(`${route}.json`);
      const parsed = parseJsonObject(configText, `${route}.json`);
      if (!parsed.ok) return { ok: false, diagnostics: [parsed.diagnostic] };
      config = parsed.value;
    }

    const wxmlSource = read(`${route}.wxml`);
    if (wxmlSource === null) {
      return { ok: false, diagnostics: [at(`${route}.wxml`, "A declared page is missing its WXML.")] };
    }
    sources.add(`${route}.wxml`);

    const registry = loadComponentRegistry({
      read,
      pageFile: `${route}.wxml`,
      ...(app.usingComponents !== undefined ? { appUsingComponents: app.usingComponents as Record<string, unknown> } : {}),
      ...(config.usingComponents !== undefined ? { pageUsingComponents: config.usingComponents as Record<string, unknown> } : {}),
    });
    diagnostics.push(...registry.diagnostics);
    if (!registry.ok) return { ok: false, diagnostics };
    for (const file of registry.value.files) sources.add(file);
    let componentCss = "";
    for (const [path, component] of Object.entries(registry.value.templates)) {
      bundleComponents[path] = serializeComponent(component);
      componentCss += component.css.css;
    }

    const wxml = compileWxml(wxmlSource, `${route}.wxml`, {
      loadFile: read,
      componentTags: registry.value.tags,
      componentTemplates: registry.value.templates,
      ...(options.components ? { components: options.components } : {}),
    });
    diagnostics.push(...wxml.diagnostics);
    if (!wxml.ok) return { ok: false, diagnostics };
    for (const file of wxml.value.files) sources.add(file);

    const pageWxssSource = read(`${route}.wxss`);
    let pageWxss: CompiledWxss = { file: `${route}.wxss`, css: "", files: [] };
    if (pageWxssSource !== null) {
      sources.add(`${route}.wxss`);
      const compiled = compileWxss(pageWxssSource, `${route}.wxss`, { loadFile: read });
      diagnostics.push(...compiled.diagnostics);
      if (!compiled.ok) return { ok: false, diagnostics };
      pageWxss = compiled.value;
      for (const file of pageWxss.files) sources.add(file);
    }

    if (read(`${route}.js`) === null) {
      return { ok: false, diagnostics: [at(`${route}.js`, "A declared page is missing its JavaScript.")] };
    }
    sources.add(`${route}.js`);

    bundlePages[route] = {
      wxml: serializeWxml(wxml.value),
      css: `${appWxss.css}${pageWxss.css}${componentCss}`,
      config,
    };
  }

  const bundle: ViewBundle = {
    format: VIEW_BUNDLE_FORMAT,
    formatVersion: VIEW_BUNDLE_VERSION,
    appCss: appWxss.css,
    pages: bundlePages,
    components: bundleComponents,
  };
  return {
    ok: true,
    value: { bundle, sources: [...sources].sort(), diagnostics },
    diagnostics,
  };
}

/** The package file entry for a built bundle. */
export function viewBundleFile(bundle: ViewBundle): PackageFileInput {
  return {
    path: VIEW_BUNDLE_PATH,
    bytes: Buffer.from(JSON.stringify(bundle), "utf8"),
  };
}

/**
 * Compile a source tree and sign it as one `.qxpkg`. `read` returns a file's
 * text or `null`; every path it is asked for is package-relative and safe.
 * Binary assets are supplied through `assets`, because a text reader cannot see
 * them.
 */
export function createAppPackage(
  read: (path: string) => string | null,
  options: AppPackageOptions,
): AppPackageResult {
  const built = buildViewBundle(read, {
    ...(options.components ? { components: options.components } : {}),
  });
  if (!built.ok) return failedBuild(built.diagnostics);
  return assemble(built.value, options, (path) => {
    const text = read(path);
    return text === null ? null : Buffer.from(text, "utf8");
  });
}

function failedBuild(diagnostics: Diagnostic[]): AppPackageResult {
  return {
    ok: false,
    error: miniAppError("COMPILER_DIAGNOSTIC", diagnostics[0]?.message ?? "The build failed."),
    diagnostics,
  };
}

function assemble(
  built: BuiltViewBundle,
  options: AppPackageOptions,
  readBytes: (path: string) => Buffer | null,
): AppPackageResult {
  const files: PackageFileInput[] = [];
  for (const path of built.sources) {
    const bytes = readBytes(path);
    if (bytes === null) {
      return {
        ok: false,
        error: miniAppError("COMPILER_DIAGNOSTIC", `A build input disappeared: ${path}.`),
        diagnostics: [at(path, "The file disappeared during the build.")],
      };
    }
    files.push({ path, bytes });
  }
  files.push(viewBundleFile(built.bundle));
  for (const asset of options.assets ?? []) {
    files.push({ path: asset.path, bytes: Buffer.from(asset.bytes) });
  }

  const created: PackageResult<CreatedPackage> = createPackage(files, options);
  if (!created.ok) return { ok: false, error: created.error, diagnostics: built.diagnostics };
  return {
    ok: true,
    created: created.value,
    bundle: built.bundle,
    diagnostics: built.diagnostics,
  };
}

/** Directories that are never part of a Mini App package. */
const SKIP_DIRECTORIES = new Set(["node_modules", ".git", ".dart_tool", "build", "dist"]);

function readDirectory(root: string): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  const walk = (prefix: string): void => {
    const directory = prefix === "" ? root : join(root, prefix);
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) {
        if (SKIP_DIRECTORIES.has(entry.name) || entry.name.startsWith(".")) continue;
        walk(path);
        continue;
      }
      if (!entry.isFile()) continue;
      if (path === "manifest.json" || path === "signature.ed25519") continue;
      if (!isAllowedPackageFile(path)) continue;
      files.set(path, readFileSync(join(root, path)));
    }
  };
  walk("");
  return files;
}

/**
 * `createAppPackage` for a directory. Every allowed file is shipped: the build
 * inputs plus images, fonts and media. Paths are confined to `root`; a path that
 * escapes it is treated as absent, never read. `build/` is regenerated here, so
 * a stale bundle on disk is not shipped.
 */
export function createAppPackageFromDirectory(root: string, options: AppPackageOptions): AppPackageResult {
  const files = readDirectory(root);
  const read = (path: string): string | null => files.get(path)?.toString("utf8") ?? null;
  const built = buildViewBundle(read, {
    ...(options.components ? { components: options.components } : {}),
  });
  if (!built.ok) return failedBuild(built.diagnostics);

  const sources = new Set(built.value.sources);
  const assets: PackageFileInput[] = [];
  for (const [path, bytes] of files) {
    if (sources.has(path) || path === VIEW_BUNDLE_PATH) continue;
    assets.push({ path, bytes });
  }
  return assemble(built.value, { ...options, assets: [...(options.assets ?? []), ...assets] }, (path) => {
    const bytes = files.get(path);
    return bytes ?? null;
  });
}
