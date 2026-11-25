/// Mini Program project model shared by the editor, the diagnostics and the
/// tests.
///
/// A QChat Mini Program is a WeChat project: `app.json`, `app.js`, `app.wxss`,
/// `pages/<route>/{js,json,wxml,wxss}` and `components/<name>/{js,json,wxml,wxss}`.
/// This module knows that layout, the built-in tags, the JSON schemas Monaco
/// uses and a static analyser that catches the mistakes the official compiler
/// would reject later. It never compiles WXML or WXSS: the official
/// `glass-easel` pipeline in `@mna/qchat` does that.

export const WXML_LANGUAGE = "wxml";
export const WXSS_LANGUAGE = "wxss";

export const ALLOWED_PERMISSIONS = [
  "clipboard",
  "media.choose",
  "network",
  "qchat.api",
  "share",
  "storage",
  "toast",
  "user.profile",
] as const;

/// Every tag `@mna/qchat` implements as a real host component.
/// `packages/miniapp-framework/src/builtin.ts` is the source of truth; the test
/// suite compares this list against the shipped `builtin/` folders.
export const BUILTIN_COMPONENTS = [
  "view",
  "text",
  "image",
  "button",
  "scroll-view",
  "input",
  "textarea",
  "switch",
  "checkbox",
  "checkbox-group",
  "radio",
  "radio-group",
  "slider",
  "navigator",
  "progress",
  "swiper",
  "swiper-item",
  "picker",
  "form",
  "label",
  "rich-text",
] as const;

export type BuiltinComponent = (typeof BUILTIN_COMPONENTS)[number];

export type FileKind =
  | "app"
  | "page"
  | "component"
  | "manifest"
  | "config"
  | "markup"
  | "style"
  | "script"
  | "asset"
  | "doc"
  | "other";

export type ProjectFile = {
  relative: string;
  content: string;
};

export type Diagnostic = {
  id: string;
  severity: "error" | "warning";
  message: string;
  file: string;
  line?: number;
};

export function normalizeRelative(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
}

function extensionOf(relative: string): string {
  const name = normalizeRelative(relative).split("/").pop() ?? "";
  const index = name.lastIndexOf(".");
  return index < 0 ? "" : name.slice(index + 1).toLowerCase();
}

/// Classifies a project-relative path so the explorer and the tabs can pick an
/// icon and the editor can pick a language.
export function kindFor(relative: string): FileKind {
  const path = normalizeRelative(relative);
  const extension = extensionOf(path);
  const name = path.split("/").pop() ?? "";
  if (name === "app.json" || name === "app.js" || name === "app.wxss") return "app";
  if (name === "manifest.json") return "manifest";
  if (name === "project.config.json" || name === "project.private.config.json") {
    return "config";
  }
  if (name === "sitemap.json") return "config";
  if (extension === "wxml") return "markup";
  if (extension === "wxss") return "style";
  if (extension === "json") {
    return path.startsWith("pages/") ? "page" : path.startsWith("components/") ? "component" : "config";
  }
  if (["js", "mjs", "cjs", "ts", "tsx", "jsx", "wxs"].includes(extension)) return "script";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "ico"].includes(extension)) return "asset";
  if (["md", "mdx", "txt"].includes(extension)) return "doc";
  return "other";
}

/// The page or component base path (`pages/index/index`) a file belongs to.
export function ownerRouteOf(relative: string): string | null {
  const path = normalizeRelative(relative);
  if (path === "app.json" || path === "app.js" || path === "app.wxss") return null;
  const extension = extensionOf(path);
  if (!["js", "json", "wxml", "wxss", "wxs"].includes(extension)) return null;
  if (!path.startsWith("pages/") && !path.startsWith("components/")) return null;
  return path.slice(0, path.length - extension.length - 1);
}

export function readJson<T = unknown>(content: string): { value: T | null; error: string | null } {
  try {
    return { value: JSON.parse(content) as T, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { value: null, error: message };
  }
}

function lineOf(content: string, index: number): number {
  let line = 1;
  for (let cursor = 0; cursor < index && cursor < content.length; cursor += 1) {
    if (content[cursor] === "\n") line += 1;
  }
  return line;
}

function errorMessageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/// Resolves a `usingComponents` spec to a root-relative base path, mirroring
/// `resolveComponentBase` in `@mna/qchat`.
export function resolveComponentSpec(spec: string, fromFile: string): string | null {
  const trimmed = spec.trim();
  if (!trimmed) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return null; // plugin://, ext://
  if (trimmed.startsWith("/")) return normalizeRelative(trimmed);
  const from = normalizeRelative(fromFile);
  const base = from.includes("/") ? from.slice(0, from.lastIndexOf("/")) : "";
  const parts = `${base}/${trimmed}`.split("/");
  const stack: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
}

const SELF_CLOSING = new Set([
  "image",
  "input",
  "icon",
  "progress",
  "import",
  "include",
  "slot",
  "switch",
  "checkbox",
  "radio",
  "slider",
]);

type Tag = { name: string; closing: boolean; selfClosing: boolean; attrs: string; index: number };

function scanTags(source: string): Tag[] {
  const tags: Tag[] = [];
  let index = 0;
  while (index < source.length) {
    const open = source.indexOf("<", index);
    if (open < 0) break;
    if (source.startsWith("<!--", open)) {
      const end = source.indexOf("-->", open + 4);
      index = end < 0 ? source.length : end + 3;
      continue;
    }
    const next = source[open + 1] ?? "";
    if (next === "/") {
      const close = source.indexOf(">", open);
      if (close < 0) break;
      const name = source.slice(open + 2, close).trim();
      if (name) tags.push({ name, closing: true, selfClosing: false, attrs: "", index: open });
      index = close + 1;
      continue;
    }
    if (!/[A-Za-z]/.test(next)) {
      index = open + 1;
      continue;
    }
    // Attributes may contain `>` inside a quoted mustache, so scan quotes.
    let cursor = open + 1;
    let quote: '"' | "'" | null = null;
    while (cursor < source.length) {
      const char = source[cursor];
      if (quote) {
        if (char === quote) quote = null;
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === ">") {
        break;
      }
      cursor += 1;
    }
    const raw = source.slice(open + 1, cursor);
    const selfClosing = raw.trimEnd().endsWith("/");
    const body = selfClosing ? raw.trimEnd().slice(0, -1) : raw;
    const nameMatch = /^([A-Za-z][\w:.-]*)/.exec(body);
    if (!nameMatch) {
      index = cursor + 1;
      continue;
    }
    tags.push({
      name: nameMatch[1]!,
      closing: false,
      selfClosing,
      attrs: body.slice(nameMatch[1]!.length),
      index: open,
    });
    index = cursor + 1;
  }
  return tags;
}

function diagnoseMarkup(file: string, content: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const stack: Tag[] = [];
  for (const tag of scanTags(content)) {
    if (tag.closing) {
      const top = stack.pop();
      if (!top) {
        diagnostics.push({
          id: `${file}:${tag.index}:stray-close`,
          severity: "error",
          file,
          line: lineOf(content, tag.index),
          message: `</${tag.name}> has no matching opening tag.`,
        });
        continue;
      }
      if (top.name !== tag.name) {
        diagnostics.push({
          id: `${file}:${tag.index}:mismatch`,
          severity: "error",
          file,
          line: lineOf(content, tag.index),
          message: `</${tag.name}> closes <${top.name}> opened on line ${lineOf(content, top.index)}.`,
        });
        // Recover by dropping until the matching name, like a lenient parser.
        let cursor = stack.length - 1;
        while (cursor >= 0 && stack[cursor]!.name !== tag.name) cursor -= 1;
        if (cursor >= 0) stack.length = cursor;
      }
      continue;
    }
    if (tag.selfClosing || SELF_CLOSING.has(tag.name)) continue;
    stack.push(tag);
  }
  for (const tag of stack) {
    diagnostics.push({
      id: `${file}:${tag.index}:unclosed`,
      severity: "error",
      file,
      line: lineOf(content, tag.index),
      message: `<${tag.name}> is never closed.`,
    });
  }

  // `wx:for` without `wx:key` is a warning in WeChat too; it also makes
  // reordering re-create every node.
  for (const tag of scanTags(content)) {
    if (tag.closing) continue;
    if (/\bwx:for\b/.test(tag.attrs) && !/\bwx:key\b/.test(tag.attrs)) {
      diagnostics.push({
        id: `${file}:${tag.index}:wx-for-key`,
        severity: "warning",
        file,
        line: lineOf(content, tag.index),
        message: `<${tag.name}> uses wx:for without wx:key.`,
      });
    }
  }
  return diagnostics;
}

function diagnoseStyle(file: string, content: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  let depth = 0;
  let quote: '"' | "'" | null = null;
  let comment = false;
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];
    if (comment) {
      if (char === "*" && next === "/") {
        comment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === "/" && next === "*") {
      comment = true;
      index += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth < 0) {
        diagnostics.push({
          id: `${file}:${index}:extra-brace`,
          severity: "error",
          file,
          line: lineOf(content, index),
          message: "Unexpected `}`.",
        });
        depth = 0;
      }
    }
  }
  if (depth > 0) {
    diagnostics.push({
      id: `${file}:eof:unclosed-brace`,
      severity: "error",
      file,
      message: `${depth} WXSS block${depth === 1 ? "" : "s"} never closed.`,
    });
  }
  return diagnostics;
}

const EVENT_ATTRIBUTE = /\b(?:bind|catch|capture-bind|capture-catch|mut-bind)[:]?([A-Za-z][\w-]*)\s*=\s*"([^"]*)"/g;

/// `bindtap="onTap"` needs `onTap` in the page/component script.
function diagnoseHandlers(
  file: string,
  markup: string,
  script: string,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const seen = new Set<string>();
  EVENT_ATTRIBUTE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = EVENT_ATTRIBUTE.exec(markup))) {
    const handler = match[2]!.trim();
    if (!handler || handler.includes("{{")) continue;
    if (seen.has(handler)) continue;
    seen.add(handler);
    const defined = new RegExp(
      `(?:^|[\\s,{])${handler.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(?:\\(|:|=)`,
      "m",
    ).test(script);
    if (!defined) {
      diagnostics.push({
        id: `${file}:handler:${handler}`,
        severity: "warning",
        file,
        line: lineOf(markup, match.index),
        message: `Handler \`${handler}\` is not defined in the matching script.`,
      });
    }
  }
  return diagnostics;
}

type AppJsonLike = {
  pages?: unknown;
  tabBar?: { list?: Array<{ pagePath?: unknown; text?: unknown }> };
  usingComponents?: Record<string, unknown>;
  subpackages?: Array<{ root?: unknown; pages?: unknown }>;
  subPackages?: Array<{ root?: unknown; pages?: unknown }>;
};

type JsonConfig = {
  component?: unknown;
  usingComponents?: Record<string, unknown>;
};

function exists(files: Map<string, ProjectFile>, relative: string): boolean {
  return files.has(normalizeRelative(relative));
}

function diagnoseUsingComponents(
  files: Map<string, ProjectFile>,
  owner: string,
  using: Record<string, unknown> | undefined,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (!using || typeof using !== "object" || Array.isArray(using)) return diagnostics;
  for (const [id, spec] of Object.entries(using)) {
    if (typeof spec !== "string") {
      diagnostics.push({
        id: `${owner}:using:${id}:type`,
        severity: "error",
        file: owner,
        message: `usingComponents.${id} must be a string path.`,
      });
      continue;
    }
    const base = resolveComponentSpec(spec, owner);
    if (!base) continue; // plugin:// and ext:// are resolved by the host, not the project
    for (const extension of ["json", "js", "wxml"]) {
      if (!exists(files, `${base}.${extension}`)) {
        diagnostics.push({
          id: `${owner}:using:${id}:${extension}`,
          severity: "error",
          file: owner,
          message: `Component \`${id}\` is missing ${base}.${extension}.`,
        });
      }
    }
    const config = files.get(`${base}.json`);
    if (config) {
      const parsed = readJson<JsonConfig>(config.content);
      if (parsed.value && parsed.value.component !== true) {
        diagnostics.push({
          id: `${owner}:using:${id}:flag`,
          severity: "warning",
          file: `${base}.json`,
          message: `\`${base}.json\` should set "component": true.`,
        });
      }
    }
  }
  return diagnostics;
}

function diagnoseManifest(file: string, content: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const parsed = readJson<Record<string, unknown>>(content);
  if (parsed.error) {
    diagnostics.push({
      id: `${file}:json`,
      severity: "error",
      file,
      message: `manifest.json is not valid JSON: ${parsed.error}`,
    });
    return diagnostics;
  }
  const manifest = parsed.value ?? {};
  if (typeof manifest.name !== "string" || !manifest.name.trim()) {
    diagnostics.push({
      id: `${file}:name`,
      severity: "error",
      file,
      message: 'manifest.json needs a non-empty "name".',
    });
  }
  const version = manifest.version;
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    diagnostics.push({
      id: `${file}:version`,
      severity: "error",
      file,
      message: '"version" must look like 1.0.0.',
    });
  }
  const permissions = manifest.requestedPermissions;
  if (permissions !== undefined) {
    if (!Array.isArray(permissions)) {
      diagnostics.push({
        id: `${file}:permissions`,
        severity: "error",
        file,
        message: '"requestedPermissions" must be an array.',
      });
    } else {
      for (const permission of permissions) {
        if (typeof permission !== "string" || !(ALLOWED_PERMISSIONS as readonly string[]).includes(permission)) {
          diagnostics.push({
            id: `${file}:permissions:${String(permission)}`,
            severity: "error",
            file,
            message: `Unknown permission \`${String(permission)}\`. Allowed: ${ALLOWED_PERMISSIONS.join(", ")}.`,
          });
        }
      }
    }
  }
  return diagnostics;
}

/// Static checks that mirror what `qchat validate` and the official build
/// reject. The result is deterministic, so tests can assert it exactly.
export function diagnoseProject(files: ProjectFile[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const byPath = new Map<string, ProjectFile>();
  for (const file of files) {
    byPath.set(normalizeRelative(file.relative), { ...file, relative: normalizeRelative(file.relative) });
  }

  const app = byPath.get("app.json");
  if (!app) {
    return [
      {
        id: "app.json:missing",
        severity: "error",
        file: "app.json",
        message: "The project has no app.json.",
      },
    ];
  }
  const appParsed = readJson<AppJsonLike>(app.content);
  if (appParsed.error) {
    return [
      {
        id: "app.json:json",
        severity: "error",
        file: "app.json",
        message: `app.json is not valid JSON: ${appParsed.error}`,
      },
    ];
  }
  const appJson = appParsed.value ?? {};
  const pages = Array.isArray(appJson.pages) ? appJson.pages.map(String) : [];
  if (!pages.length) {
    diagnostics.push({
      id: "app.json:pages",
      severity: "error",
      file: "app.json",
      message: 'app.json must declare a non-empty "pages" array.',
    });
  }

  const pageSet = new Set(pages);
  for (const route of pages) {
    if (route.startsWith("/") || route.includes("..")) {
      diagnostics.push({
        id: `app.json:route:${route}`,
        severity: "error",
        file: "app.json",
        message: `Page route \`${route}\` must be relative and stay inside the project.`,
      });
      continue;
    }
    for (const extension of ["js", "wxml"]) {
      if (!exists(byPath, `${route}.${extension}`)) {
        diagnostics.push({
          id: `app.json:route:${route}:${extension}`,
          severity: "error",
          file: "app.json",
          message: `Page \`${route}\` is missing ${route}.${extension}.`,
        });
      }
    }
  }

  const tabList = appJson.tabBar?.list;
  if (tabList !== undefined) {
    if (!Array.isArray(tabList) || tabList.length < 2 || tabList.length > 5) {
      diagnostics.push({
        id: "app.json:tabbar:count",
        severity: "warning",
        file: "app.json",
        message: "tabBar.list should have 2 to 5 items.",
      });
    }
    for (const [index, item] of (Array.isArray(tabList) ? tabList : []).entries()) {
      const pagePath = String(item?.pagePath ?? "");
      if (!pageSet.has(pagePath)) {
        diagnostics.push({
          id: `app.json:tabbar:${index}`,
          severity: "error",
          file: "app.json",
          message: `tabBar item ${index + 1} points at \`${pagePath}\`, which is not in pages.`,
        });
      }
      if (!item?.text) {
        diagnostics.push({
          id: `app.json:tabbar:${index}:text`,
          severity: "warning",
          file: "app.json",
          message: `tabBar item ${index + 1} has no text.`,
        });
      }
    }
  }

  diagnostics.push(...diagnoseUsingComponents(byPath, "app.json", appJson.usingComponents));

  const subpackages = appJson.subpackages ?? appJson.subPackages;
  if (Array.isArray(subpackages)) {
    for (const [index, pack] of subpackages.entries()) {
      const root = String(pack?.root ?? "");
      const subPages = Array.isArray(pack?.pages) ? pack.pages.map(String) : [];
      if (!root || !subPages.length) {
        diagnostics.push({
          id: `app.json:subpackage:${index}`,
          severity: "warning",
          file: "app.json",
          message: `Subpackage ${index + 1} needs a root and at least one page; QChat bundles all pages into one package.`,
        });
        continue;
      }
      for (const route of subPages) {
        const full = `${root.replace(/\/+$/, "")}/${route}`;
        if (!exists(byPath, `${full}.wxml`) || !exists(byPath, `${full}.js`)) {
          diagnostics.push({
            id: `app.json:subpackage:${index}:${route}`,
            severity: "error",
            file: "app.json",
            message: `Subpackage page \`${full}\` is missing its js/wxml files.`,
          });
        }
      }
    }
  }

  for (const file of byPath.values()) {
    const extension = extensionOf(file.relative);
    if (extension === "json" && file.relative !== "app.json" && file.relative !== "manifest.json") {
      const parsed = readJson<JsonConfig>(file.content);
      if (parsed.error) {
        diagnostics.push({
          id: `${file.relative}:json`,
          severity: "error",
          file: file.relative,
          message: `Invalid JSON: ${parsed.error}`,
        });
        continue;
      }
      diagnostics.push(
        ...diagnoseUsingComponents(byPath, file.relative, parsed.value?.usingComponents),
      );
    }
    if (extension === "wxml") {
      diagnostics.push(...diagnoseMarkup(file.relative, file.content));
      const route = ownerRouteOf(file.relative);
      const script = route ? byPath.get(`${route}.js`) : undefined;
      if (script) diagnostics.push(...diagnoseHandlers(file.relative, file.content, script.content));
    }
    if (extension === "wxss") diagnostics.push(...diagnoseStyle(file.relative, file.content));
  }

  const manifest = byPath.get("manifest.json");
  if (manifest) diagnostics.push(...diagnoseManifest("manifest.json", manifest.content));

  // Stable order: file, line, id. The Problems panel renders this verbatim.
  return diagnostics.sort((left, right) => {
    if (left.file !== right.file) return left.file < right.file ? -1 : 1;
    const lineDelta = (left.line ?? 0) - (right.line ?? 0);
    if (lineDelta !== 0) return lineDelta;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
}

export function countBySeverity(diagnostics: Diagnostic[]): { errors: number; warnings: number } {
  let errors = 0;
  let warnings = 0;
  for (const diagnostic of diagnostics) {
    if (diagnostic.severity === "error") errors += 1;
    else warnings += 1;
  }
  return { errors, warnings };
}

/// Pages declared in `app.json`, used by the explorer and the simulator.
export function pagesOf(files: ProjectFile[]): string[] {
  const app = files.find((file) => normalizeRelative(file.relative) === "app.json");
  if (!app) return [];
  const parsed = readJson<AppJsonLike>(app.content);
  return Array.isArray(parsed.value?.pages) ? parsed.value!.pages!.map(String) : [];
}

export function tryParseJson(content: string): unknown | null {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    return null;
  }
}

export function formatJsonError(content: string): string | null {
  try {
    JSON.parse(content);
    return null;
  } catch (error) {
    return errorMessageOf(error);
  }
}

// ---------------------------------------------------------------------------
// Monaco schemas
// ---------------------------------------------------------------------------

const WINDOW_CONFIG_SCHEMA = {
  type: "object",
  additionalProperties: true,
  properties: {
    navigationBarTitleText: { type: "string" },
    navigationBarBackgroundColor: { type: "string" },
    navigationBarTextStyle: { enum: ["black", "white"] },
    navigationStyle: { enum: ["default", "custom"] },
    backgroundColor: { type: "string" },
    backgroundTextStyle: { enum: ["dark", "light"] },
    enablePullDownRefresh: { type: "boolean" },
    onReachBottomDistance: { type: "number" },
  },
} as const;

export const APP_JSON_SCHEMA = {
  $schema: "https://qchat.local/app.schema.json",
  type: "object",
  required: ["pages"],
  additionalProperties: true,
  properties: {
    pages: {
      type: "array",
      minItems: 1,
      uniqueItems: true,
      items: { type: "string", pattern: "^[^/].*$" },
      description: "Page routes without the file extension, e.g. pages/index/index.",
    },
    window: WINDOW_CONFIG_SCHEMA,
    tabBar: {
      type: "object",
      required: ["list"],
      additionalProperties: true,
      properties: {
        color: { type: "string" },
        selectedColor: { type: "string" },
        backgroundColor: { type: "string" },
        borderStyle: { enum: ["black", "white"] },
        custom: { type: "boolean" },
        list: {
          type: "array",
          minItems: 2,
          maxItems: 5,
          items: {
            type: "object",
            required: ["pagePath", "text"],
            additionalProperties: true,
            properties: {
              pagePath: { type: "string" },
              text: { type: "string" },
              iconPath: { type: "string" },
              selectedIconPath: { type: "string" },
            },
          },
        },
      },
    },
    usingComponents: {
      type: "object",
      additionalProperties: { type: "string" },
      description: "Global component map: tag name to component path.",
    },
    subpackages: { $ref: "#/definitions/subpackages" },
    subPackages: { $ref: "#/definitions/subpackages" },
    networkTimeout: {
      type: "object",
      additionalProperties: { type: "number" },
    },
    sitemapLocation: { type: "string" },
  },
  definitions: {
    subpackages: {
      type: "array",
      items: {
        type: "object",
        required: ["root", "pages"],
        additionalProperties: true,
        properties: {
          root: { type: "string" },
          pages: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

export const PAGE_JSON_SCHEMA = {
  $schema: "https://qchat.local/page.schema.json",
  type: "object",
  additionalProperties: true,
  properties: {
    ...WINDOW_CONFIG_SCHEMA.properties,
    usingComponents: { type: "object", additionalProperties: { type: "string" } },
    component: { const: false },
    disableScroll: { type: "boolean" },
  },
} as const;

export const COMPONENT_JSON_SCHEMA = {
  $schema: "https://qchat.local/component.schema.json",
  type: "object",
  required: ["component"],
  additionalProperties: true,
  properties: {
    component: { const: true },
    usingComponents: { type: "object", additionalProperties: { type: "string" } },
    styleIsolation: { enum: ["isolated", "apply-shared", "shared"] },
    options: { type: "object", additionalProperties: true },
  },
} as const;

export const MANIFEST_SCHEMA = {
  $schema: "https://qchat.local/manifest.schema.json",
  type: "object",
  required: ["name", "version"],
  additionalProperties: true,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 80 },
    description: { type: "string", maxLength: 500 },
    version: { type: "string", pattern: "^\\d+\\.\\d+\\.\\d+(-[0-9A-Za-z.-]+)?$" },
    requestedPermissions: {
      type: "array",
      uniqueItems: true,
      items: { enum: [...ALLOWED_PERMISSIONS] },
    },
    themeColor: { type: "string" },
    minRuntimeVersion: { type: "string" },
  },
} as const;

// ---------------------------------------------------------------------------
// Editor typings
// ---------------------------------------------------------------------------

/// Injected into Monaco's JavaScript defaults so `pages/*.js` gets completion
/// and diagnostics for the Mini Program globals. It is a subset that matches
/// the host runtime in `@mna/qchat/runtime/host.js`; unsupported APIs are not
/// declared, so the editor flags them instead of pretending they exist.
export const MINIPROGRAM_TYPES = `
type MiniProgramDataSet = Record<string, any>;

interface MiniProgramInstance<D extends MiniProgramDataSet = MiniProgramDataSet> {
  data: D;
  setData(patch: Partial<D> & Record<string, any>, callback?: () => void): void;
  triggerEvent(name: string, detail?: any, options?: { bubbles?: boolean; composed?: boolean; capturePhase?: boolean }): void;
  selectComponent(selector: string): any;
  selectAllComponents(selector: string): any[];
  createSelectorQuery(): any;
  route?: string;
}

interface MiniProgramPage<D extends MiniProgramDataSet = MiniProgramDataSet> extends MiniProgramInstance<D> {
  onLoad?(query: Record<string, string | undefined>): void;
  onShow?(): void;
  onReady?(): void;
  onHide?(): void;
  onUnload?(): void;
  onPullDownRefresh?(): void;
  onReachBottom?(): void;
  onShareAppMessage?(options?: { from?: "button" | "menu"; target?: any }): { title?: string; path?: string; imageUrl?: string };
}

interface MiniProgramComponent<D extends MiniProgramDataSet = MiniProgramDataSet> extends MiniProgramInstance<D> {
  properties: Record<string, any>;
  lifetimes?: Record<string, (...args: any[]) => any>;
  pageLifetimes?: Record<string, (...args: any[]) => any>;
}

declare function App<T extends Record<string, any>>(options: T & {
  globalData?: Record<string, any>;
  onLaunch?(options: { path: string; query: Record<string, string>; scene?: number }): void;
  onShow?(options: { path: string; query: Record<string, string> }): void;
  onHide?(): void;
}): void;
declare function getApp<T = { globalData: Record<string, any> }>(): T;

declare function Page<D extends MiniProgramDataSet>(options: MiniProgramPage<D> & ThisType<MiniProgramPage<D> & D> & Record<string, any>): void;

type MiniProgramProperty =
  | StringConstructor
  | NumberConstructor
  | BooleanConstructor
  | ArrayConstructor
  | ObjectConstructor
  | null
  | { type?: StringConstructor | NumberConstructor | BooleanConstructor | ArrayConstructor | ObjectConstructor | null; value?: any; observer?: string | ((value: any, old: any) => void) };

declare function Component<D extends MiniProgramDataSet = MiniProgramDataSet>(options: {
  properties?: Record<string, MiniProgramProperty>;
  data?: D;
  observers?: Record<string, (...values: any[]) => void>;
  methods?: Record<string, (...args: any[]) => any> & ThisType<MiniProgramComponent<D> & D>;
  behaviors?: any[];
  relations?: Record<string, any>;
  lifetimes?: Record<string, (...args: any[]) => any>;
  pageLifetimes?: Record<string, (...args: any[]) => any>;
  externalClasses?: string[];
  options?: Record<string, any>;
} & Record<string, any>): void;

declare function Behavior(options: Record<string, any>): any;

declare function getCurrentPages(): Array<MiniProgramPage & { route: string }>;

interface WxCallback<T> {
  success?(result: T): void;
  fail?(error: { errMsg: string; errno?: number; code?: string }): void;
  complete?(result?: T): void;
}

declare const wx: {
  canIUse(schema: string): boolean;
  getCapabilities(): { apis: Record<string, { supported: boolean; reason?: string }>; components: Record<string, { attributes: string[] }>; permissions: string[] };
  nextTick(callback: () => void): void;

  getSystemInfoSync(): Record<string, any>;
  getSystemInfo(options?: WxCallback<Record<string, any>>): void;
  getWindowInfo(): Record<string, any>;
  getDeviceInfo(): Record<string, any>;
  getAppBaseInfo(): Record<string, any>;
  getAppInfo(): Record<string, any>;
  getUserInfo(options?: WxCallback<{ userInfo: Record<string, any> }>): void;
  getUserProfile(options?: WxCallback<{ userInfo: Record<string, any> }>): void;

  showToast(options: { title: string; icon?: "success" | "error" | "loading" | "none"; duration?: number } & WxCallback<void>): void;
  hideToast(options?: WxCallback<void>): void;
  showLoading(options: { title: string; mask?: boolean } & WxCallback<void>): void;
  hideLoading(options?: WxCallback<void>): void;

  setNavigationBarTitle(options: { title: string } & WxCallback<void>): void;
  navigateTo(options: { url: string } & WxCallback<void>): void;
  redirectTo(options: { url: string } & WxCallback<void>): void;
  switchTab(options: { url: string } & WxCallback<void>): void;
  reLaunch(options: { url: string } & WxCallback<void>): void;
  navigateBack(options?: { delta?: number } & WxCallback<void>): void;

  setStorageSync(key: string, value: any): void;
  getStorageSync<T = any>(key: string): T;
  removeStorageSync(key: string): void;
  clearStorageSync(): void;
  setStorage(options: { key: string; data: any } & WxCallback<void>): void;
  getStorage(options: { key: string } & WxCallback<{ data: any }>): void;

  request(options: { url: string; method?: string; data?: any; header?: Record<string, string>; timeout?: number } & WxCallback<{ statusCode: number; data: any; header: Record<string, string> }>): void;

  showShareMenu(options?: { withShareTicket?: boolean; menus?: string[] } & WxCallback<void>): void;
  hideShareMenu(options?: WxCallback<void>): void;
  chooseImage(options?: { count?: number } & WxCallback<{ tempFilePaths: string[]; tempFiles: Array<{ path: string; size: number }> }>): void;
  chooseMedia(options?: { count?: number; mediaType?: string[] } & WxCallback<{ tempFiles: Array<{ tempFilePath: string; size: number; fileType: string }> }>): void;

  [api: string]: any;
};
`;

/// The WXML comment/unclosed check and the built-in list are exported for the
/// test suite; this keeps the editor and the docs from drifting apart.
export const MINIPROGRAM_REFERENCE = {
  builtins: BUILTIN_COMPONENTS,
  permissions: ALLOWED_PERMISSIONS,
} as const;
