/// Reads and validates a WeChat-shaped Mini Program project.
///
/// This module does not compile WXML or WXSS. It only reads the project
/// configuration, validates the structure the official build pipeline expects,
/// and collects the files, pages, components and assets that will be handed to
/// `glass-easel-miniprogram-webpack-plugin`.
///
/// Two integration rules are enforced here:
///
/// 1. JSON is read through a UTF-8 BOM-stripping reader. The official plugin
///    calls `JSON.parse` on the raw file and fails on a BOM.
/// 2. Asset URLs in WXML/WXSS are rewritten to `/assets/<path>` because the
///    QChat container only serves payload files under `assets/`.

import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

export type WindowConfig = {
  navigationBarTitleText?: string;
  navigationBarBackgroundColor?: string;
  navigationBarTextStyle?: "black" | "white";
  navigationStyle?: "default" | "custom";
  backgroundColor?: string;
  backgroundTextStyle?: "dark" | "light";
  enablePullDownRefresh?: boolean;
  onReachBottomDistance?: number;
  disableScroll?: boolean;
  navigationBarShadow?: { color?: string } | boolean;
  homeButton?: boolean;
  [key: string]: unknown;
};

export type TabBarItem = {
  pagePath: string;
  text?: string;
  iconPath?: string;
  selectedIconPath?: string;
};

export type TabBarConfig = {
  color?: string;
  selectedColor?: string;
  backgroundColor?: string;
  borderStyle?: "black" | "white";
  position?: "bottom" | "top";
  list: TabBarItem[];
  custom?: boolean;
};

export type AppJson = {
  pages: string[];
  window?: WindowConfig;
  tabBar?: TabBarConfig;
  usingComponents?: Record<string, string>;
  subpackages?: Array<{ root: string; pages: string[] }>;
  subPackages?: Array<{ root: string; pages: string[] }>;
  networkTimeout?: {
    request?: number;
    connectSocket?: number;
    uploadFile?: number;
    downloadFile?: number;
  };
  permission?: Record<string, { desc?: string }>;
  requiredPrivateInfos?: string[];
  style?: string;
  sitemapLocation?: string;
  lazyCodeLoading?: string;
  [key: string]: unknown;
};

export type PageJson = WindowConfig & {
  usingComponents?: Record<string, string>;
  component?: boolean;
  styleIsolation?: string;
};

export type ProjectConfig = {
  appid?: string;
  projectname?: string;
  version?: string;
  description?: string;
  miniprogramRoot?: string;
  compileType?: string;
  setting?: Record<string, unknown>;
  [key: string]: unknown;
};

/// Store metadata that is not part of WeChat's `app.json` but that a published
/// QChat Mini Program needs.
export type ManifestOverrides = {
  name?: string;
  description?: string;
  version?: string;
  minRuntimeVersion?: string;
  requestedPermissions?: string[];
  requestDomains?: string[];
  themeColor?: string;
};

export type SourceLocation = {
  /** Path relative to the project root, using `/`. */
  file?: string;
  line?: number;
  column?: number;
};

export class MiniProgramError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly location: SourceLocation = {},
  ) {
    super(location.file ? `${location.file}: ${message}` : message);
    this.name = "MiniProgramError";
  }
}

export type MiniProgramPage = {
  route: string;
  /** Absolute path without the extension. */
  base: string;
  /** Project-relative paths of the page files. */
  files: {
    js: string;
    wxml: string;
    json: string | null;
    wxss: string | null;
  };
  config: PageJson;
  usingComponents: Record<string, string>;
};

export type MiniProgramComponent = {
  /** Project-relative path without the extension, e.g. `components/card/card`. */
  id: string;
  /** Absolute path without the extension. */
  base: string;
  files: {
    js: string;
    wxml: string;
    json: string | null;
    wxss: string | null;
  };
  config: PageJson;
  usingComponents: Record<string, string>;
};

export type MiniProgramTemplate = {
  /** Page route or component id. */
  id: string;
  /** Project-relative `.wxml` path. */
  file: string;
  source: string;
};

export type MiniProgramScript = {
  /** Project-relative `.wxs` path without the extension. */
  id: string;
  file: string;
  source: string;
};

export type MiniProgramAsset = {
  /** Project-relative path, using `/`. */
  relative: string;
  /** Absolute source path. */
  source: string;
  /** Output path inside the archive. */
  output: string;
};

export type MiniProgramProgram = {
  root: string;
  app: AppJson;
  projectConfig: ProjectConfig;
  manifest: ManifestOverrides;
  pages: MiniProgramPage[];
  components: MiniProgramComponent[];
  templates: MiniProgramTemplate[];
  scripts: MiniProgramScript[];
  /** Every file that must be copied to the build staging directory. */
  files: string[];
  /** Non-code files copied into the package under `assets/`. */
  assets: MiniProgramAsset[];
  /** WXML/WXSS content rewritten for the QChat container, by project-relative path. */
  rewritten: Map<string, string>;
  permissions: string[];
  warnings: string[];
};

const routePattern = /^[A-Za-z0-9_\-/]+$/;
const colorPattern = /^#[0-9a-fA-F]{3,8}$/;
const componentTagPattern = /^[a-z][a-z0-9-]*$/;

const ignoredDirectories = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  "miniprogram_npm",
  ".qchat-dev",
  ".qchat-build",
]);

const ignoredRootFiles = new Set([
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "tsconfig.json",
  "tsconfig.build.json",
  "README.md",
  "LICENSE",
  "LICENSE.md",
  ".gitignore",
  ".npmrc",
  ".prettierrc",
  ".eslintrc",
  ".eslintrc.json",
]);

/// Files that are compiled by webpack and therefore must not be copied as
/// payload assets.
const codeExtensions = new Set([".js", ".ts", ".json", ".wxml", ".wxss", ".wxs", ".map"]);

/// Extensions accepted under `assets/` by the server and the device cache.
/// Keep in sync with `webappAssetExtensions` in `packages/contracts`.
const assetExtensions = new Set([
  ".html",
  ".htm",
  ".js",
  ".mjs",
  ".css",
  ".json",
  ".map",
  ".txt",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".svg",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".mp3",
  ".wav",
  ".mp4",
  ".webm",
  ".vtt",
  ".wasm",
]);

const permissionForApi: Record<string, string> = {
  showToast: "toast",
  chooseImage: "media.choose",
  chooseMedia: "media.choose",
  getUserProfile: "user.profile",
  getUserInfo: "user.profile",
  setClipboardData: "clipboard",
  getClipboardData: "clipboard",
  setStorage: "storage",
  getStorage: "storage",
  removeStorage: "storage",
  clearStorage: "storage",
  setStorageSync: "storage",
  getStorageSync: "storage",
  removeStorageSync: "storage",
  clearStorageSync: "storage",
  request: "network",
  shareAppMessage: "share",
};

export function toPosix(value: string): string {
  return value.replaceAll("\\", "/");
}

function relativePosix(root: string, file: string): string {
  return toPosix(path.relative(root, file));
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function jsonLocation(text: string, error: unknown): SourceLocation {
  const message = error instanceof Error ? error.message : String(error);
  const position = /(?:position|at)\s+(\d+)/i.exec(message);
  if (!position) return {};
  const index = Math.min(Number(position[1]), text.length);
  const before = text.slice(0, index);
  const line = before.split("\n").length;
  const lastBreak = before.lastIndexOf("\n");
  return { line, column: index - lastBreak };
}

async function readText(file: string, code: string): Promise<string> {
  try {
    return await readFile(file, "utf8");
  } catch {
    throw new MiniProgramError(code, "file not found", { file: toPosix(file) });
  }
}

async function readJson<T>(file: string, root: string, code: string): Promise<T> {
  const text = await readText(file, code);
  const clean = stripBom(text);
  try {
    return JSON.parse(clean) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new MiniProgramError("JSON_INVALID", message, {
      file: relativePosix(root, file),
      ...jsonLocation(clean, error),
    });
  }
}

async function readOptional(file: string): Promise<string | null> {
  try {
    return await readFile(file, "utf8");
  } catch {
    return null;
  }
}

async function readJsonOptional<T>(file: string, root: string): Promise<T | null> {
  const text = await readOptional(file);
  if (text == null) return null;
  const clean = stripBom(text);
  try {
    return JSON.parse(clean) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new MiniProgramError("JSON_INVALID", message, {
      file: relativePosix(root, file),
      ...jsonLocation(clean, error),
    });
  }
}

function validateRoute(route: string, file: string): string {
  const clean = route.replaceAll("\\", "/").replace(/^\.?\//, "").replace(/\.(wxml|js|json|wxss)$/, "");
  if (
    !clean ||
    !routePattern.test(clean) ||
    clean.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new MiniProgramError("INVALID_ROUTE", `invalid page route: ${route}`, { file });
  }
  return clean;
}

function validateColor(value: unknown, field: string, file: string): void {
  if (value == null || value === "") return;
  if (typeof value !== "string" || !colorPattern.test(value)) {
    throw new MiniProgramError("INVALID_WINDOW", `${field} must be a hex colour`, { file });
  }
}

function validateApp(app: AppJson, file: string): AppJson {
  if (!app || !Array.isArray(app.pages) || app.pages.length === 0) {
    throw new MiniProgramError("INVALID_APP", "app.json must declare a non-empty pages array", { file });
  }
  if (app.pages.length > 200) {
    throw new MiniProgramError("INVALID_APP", "too many pages", { file });
  }
  const pages = app.pages.map((route) => validateRoute(String(route), file));
  if (new Set(pages).size !== pages.length) {
    throw new MiniProgramError("INVALID_APP", "duplicate page route", { file });
  }
  app.pages = pages;

  const window = app.window ?? {};
  if (window.navigationBarTextStyle != null && window.navigationBarTextStyle !== "black" && window.navigationBarTextStyle !== "white") {
    throw new MiniProgramError("INVALID_WINDOW", "navigationBarTextStyle must be black or white", { file });
  }
  if (window.navigationStyle != null && window.navigationStyle !== "default" && window.navigationStyle !== "custom") {
    throw new MiniProgramError("INVALID_WINDOW", "navigationStyle must be default or custom", { file });
  }
  validateColor(window.navigationBarBackgroundColor, "navigationBarBackgroundColor", file);
  validateColor(window.backgroundColor, "backgroundColor", file);

  if (app.tabBar != null) {
    if (!Array.isArray(app.tabBar.list) || app.tabBar.list.length < 2 || app.tabBar.list.length > 5) {
      throw new MiniProgramError("INVALID_TABBAR", "tabBar.list must contain 2 to 5 items", { file });
    }
    for (const item of app.tabBar.list) {
      const pagePath = validateRoute(String(item.pagePath ?? ""), file);
      if (!pages.includes(pagePath)) {
        throw new MiniProgramError("INVALID_TABBAR", `tabBar page is not in pages: ${pagePath}`, { file });
      }
    }
    validateColor(app.tabBar.color, "tabBar.color", file);
    validateColor(app.tabBar.selectedColor, "tabBar.selectedColor", file);
    validateColor(app.tabBar.backgroundColor, "tabBar.backgroundColor", file);
  }

  if (app.usingComponents != null && typeof app.usingComponents !== "object") {
    throw new MiniProgramError("INVALID_APP", "usingComponents must be an object", { file });
  }
  return app;
}

/// Resolves a `usingComponents` spec to the absolute base path of a component.
export function resolveComponentBase(spec: string, fromFile: string, root: string): string {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(spec)) {
    throw new MiniProgramError("UNSUPPORTED_COMPONENT", `plugin and URL components are not supported: ${spec}`, {
      file: fromFile === root ? undefined : relativePosix(root, fromFile),
    });
  }
  let base: string;
  if (spec.startsWith("/")) base = path.join(root, spec.slice(1));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(fromFile), spec);
  else base = path.join(root, spec);
  if (!isInside(root, base)) {
    throw new MiniProgramError("INVALID_COMPONENT", `component escapes the project: ${spec}`, {
      file: relativePosix(root, fromFile),
    });
  }
  return base.replace(/\.(js|json|wxml|wxss)$/, "");
}

type ResolvedUsing = {
  /** tag name -> id */
  ids: Record<string, string>;
  /** tag name -> absolute base without extension */
  bases: Record<string, string>;
};

function resolveUsing(
  using: Record<string, string> | undefined,
  fromFile: string,
  root: string,
): ResolvedUsing {
  const ids: Record<string, string> = {};
  const bases: Record<string, string> = {};
  if (!using) return { ids, bases };
  if (typeof using !== "object" || Array.isArray(using)) {
    throw new MiniProgramError("INVALID_COMPONENT", "usingComponents must be an object", {
      file: relativePosix(root, fromFile),
    });
  }
  for (const [name, raw] of Object.entries(using)) {
    if (!componentTagPattern.test(name)) {
      throw new MiniProgramError("INVALID_COMPONENT", `invalid component tag: ${name}`, {
        file: relativePosix(root, fromFile),
      });
    }
    if (typeof raw !== "string" || raw.trim() === "") {
      throw new MiniProgramError("INVALID_COMPONENT", `component path for ${name} must be a string`, {
        file: relativePosix(root, fromFile),
      });
    }
    const base = resolveComponentBase(raw.trim(), fromFile, root);
    const id = relativePosix(root, base);
    ids[name] = id;
    bases[name] = base;
  }
  return { ids, bases };
}

type WalkResult = {
  files: string[];
  sources: Map<string, string>;
};

async function walkProject(root: string): Promise<WalkResult> {
  const files: string[] = [];
  const sources = new Map<string, string>();

  async function walk(directory: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (directory === root) {
        throw new MiniProgramError("PROJECT_NOT_FOUND", "project directory cannot be read", { file: root });
      }
      return;
    }
    for (const entry of entries) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith(".") || ignoredDirectories.has(entry.name)) continue;
        await walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const relative = relativePosix(root, full);
      if (!relative.includes("/") && ignoredRootFiles.has(relative)) continue;
      files.push(relative);
      const extension = path.extname(entry.name).toLowerCase();
      if (extension === ".wxml" || extension === ".wxss") {
        sources.set(relative, await readFile(full, "utf8"));
      }
    }
  }

  if (!existsSync(root) || !(await stat(root)).isDirectory()) {
    throw new MiniProgramError("PROJECT_NOT_FOUND", "project directory does not exist", { file: root });
  }
  await walk(root);
  return { files, sources };
}

function outputAssetPath(relative: string): string {
  return relative.startsWith("assets/") ? relative : `assets/${relative}`;
}

function resolveAssetUrl(raw: string, fromRelative: string, assets: Set<string>): string | null {
  if (!raw) return null;
  if (/^(data:|https?:|blob:|wxfile:|#|\/\/)/i.test(raw)) return null;
  if (raw.includes("{{")) return null;
  const clean = raw.split("#")[0].split("?")[0].trim();
  if (!clean) return null;
  let relative: string;
  if (clean.startsWith("/")) relative = clean.replace(/^\/+/, "");
  else relative = path.posix.normalize(path.posix.join(path.posix.dirname(fromRelative), clean));
  if (!relative || relative === "." || relative.startsWith("..")) return null;
  if (!assets.has(relative)) return null;
  return `/${outputAssetPath(relative)}`;
}

/// Rewrites static asset attributes in WXML. This is path mapping, not template
/// compilation: expressions, remote URLs and data URLs are left untouched.
export function rewriteWxmlAssets(source: string, file: string, assets: Set<string>): string {
  const attribute = /(\b(?:src|poster|data-src|background)\s*=\s*)(["'])([^"']+)\2/gi;
  return source.replace(attribute, (full, prefix: string, quote: string, value: string) => {
    const next = resolveAssetUrl(value, file, assets);
    return next == null ? full : `${prefix}${quote}${next}${quote}`;
  });
}

function rewriteWxssUrls(source: string, file: string, assets: Set<string>): string {
  const url = /url\(\s*(["']?)([^"')]+)\1\s*\)/gi;
  return source.replace(url, (full, quote: string, value: string) => {
    const next = resolveAssetUrl(value, file, assets);
    return next == null ? full : `url(${quote}${next}${quote})`;
  });
}

/// Inlines WXSS `@import` statements. The official stylesheet compiler does not
/// resolve imports, and the QChat container must not serve `.wxss` files.
export async function inlineWxss(
  source: string,
  file: string,
  readSource: (relative: string) => Promise<string | null>,
  seen: Set<string> = new Set(),
): Promise<string> {
  const pattern = /@import\s+(?:url\()?\s*(["']?)([^"')]+)\1\s*\)?\s*;/gi;
  let output = "";
  let cursor = 0;
  for (const match of source.matchAll(pattern)) {
    const index = match.index ?? 0;
    output += source.slice(cursor, index);
    cursor = index + match[0].length;
    const spec = match[2].trim();
    if (/^(https?:|data:|\/\/)/i.test(spec)) {
      output += match[0];
      continue;
    }
    const relative = spec.startsWith("/")
      ? spec.replace(/^\/+/, "")
      : path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
    if (seen.has(relative)) continue;
    const imported = await readSource(relative);
    if (imported == null) {
      throw new MiniProgramError("WXSS_IMPORT_MISSING", `imported stylesheet not found: ${spec}`, { file });
    }
    seen.add(relative);
    output += await inlineWxss(imported, relative, readSource, seen);
  }
  return output + source.slice(cursor);
}

function detectPermissions(files: string[], read: (relative: string) => string): string[] {
  const used = new Set<string>();
  for (const relative of files) {
    if (!relative.endsWith(".js") && !relative.endsWith(".ts")) continue;
    const source = read(relative);
    for (const match of source.matchAll(/\bwx\.([A-Za-z0-9_]+)\s*\(/g)) {
      const permission = permissionForApi[match[1]];
      if (permission) used.add(permission);
    }
  }
  return [...used].sort();
}

export type LoadOptions = {
  projectDir: string;
  /** Overrides used when the project has no manifest.json. */
  overrides?: ManifestOverrides;
};

/// Loads a WeChat-shaped project without compiling it.
export async function loadMiniProgram(options: LoadOptions): Promise<MiniProgramProgram> {
  const root = path.resolve(options.projectDir);
  const warnings: string[] = [];
  const appFile = path.join(root, "app.json");
  const app = validateApp(await readJson<AppJson>(appFile, root, "APP_MISSING"), "app.json");
  const projectConfig =
    (await readJsonOptional<ProjectConfig>(path.join(root, "project.config.json"), root)) ?? {};
  const manifest = {
    ...((await readJsonOptional<ManifestOverrides>(path.join(root, "manifest.json"), root)) ?? {}),
    ...(options.overrides ?? {}),
  };
  if (projectConfig.version && !manifest.version) manifest.version = projectConfig.version;
  if (projectConfig.description && !manifest.description) manifest.description = projectConfig.description;

  const walked = await walkProject(root);
  const assetSet = new Set<string>();
  const assets: MiniProgramAsset[] = [];
  for (const relative of walked.files) {
    const extension = path.extname(relative).toLowerCase();
    if (codeExtensions.has(extension)) continue;
    if (!relative.includes("/") && ignoredRootFiles.has(relative)) continue;
    if (!assetExtensions.has(extension)) {
      warnings.push(`ignored unsupported file: ${relative}`);
      continue;
    }
    assetSet.add(relative);
    assets.push({ relative, source: path.join(root, ...relative.split("/")), output: outputAssetPath(relative) });
  }

  const globalUsing = resolveUsing(app.usingComponents, appFile, root);
  const pages: MiniProgramPage[] = [];
  const templates: MiniProgramTemplate[] = [];
  const scripts: MiniProgramScript[] = [];

  for (const route of app.pages) {
    const base = path.join(root, ...route.split("/"));
    const jsonPath = existsSync(`${base}.json`) ? `${base}.json` : null;
    const wxssPath = existsSync(`${base}.wxss`) ? `${base}.wxss` : null;
    if (!existsSync(`${base}.js`)) {
      throw new MiniProgramError("SCRIPT_MISSING", "page script not found", { file: `${route}.js` });
    }
    if (!existsSync(`${base}.wxml`)) {
      throw new MiniProgramError("TEMPLATE_MISSING", "page template not found", { file: `${route}.wxml` });
    }
    const config = jsonPath ? ((await readJson<PageJson>(jsonPath, root, "INVALID_JSON")) ?? {}) : {};
    const localUsing = resolveUsing(config.usingComponents, jsonPath ?? `${base}.json`, root);
    const usingComponents = { ...globalUsing.ids, ...localUsing.ids };
    templates.push({
      id: route,
      file: `${route}.wxml`,
      source: walked.sources.get(`${route}.wxml`) ?? "",
    });
    pages.push({
      route,
      base,
      files: {
        js: `${route}.js`,
        wxml: `${route}.wxml`,
        json: jsonPath ? relativePosix(root, jsonPath) : null,
        wxss: wxssPath ? relativePosix(root, wxssPath) : null,
      },
      config,
      usingComponents,
    });
  }

  // Components are discovered transitively from app-level and page-level
  // `usingComponents` declarations.
  const components = new Map<string, MiniProgramComponent>();
  const queue: Array<{ base: string; from: string }> = [];
  for (const base of Object.values(globalUsing.bases)) queue.push({ base, from: appFile });
  for (const page of pages) {
    const pageBase = path.join(root, ...page.route.split("/"));
    const localUsing = resolveUsing(page.config.usingComponents, `${pageBase}.json`, root);
    for (const base of Object.values(localUsing.bases)) queue.push({ base, from: `${pageBase}.json` });
  }

  while (queue.length) {
    const next = queue.shift();
    if (!next) break;
    const id = relativePosix(root, next.base);
    if (components.has(id)) continue;
    const files = {
      js: `${next.base}.js`,
      wxml: `${next.base}.wxml`,
      json: existsSync(`${next.base}.json`) ? `${next.base}.json` : null,
      wxss: existsSync(`${next.base}.wxss`) ? `${next.base}.wxss` : null,
    };
    if (!existsSync(files.js)) {
      throw new MiniProgramError("SCRIPT_MISSING", "component script not found", { file: `${id}.js` });
    }
    if (!existsSync(files.wxml)) {
      throw new MiniProgramError("TEMPLATE_MISSING", "component template not found", { file: `${id}.wxml` });
    }
    const config = files.json ? (await readJson<PageJson>(files.json, root, "INVALID_JSON")) ?? {} : {};
    if (config.component !== true) {
      warnings.push(`component ${id} does not set component: true in its JSON`);
    }
    const localUsing = resolveUsing(config.usingComponents, files.json ?? `${next.base}.json`, root);
    const usingComponents = { ...globalUsing.ids, ...localUsing.ids };
    const templateSource = walked.sources.get(`${id}.wxml`) ?? "";
    templates.push({ id, file: `${id}.wxml`, source: templateSource });
    components.set(id, {
      id,
      base: next.base,
      files: {
        js: `${id}.js`,
        wxml: `${id}.wxml`,
        json: files.json ? relativePosix(root, files.json) : null,
        wxss: files.wxss ? relativePosix(root, files.wxss) : null,
      },
      config,
      usingComponents,
    });
    for (const base of Object.values(localUsing.bases)) queue.push({ base, from: files.json ?? `${next.base}.json` });
  }

  for (const relative of walked.files) {
    if (!relative.endsWith(".wxs")) continue;
    scripts.push({
      id: relative.slice(0, -".wxs".length),
      file: relative,
      source: await readText(path.join(root, ...relative.split("/")), "SCRIPT_MISSING"),
    });
  }

  // Rewrite static asset URLs once, so both the validation pass and the
  // webpack staging copy see the same content.
  const rewritten = new Map<string, string>();
  for (const [relative, source] of walked.sources) {
    if (relative.endsWith(".wxml")) {
      rewritten.set(relative, rewriteWxmlAssets(source, relative, assetSet));
    } else if (relative.endsWith(".wxss")) {
      const inlined = await inlineWxss(source, relative, async (imported) => {
        const candidate = path.join(root, ...imported.split("/"));
        return readOptional(candidate);
      });
      rewritten.set(relative, rewriteWxssUrls(inlined, relative, assetSet));
    }
  }

  const cachedSources = new Map<string, string>();
  for (const relative of walked.files) {
    if (!relative.endsWith(".js") && !relative.endsWith(".ts")) continue;
    cachedSources.set(relative, await readText(path.join(root, ...relative.split("/")), "SCRIPT_MISSING"));
  }
  const permissions = detectPermissions(walked.files, (relative) => cachedSources.get(relative) ?? "");

  if (app.tabBar?.custom) {
    warnings.push("custom tabBar is compiled but the QChat host draws the native tab bar from tabBar.list");
  }
  if (app.subpackages?.length || app.subPackages?.length) {
    warnings.push("subpackages are compiled into one package");
  }

  return {
    root,
    app,
    projectConfig,
    manifest,
    pages,
    components: [...components.values()],
    templates,
    scripts,
    files: walked.files,
    assets,
    rewritten,
    permissions,
    warnings,
  };
}
