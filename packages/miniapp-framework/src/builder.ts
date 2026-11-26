/// Phase 1 builder: a thin orchestrator over the official WeChat build pipeline.
///
/// QChat does not compile WXML or WXSS. This module:
///
/// 1. loads and validates the project with [loadMiniProgram];
/// 2. validates templates with the official `glass-easel-template-compiler`;
/// 3. copies the project into a staging directory with BOM-free JSON and
///    container-relative asset URLs;
/// 4. runs webpack with `GlassEaselMiniprogramWxmlLoader`,
///    `GlassEaselMiniprogramWxssLoader` and
///    `GlassEaselMiniprogramWebpackPlugin`;
/// 5. packages `app-service.js`, `app-wxss.css`, `app-config.json` and the
///    project assets into the verified `.japp` container the host serves.

import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Configuration, WebpackPluginInstance } from "webpack";
import { TmplGroup } from "glass-easel-template-compiler";
import { BUILTIN_DIR, HOST_ENTRY, withBuiltins } from "./builtin.js";
import { buildCapabilities, type CapabilityManifest } from "./capabilities.js";
import {
  loadMiniProgram,
  MiniProgramError,
  stripBom,
  type AppJson,
  type ManifestOverrides,
  type MiniProgramComponent,
  type MiniProgramPage,
  type MiniProgramProgram,
  type PageJson,
  type TabBarConfig,
  type WindowConfig,
} from "./wechat.js";
import { readZip, writeZip, type ZipEntryInput } from "./zip.js";

export const PACKAGE_FORMAT = "webapp";
export const PACKAGE_SCHEMA_VERSION = 3;
export const PACKAGE_ENTRY = "index.html";
export const RUNTIME_VERSION = "2.0.0";
export const BUILDER_VERSION = "4.0.0";
export const METADATA_FORMAT_VERSION = 2;

const APP_SERVICE = "app-service.js";
const APP_WXSS = "app-wxss.css";
const APP_CONFIG = "app-config.json";

const semverPattern = /^\d{1,4}\.\d{1,4}\.\d{1,4}(?:-[0-9A-Za-z.-]{1,20})?$/;

const allowedPermissions = new Set([
  "toast",
  "user.profile",
  "media.choose",
  "share",
  "storage",
  "qchat.api",
  "network",
  "clipboard",
]);

export type BuildDiagnostic = {
  severity: "error" | "warning";
  code: string;
  message: string;
  file?: string;
  line?: number;
  column?: number;
};

export class BuildError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly diagnostics: BuildDiagnostic[] = [],
  ) {
    super(message);
    this.name = "BuildError";
  }
}

export type MiniProgramManifest = {
  schemaVersion: 3;
  format: "webapp";
  name: string;
  description: string;
  version: string;
  entry: "index.html";
  minRuntimeVersion: string;
  requestedPermissions: string[];
  themeColor?: string;
};

export type MiniProgramMetadata = {
  formatVersion: 2;
  builderVersion: string;
  version: string;
  entry: "index.html";
  builtAt: string;
  entrySha256: string;
  files: Array<{ path: string; sha256: string; size: number }>;
};

export type AppConfig = {
  format: "qchat-miniprogram";
  formatVersion: 1;
  appId: string | null;
  entry: string;
  pages: Array<{
    route: string;
    config: PageJson;
    usingComponents: Record<string, string>;
  }>;
  components: Array<{
    id: string;
    config: PageJson;
    usingComponents: Record<string, string>;
  }>;
  window: WindowConfig;
  tabBar: TabBarConfig | null;
  subPackages: AppJson["subpackages"] | null;
  networkTimeout: AppJson["networkTimeout"] | null;
  permission: AppJson["permission"] | null;
  requiredPrivateInfos: string[];
  style: string | null;
  sitemapLocation: string | null;
  lazyCodeLoading: string | null;
  usingComponents: Record<string, string>;
  sdkVersion: string;
  generatedAt: string;
  /// Permissions the package declared (manifest.json + detected `wx.*` calls).
  permissions: string[];
  /// What the host implements, embedded so `wx.canIUse` never guesses.
  capabilities: CapabilityManifest;
  /// True for development builds; the runtime forwards console/network events
  /// to an embedding Studio through `window.parent.postMessage`.
  devtools: boolean;
};

export type BuildOptions = {
  projectDir: string;
  /** Output file. Defaults to `<projectDir>/dist/<name>-<version>.japp`. */
  outFile?: string;
  /** Unpacked output directory. Defaults to a temporary directory. */
  outDir?: string;
  overrides?: ManifestOverrides;
  /** Fixed build timestamp, used by tests for reproducible archives. */
  date?: Date;
  compress?: boolean;
  mode?: "development" | "production" | "none";
  minify?: boolean;
  sourceMap?: boolean;
  /** Prefix for custom component host elements. Defaults to `wx-`. */
  tagNamePrefix?: string;
  /// Forward console/network events to an embedding Studio. Defaults to true
  /// outside production builds.
  devtools?: boolean;
};

export type BuiltMiniProgram = {
  outFile: string;
  outDir: string;
  bytes: Buffer;
  manifest: MiniProgramManifest;
  metadata: MiniProgramMetadata;
  files: string[];
  appConfig: AppConfig;
  appConfigJson: string;
  appService: Buffer;
  appWxss: Buffer;
  indexHtml: string;
  diagnostics: BuildDiagnostic[];
  warnings: string[];
  project: MiniProgramProgram;
  durationMs: number;
};

const packageRoot = path.resolve(fileURLToPath(import.meta.url), "../..");
const builtinRoot = path.join(packageRoot, "builtin");
const runtimeRoot = path.join(packageRoot, "runtime");
const requireFromPackage = createRequire(import.meta.url);

function packageModules(): string[] {
  return [
    path.join(packageRoot, "node_modules"),
    path.resolve(packageRoot, "../..", "node_modules"),
    "node_modules",
  ];
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function toDiagnostic(error: MiniProgramError): BuildDiagnostic {
  return {
    severity: "error",
    code: error.code,
    message: error.message.replace(/^[^:]+:\s*/, ""),
    file: error.location.file,
    line: error.location.line,
    column: error.location.column,
  };
}

function wrapError(error: unknown): BuildError {
  if (error instanceof BuildError) return error;
  if (error instanceof MiniProgramError) {
    const diagnostic = toDiagnostic(error);
    return new BuildError(error.code, error.message, [diagnostic]);
  }
  if (error instanceof Error) return new BuildError("BUILD_FAILED", error.message);
  return new BuildError("BUILD_FAILED", String(error));
}

function stripAnsi(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

function firstLine(message: string): string {
  const line = message.split("\n").find((part) => part.trim() !== "");
  return (line ?? message).trim();
}

type TemplateWarning = {
  isError?: boolean;
  code?: number;
  message?: string;
  path?: string;
  startLine?: number;
  startColumn?: number;
  endLine?: number;
  endColumn?: number;
};

/// Runs the official template compiler over every WXML file. The official
/// webpack loader prints errors to the console; doing a validation pass lets the
/// builder fail with structured file/line diagnostics before webpack starts.
function validateTemplates(project: MiniProgramProgram): {
  diagnostics: BuildDiagnostic[];
  warnings: BuildDiagnostic[];
} {
  const errors: BuildDiagnostic[] = [];
  const warnings: BuildDiagnostic[] = [];
  const group = new TmplGroup();
  try {
    for (const script of project.scripts) group.addScript(script.id, script.source);
    for (const template of project.templates) {
      const result = group.addTmpl(template.id, template.source) as TemplateWarning[] | null;
      for (const warning of result ?? []) {
        const diagnostic: BuildDiagnostic = {
          severity: warning.isError ? "error" : "warning",
          code: warning.isError ? "WXML_SYNTAX" : "WXML_WARNING",
          message: warning.message ?? `template warning #${warning.code ?? 0}`,
          file:
            warning.path && warning.path !== template.id ? warning.path : template.file,
          line: warning.startLine == null ? undefined : warning.startLine + 1,
          column: warning.startColumn == null ? undefined : warning.startColumn + 1,
        };
        if (warning.isError) errors.push(diagnostic);
        else warnings.push(diagnostic);
      }
    }
  } finally {
    group.free();
  }
  return { diagnostics: errors, warnings };
}

type Staging = {
  root: string;
  src: string;
  dist: string;
};

/// Copies a directory tree, keeping only the extensions a Mini Program
/// understands. The built-in sources and the host runtime live in the package,
/// not in the user's project, so they are staged next to it.
async function copyStagedTree(
  source: string,
  target: string,
  extensions: ReadonlySet<string>,
): Promise<void> {
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) {
      await copyStagedTree(from, to, extensions);
      continue;
    }
    if (!entry.isFile()) continue;
    const extension = path.extname(entry.name);
    if (!extensions.has(extension)) continue;
    await mkdir(path.dirname(to), { recursive: true });
    // The official plugin parses JSON with `JSON.parse`, which rejects a UTF-8
    // BOM, and a rejected config makes it treat the file as a plain asset
    // instead of a page or component. Strip it on the way in.
    if (extension === ".json") {
      const text = stripBom(await readFile(from, "utf8"));
      await writeFile(to, text, "utf8");
      continue;
    }
    await copyFile(from, to);
  }
}

const stagedExtensions = new Set([".js", ".json", ".wxml", ".wxss", ".wxs"]);

async function createStaging(project: MiniProgramProgram): Promise<Staging> {
  const root = await mkdtemp(path.join(tmpdir(), "qchat-build-"));
  const src = path.join(root, "src");
  const dist = path.join(root, "dist");
  await mkdir(src, { recursive: true });

  for (const relative of project.files) {
    const source = path.join(project.root, ...relative.split("/"));
    const target = path.join(src, ...relative.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    if (relative.endsWith(".json")) {
      const text = stripBom(await readFile(source, "utf8"));
      await writeFile(target, text, "utf8");
      continue;
    }
    const rewritten = project.rewritten.get(relative);
    if (rewritten != null) await writeFile(target, rewritten, "utf8");
    else await copyFile(source, target);
  }

  // The official plugin discovers pages and components by scanning `.json`
  // files, and only treats a file as a component when `component === true` or
  // `usingComponents` is an object. Normalize the staged configs so every page
  // is bundled, every declared component is compiled as one, and optional page
  // JSON can be omitted by the author.
  //
  // Built-ins are injected per file, never globally: the plugin merges
  // `app.json` `usingComponents` into every component, and a built-in whose
  // template contains the tag it implements would then resolve to itself.
  const globalUsing = project.app.usingComponents ?? {};
  for (const page of project.pages) {
    const config = {
      ...page.config,
      usingComponents: withBuiltins({ ...globalUsing, ...page.config.usingComponents }),
    };
    const target = path.join(src, ...`${page.route}.json`.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  }
  for (const component of project.components) {
    const config = {
      ...component.config,
      component: true,
      usingComponents: withBuiltins({ ...globalUsing, ...component.config.usingComponents }),
    };
    const target = path.join(src, ...`${component.id}.json`.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  }

  // Stage the built-in components and the host runtime. `app.json` is rewritten
  // without `usingComponents` so the plugin does not merge the author's global
  // map into the built-in components.
  const appJsonPath = path.join(src, "app.json");
  const stagedApp = { ...project.app } as Record<string, unknown>;
  delete stagedApp.usingComponents;
  await writeFile(appJsonPath, `${JSON.stringify(stagedApp, null, 2)}\n`, "utf8");

  await copyStagedTree(builtinRoot, path.join(src, ...BUILTIN_DIR.split("/")), stagedExtensions);
  await mkdir(path.dirname(path.join(src, ...HOST_ENTRY.split("/"))), { recursive: true });
  await copyFile(path.join(runtimeRoot, "host.js"), path.join(src, ...HOST_ENTRY.split("/")));

  // The official plugin always requires `./app.wxss` from its generated entry.
  // QChat's base rules are prepended so built-in hosts have the layout WeChat
  // gives them before the author's stylesheet runs.
  const appStyle = path.join(src, "app.wxss");
  const baseStyle = await readFile(path.join(builtinRoot, "base.wxss"), "utf8");
  const authorStyle = existsSync(appStyle) ? await readFile(appStyle, "utf8") : "";
  await writeFile(appStyle, `${baseStyle}\n${authorStyle}`, "utf8");

  return { root, src, dist };
}

type WebpackResult = {
  errors: BuildDiagnostic[];
  warnings: BuildDiagnostic[];
};

async function runWebpack(
  staging: Staging,
  project: MiniProgramProgram,
  options: BuildOptions,
  captured: BuildDiagnostic[],
): Promise<WebpackResult> {
  const webpack = requireFromPackage("webpack") as typeof import("webpack");
  const MiniCssExtractPlugin = requireFromPackage("mini-css-extract-plugin") as typeof import("mini-css-extract-plugin");
  const plugin = requireFromPackage("glass-easel-miniprogram-webpack-plugin") as typeof import("glass-easel-miniprogram-webpack-plugin");

  const mode = options.mode ?? "production";
  const minimize = options.minify ?? mode === "production";
  const modules = packageModules();

  const config: Configuration = {
    mode,
    context: staging.root,
    entry: `./src/${HOST_ENTRY}`,
    output: {
      path: staging.dist,
      filename: APP_SERVICE,
      chunkFilename: "[name].js",
      module: false,
      iife: true,
      clean: true,
      publicPath: "",
    },
    resolve: {
      extensions: [".js", ".json"],
      modules,
    },
    resolveLoader: { modules },
    module: {
      rules: [
        // Required: without `javascript/auto`, a WeChat project nested in a
        // `"type": "module"` repository is parsed as ESM and the plugin's
        // generated CommonJS bootstrap is emitted unbundled.
        { test: /\.js$/, type: "javascript/auto" },
        {
          test: /\.wxml$/,
          exclude: /node_modules/,
          use: [{ loader: plugin.GlassEaselMiniprogramWxmlLoader }],
        },
        {
          test: /\.wxss$/,
          exclude: /node_modules/,
          use: [
            MiniCssExtractPlugin.loader,
            { loader: "css-loader", options: { url: false, import: false } },
            { loader: plugin.GlassEaselMiniprogramWxssLoader },
          ],
        },
        {
          test: /\.wxs$/,
          exclude: /node_modules/,
          use: [{ loader: plugin.GlassEaselMiniprogramWxsLoader }],
        },
      ],
    },
    plugins: [
      new MiniCssExtractPlugin({ filename: APP_WXSS }),
      new plugin.GlassEaselMiniprogramWebpackPlugin({
        path: staging.src,
        // Assets are copied by QChat under `assets/`; the plugin must not copy
        // them a second time at their source path.
        resourceFilePattern: /^$/,
        defaultEntry: project.pages[0]?.route ?? "pages/index/index",
        tagNamePrefix: options.tagNamePrefix ?? "wx-",
        // QChat's host runtime owns the backend, the root tag (`page`) and
        // routing, so the official plugin must not attach a
        // `glass-easel-root` on its own.
        customBootstrap: true,
      }),
    ],
    optimization: {
      minimize,
      splitChunks: false,
      runtimeChunk: false,
    },
    performance: { hints: false },
    cache: false,
    devtool: options.sourceMap ? "source-map" : false,
    stats: "none",
    infrastructureLogging: { level: "error" },
  };

  const errors: BuildDiagnostic[] = [];
  const warnings: BuildDiagnostic[] = [];

  await new Promise<void>((resolve, reject) => {
    webpack(config, (error, stats) => {
      if (error) {
        reject(new BuildError("WEBPACK_FAILED", error.message));
        return;
      }
      if (!stats) {
        reject(new BuildError("WEBPACK_FAILED", "webpack produced no stats"));
        return;
      }
      const info = stats.toJson({
        all: false,
        errors: true,
        warnings: true,
        errorDetails: true,
        moduleTrace: false,
      }) as {
        errors?: Array<{ message?: string; moduleName?: string; loc?: string }>;
        warnings?: Array<{ message?: string; moduleName?: string; loc?: string }>;
      };

      for (const entry of info.errors ?? []) {
        const message = String(entry.message ?? "");
        const location = parseWebpackLocation(entry.moduleName, entry.loc);
        errors.push({
          severity: "error",
          code: "WEBPACK_ERROR",
          message,
          file: location.file,
          line: location.line,
          column: location.column,
        });
      }
      for (const entry of info.warnings ?? []) {
        const message = String(entry.message ?? "");
        const location = parseWebpackLocation(entry.moduleName, entry.loc);
        warnings.push({
          severity: "warning",
          code: "WEBPACK_WARNING",
          message,
          file: location.file,
          line: location.line,
          column: location.column,
        });
      }
      if (stats.hasErrors()) {
        reject(new BuildError("BUILD_FAILED", "webpack compilation failed", errors));
        return;
      }
      resolve();
    });
  });

  // The official loaders report template/stylesheet errors on the console
  // instead of failing the compilation. Capture those lines as diagnostics.
  errors.push(...captured.filter((diagnostic) => diagnostic.severity === "error"));
  warnings.push(...captured.filter((diagnostic) => diagnostic.severity === "warning"));
  if (errors.length > 0) {
    throw new BuildError("BUILD_FAILED", "the WXML/WXSS compilers reported errors", errors);
  }
  return { errors, warnings };
}

function parseWebpackLocation(moduleName: string | undefined, loc: string | undefined): {
  file?: string;
  line?: number;
  column?: number;
} {
  if (!moduleName) return {};
  let file = moduleName;
  const marker = file.lastIndexOf("!");
  if (marker >= 0) file = file.slice(marker + 1);
  file = file.replace(/^\.?[\\/]src[\\/]/, "").replaceAll("\\", "/");
  if (file.startsWith("./")) file = file.slice(2);
  if (!loc) return { file };
  const match = /^(\d+):(\d+)/.exec(loc);
  if (!match) return { file };
  return { file, line: Number(match[1]), column: Number(match[2]) };
}

function captureCompilerMessages(): {
  diagnostics: BuildDiagnostic[];
  restore: () => void;
} {
  const diagnostics: BuildDiagnostic[] = [];
  const originalError = console.error;
  const originalWarn = console.warn;
  const parse = (severity: "error" | "warning", args: unknown[]) => {
    const text = stripAnsi(args.map((value) => (value instanceof Error ? value.message : String(value))).join(" "));
    const pattern = /\[glass-easel-(template|stylesheet)-compiler\]\s+(ERROR|WARN)\s+([^:]+):(\d+):(\d+)\s+\(#(\d+)\):\s*(.*)$/;
    const match = pattern.exec(text);
    if (!match) return;
    diagnostics.push({
      severity: match[2] === "ERROR" ? "error" : "warning",
      code: `${match[1] === "template" ? "WXML" : "WXSS"}_${match[2]}`,
      message: match[7].trim(),
      file: match[3].replaceAll("\\", "/"),
      line: Number(match[4]) + 1,
      column: Number(match[5]) + 1,
    });
    void severity;
  };
  console.error = (...args: unknown[]) => {
    parse("error", args);
    originalError(...args);
  };
  console.warn = (...args: unknown[]) => {
    parse("warning", args);
    originalWarn(...args);
  };
  return {
    diagnostics,
    restore: () => {
      console.error = originalError;
      console.warn = originalWarn;
    },
  };
}

function normalizeDomain(value: string): string {
  let raw = value.trim().toLowerCase();
  if (/^https?:\/\//.test(raw)) {
    try {
      raw = new URL(raw).host;
    } catch {
      throw new BuildError("INVALID_DOMAIN", `invalid request domain: ${value}`);
    }
  }
  raw = raw.replace(/\/.*$/, "");
  if (!/^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}(?::\d{1,5})?$/i.test(raw)) {
    throw new BuildError("INVALID_DOMAIN", `invalid request domain: ${value}`);
  }
  return raw;
}

function normalizeName(value: string | undefined, fallback: string): string {
  const name = (value ?? "").trim() || fallback;
  if (name.length > 60) throw new BuildError("INVALID_NAME", "name must be 60 characters or less");
  return name;
}

function buildManifest(
  project: MiniProgramProgram,
  options: BuildOptions,
): MiniProgramManifest {
  const overrides = project.manifest;
  const version = String(overrides.version ?? project.projectConfig.version ?? "1.0.0").trim();
  if (!semverPattern.test(version)) {
    throw new BuildError("INVALID_VERSION", `invalid version: ${version}`);
  }
  const minRuntimeVersion = String(overrides.minRuntimeVersion ?? RUNTIME_VERSION);
  if (!semverPattern.test(minRuntimeVersion)) {
    throw new BuildError("INVALID_VERSION", "minRuntimeVersion must be a semver string");
  }
  const fallbackName = project.projectConfig.projectname ?? path.basename(project.root);
  const declared = [...new Set([...(overrides.requestedPermissions ?? []), ...project.permissions])].sort();
  for (const permission of declared) {
    if (!allowedPermissions.has(permission)) {
      throw new BuildError("UNKNOWN_PERMISSION", `unknown permission: ${permission}`);
    }
  }
  const manifest: MiniProgramManifest = {
    schemaVersion: PACKAGE_SCHEMA_VERSION,
    format: PACKAGE_FORMAT,
    name: normalizeName(overrides.name, fallbackName),
    description: String(overrides.description ?? project.projectConfig.description ?? "").slice(0, 500),
    version,
    entry: PACKAGE_ENTRY,
    minRuntimeVersion,
    requestedPermissions: declared,
  };
  const themeColor = overrides.themeColor ?? project.app.window?.navigationBarBackgroundColor;
  if (themeColor && /^#[0-9a-fA-F]{6}$/.test(themeColor)) manifest.themeColor = themeColor;
  void options;
  return manifest;
}

export function buildAppConfig(
  project: MiniProgramProgram,
  manifest: MiniProgramManifest,
  date: Date,
  devtools = true,
): AppConfig {
  const permissions = [...manifest.requestedPermissions];
  return {
    format: "qchat-miniprogram",
    formatVersion: 1,
    appId: typeof project.projectConfig.appid === "string" ? project.projectConfig.appid : null,
    entry: project.pages[0]?.route ?? "",
    pages: project.pages.map((page) => ({
      route: page.route,
      config: page.config,
      usingComponents: page.usingComponents,
    })),
    components: project.components.map((component) => ({
      id: component.id,
      config: component.config,
      usingComponents: component.usingComponents,
    })),
    window: project.app.window ?? {},
    tabBar: project.app.tabBar ?? null,
    subPackages: project.app.subpackages ?? project.app.subPackages ?? null,
    networkTimeout: project.app.networkTimeout ?? null,
    permission: project.app.permission ?? null,
    requiredPrivateInfos: project.app.requiredPrivateInfos ?? [],
    style: project.app.style ?? null,
    sitemapLocation: project.app.sitemapLocation ?? null,
    lazyCodeLoading: project.app.lazyCodeLoading ?? null,
    usingComponents: project.app.usingComponents ?? {},
    sdkVersion: manifest.minRuntimeVersion,
    generatedAt: date.toISOString(),
    permissions,
    capabilities: buildCapabilities(permissions),
    devtools,
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderIndexHtml(manifest: MiniProgramManifest, appConfigJson: string): string {
  const inlineConfig = appConfigJson.replaceAll("</script", "<\\/script");
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="format-detection" content="telephone=no,email=no,address=no">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(manifest.name)}</title>
<link rel="stylesheet" href="/assets/${APP_WXSS}">
</head>
<body>
<script>window.__QCHAT_APP_CONFIG__ = ${inlineConfig};</script>
<script src="/assets/${APP_SERVICE}"></script>
</body>
</html>
`;
}

function slug(value: string): string {
  const clean = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return clean || "miniapp";
}

async function collectOutput(
  staging: Staging,
  project: MiniProgramProgram,
  manifest: MiniProgramManifest,
  appConfig: AppConfig,
  appConfigJson: string,
  date: Date,
): Promise<{
  entries: Map<string, Buffer>;
  appService: Buffer;
  appWxss: Buffer;
  indexHtml: string;
}> {
  const entries = new Map<string, Buffer>();
  let appService: Buffer;
  let appWxss: Buffer;
  try {
    appService = await readFile(path.join(staging.dist, APP_SERVICE));
  } catch {
    throw new BuildError("SERVICE_MISSING", `webpack did not emit ${APP_SERVICE}`);
  }
  try {
    appWxss = await readFile(path.join(staging.dist, APP_WXSS));
  } catch {
    throw new BuildError("STYLES_MISSING", `webpack did not emit ${APP_WXSS}`);
  }

  const indexHtml = renderIndexHtml(manifest, appConfigJson);
  const indexBytes = Buffer.from(indexHtml, "utf8");
  entries.set(PACKAGE_ENTRY, indexBytes);
  entries.set(`assets/${APP_SERVICE}`, appService);
  entries.set(`assets/${APP_WXSS}`, appWxss);
  entries.set(`assets/${APP_CONFIG}`, Buffer.from(appConfigJson, "utf8"));

  for (const asset of project.assets) {
    if (entries.has(asset.output)) continue;
    entries.set(asset.output, await readFile(asset.source));
  }
  void date;
  void appConfig;
  return { entries, appService, appWxss, indexHtml };
}

/// Builds a WeChat-shaped project into the verified `.japp` container.
export async function buildMiniProgram(options: BuildOptions): Promise<BuiltMiniProgram> {
  const started = Date.now();
  let project: MiniProgramProgram;
  try {
    project = await loadMiniProgram({ projectDir: options.projectDir, overrides: options.overrides });
  } catch (error) {
    throw wrapError(error);
  }

  const templateResult = validateTemplates(project);
  if (templateResult.diagnostics.length > 0) {
    throw new BuildError("WXML_SYNTAX", "the official template compiler reported errors", templateResult.diagnostics);
  }

  const date = options.date ?? new Date();
  const manifest = buildManifest(project, options);
  const appConfig = buildAppConfig(
    project,
    manifest,
    date,
    options.devtools ?? options.mode !== "production",
  );
  const appConfigJson = `${JSON.stringify(appConfig, null, 2)}\n`;

  const staging = await createStaging(project);
  const capture = captureCompilerMessages();
  let webpackResult: WebpackResult;
  try {
    webpackResult = await runWebpack(staging, project, options, capture.diagnostics);
  } finally {
    capture.restore();
  }

  let collected;
  try {
    collected = await collectOutput(staging, project, manifest, appConfig, appConfigJson, date);
  } finally {
    await rm(staging.root, { recursive: true, force: true });
  }

  const entries = collected.entries;
  const metadataFiles = [...entries.entries()]
    .map(([file, bytes]) => ({ path: file, sha256: sha256(bytes), size: bytes.length }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const metadata: MiniProgramMetadata = {
    formatVersion: METADATA_FORMAT_VERSION,
    builderVersion: BUILDER_VERSION,
    version: manifest.version,
    entry: PACKAGE_ENTRY,
    builtAt: date.toISOString(),
    entrySha256: sha256(entries.get(PACKAGE_ENTRY) as Buffer),
    files: metadataFiles,
  };
  const permissions = Buffer.from(
    `${JSON.stringify({ requestedPermissions: manifest.requestedPermissions }, null, 2)}\n`,
    "utf8",
  );
  const metadataBuffer = Buffer.from(`${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  const manifestBuffer = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const archiveEntries: ZipEntryInput[] = [
    { name: "manifest.json", data: manifestBuffer },
    { name: "metadata.json", data: metadataBuffer },
    { name: "permissions.json", data: permissions },
    ...[...entries.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([name, data]) => ({ name, data })),
  ];
  const bytes = writeZip(archiveEntries, {
    date,
    compress: options.compress !== false,
  });

  const outFile =
    options.outFile ??
    path.join(project.root, "dist", `${slug(manifest.name)}-${manifest.version}.japp`);
  const outDir = options.outDir ?? path.join(path.dirname(outFile), `${slug(manifest.name)}-${manifest.version}`);
  await mkdir(path.dirname(outFile), { recursive: true });
  await writeFile(outFile, bytes);
  await mkdir(outDir, { recursive: true });
  await Promise.all([...entries.entries()].map(async ([name, data]) => {
    const target = path.join(outDir, ...name.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
  }));
  await writeFile(path.join(outDir, "manifest.json"), manifestBuffer);
  await writeFile(path.join(outDir, "metadata.json"), metadataBuffer);
  await writeFile(path.join(outDir, "permissions.json"), permissions);

  const warnings = [
    ...project.warnings,
    ...templateResult.warnings.map((warning) =>
      `${warning.file ?? "wxml"}:${warning.line ?? 0}:${warning.column ?? 0}: ${warning.message}`,
    ),
    ...webpackResult.warnings.map((warning) => `${warning.file ?? "webpack"}: ${firstLine(warning.message)}`),
  ];

  return {
    outFile,
    outDir,
    bytes,
    manifest,
    metadata,
    files: archiveEntries.map((entry) => entry.name),
    appConfig,
    appConfigJson,
    appService: collected.appService,
    appWxss: collected.appWxss,
    indexHtml: collected.indexHtml,
    diagnostics: webpackResult.errors,
    warnings,
    project,
    durationMs: Date.now() - started,
  };
}

/// Reads a `.japp` archive back into its manifest, for `qchat inspect`.
export async function readPackageManifest(file: string): Promise<MiniProgramManifest> {
  const bytes = await readFile(file);
  const entries = readZip(bytes, {
    maxArchiveBytes: 20 * 1024 * 1024,
    maxTotalBytes: 80 * 1024 * 1024,
    maxEntryBytes: 20 * 1024 * 1024,
    maxEntries: 2000,
  });
  const manifest = entries.find((entry) => entry.name === "manifest.json");
  if (!manifest) throw new BuildError("MANIFEST_MISSING", "manifest.json is missing");
  return JSON.parse(manifest.bytes.toString("utf8")) as MiniProgramManifest;
}

export type { MiniProgramComponent, MiniProgramPage };
