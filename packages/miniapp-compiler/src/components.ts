/**
 * Custom component resolution (specification section 7, M7).
 *
 * A page declares a component with `usingComponents` in `app.json` or its own
 * `.json`; the value is a package path without an extension. The component's
 * `.json` must set `"component": true`, and its `.wxml`, `.js` and `.json` must
 * exist. The resolver follows nested `usingComponents`, refuses a cycle and
 * compiles each component's WXML once.
 *
 * What this module does *not* do is execute the component's JavaScript. The
 * component instance (its `properties`, `data`, methods and lifetimes) lives in
 * the Service Runtime, which the host queries while it renders. Keeping the two
 * apart is what stops a build machine from running package code.
 */

import { COMPONENT_REGISTRY, isSafePackagePath } from "@qchat/miniapp-contracts";
import type { CompileResult, Diagnostic } from "./diagnostics.js";
import { resolvePackagePath } from "./paths.js";
import { parseWxml, type WxmlNode } from "./wxml.js";
import { compileWxml, type CompiledWxml } from "./wxml-compiler.js";
import { compileWxss, type CompiledWxss } from "./wxss.js";

export type ComponentStyleIsolation = "isolated" | "apply-shared" | "shared";

export interface CompiledComponent {
  /** Package path without an extension, e.g. `components/card/card`. */
  path: string;
  wxml: CompiledWxml;
  /** The component's own WXSS, scoped to its wrapper element. */
  css: CompiledWxss;
  styleIsolation: ComponentStyleIsolation;
}

export interface ComponentRegistry {
  /** Local tag name (`my-card`) to component path. */
  tags: Record<string, string>;
  /** Component path to its compiled template. */
  templates: Record<string, CompiledComponent>;
  /** Every file the resolver read, for the package file list. */
  files: string[];
}

export interface ComponentRegistryOptions {
  read: (path: string) => string | null;
  /** The page WXML file, used to resolve a relative component path. */
  pageFile: string;
  /** `app.json` `usingComponents`, available to every page and component. */
  appUsingComponents?: Readonly<Record<string, unknown>>;
  /** The page's own `usingComponents`. */
  pageUsingComponents?: Readonly<Record<string, unknown>>;
  /** Nested component depth; WeChat's practical limit is well below this. */
  maxDepth?: number;
}

const TAG_NAME = /^[a-z][a-z0-9-]{0,59}$/;
const STYLE_ISOLATION = new Set<ComponentStyleIsolation>(["isolated", "apply-shared", "shared"]);
const MAX_DEPTH = 8;
const BUILTIN_TAGS = new Set(COMPONENT_REGISTRY.map((component) => component.name));

function at(file: string, message: string, code: Diagnostic["code"] = "COMPILER_UNSUPPORTED_CONFIG"): Diagnostic {
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

/** `usingComponents` must be an object of `tag -> package path`. */
function readUsingComponents(
  value: unknown,
  file: string,
  diagnostics: Diagnostic[],
): Record<string, string> {
  if (value === undefined) return {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    diagnostics.push(at(file, "usingComponents must be an object."));
    return {};
  }
  const result: Record<string, string> = {};
  for (const [tag, request] of Object.entries(value as Record<string, unknown>)) {
    if (!TAG_NAME.test(tag) || BUILTIN_TAGS.has(tag)) {
      diagnostics.push(at(file, `"${tag}" is not a valid custom component tag name.`));
      continue;
    }
    if (typeof request !== "string" || request.length === 0 || request.length > 512) {
      diagnostics.push(at(file, `usingComponents["${tag}"] must be a package path.`));
      continue;
    }
    if (request.startsWith("plugin://")) {
      diagnostics.push(at(file, `Plugin component "${request}" is not supported.`));
      continue;
    }
    if (/\.(json|wxml|wxss|js)$/i.test(request)) {
      diagnostics.push(at(file, `usingComponents["${tag}"] must omit the file extension.`));
      continue;
    }
    result[tag] = request;
  }
  return result;
}

/** Resolve a `usingComponents` value against the referring file. */
export function resolveComponentPath(fromFile: string, request: string): string | null {
  if (request.startsWith("plugin://")) return null;
  const target = request.startsWith("/") ? request.slice(1) : request;
  if (target.length === 0 || target.startsWith("/")) return null;
  const path = request.startsWith("/")
    ? resolvePackagePath("app.json", target)
    : resolvePackagePath(fromFile, target);
  if (!path || !isSafePackagePath(path)) return null;
  return path;
}

function mergeUsingComponents(
  app: Readonly<Record<string, string>>,
  own: Readonly<Record<string, string>>,
): Record<string, string> {
  return { ...app, ...own };
}

/**
 * Every tag a WXML file uses, including files it imports or includes. Loading
 * a global component that the file never names would compile dead templates
 * and turn a harmless app-level registration into a false cycle.
 *
 * `null` means the file could not be parsed; the caller then loads every
 * declared component so the parser's own diagnostic is the one reported.
 */
function collectUsedTags(
  read: (path: string) => string | null,
  file: string,
  source: string,
  seen: Set<string> = new Set(),
): Set<string> | null {
  if (seen.has(file)) return new Set();
  seen.add(file);
  const parsed = parseWxml(source, file);
  if (!parsed.ok) return null;

  const tags = new Set<string>();
  const walk = (nodes: readonly WxmlNode[]): boolean => {
    for (const node of nodes) {
      if (node.type !== "element") continue;
      if (node.tag === "import" || node.tag === "include") {
        const src = node.attributes.find((entry) => entry.name === "src");
        if (src && src.value !== null) {
          const path = resolvePackagePath(file, src.value);
          const text = path === null ? null : read(path);
          if (path !== null && text !== null) {
            const nested = collectUsedTags(read, path, text, seen);
            if (nested === null) return false;
            for (const tag of nested) tags.add(tag);
          }
        }
        continue;
      }
      tags.add(node.tag);
      if (!walk(node.children)) return false;
    }
    return true;
  };
  return walk(parsed.value.children) ? tags : null;
}

export function loadComponentRegistry(options: ComponentRegistryOptions): CompileResult<ComponentRegistry> {
  const { read, pageFile } = options;
  const maxDepth = options.maxDepth ?? MAX_DEPTH;
  const diagnostics: Diagnostic[] = [];
  const files = new Set<string>();
  const cache = new Map<string, CompiledComponent | null>();
  const stack: string[] = [];

  const appUsing = readUsingComponents(options.appUsingComponents, "app.json", diagnostics);
  const pageUsing = readUsingComponents(options.pageUsingComponents, pageFile.replace(/\.wxml$/, ".json"), diagnostics);

  function load(path: string, depth: number): CompiledComponent | null {
    if (depth > maxDepth) {
      diagnostics.push(at(`${path}.json`, `Component nesting exceeds ${maxDepth} levels.`));
      return null;
    }
    if (stack.includes(path)) {
      diagnostics.push(at(`${path}.json`, `Component cycle: ${[...stack, path].join(" -> ")}.`));
      return null;
    }
    const cached = cache.get(path);
    if (cached !== undefined) return cached;

    const jsonText = read(`${path}.json`);
    if (jsonText === null) {
      diagnostics.push(at(`${path}.json`, "A component needs a .json file."));
      cache.set(path, null);
      return null;
    }
    files.add(`${path}.json`);
    const parsed = parseJsonObject(jsonText, `${path}.json`);
    if (!parsed.ok) {
      diagnostics.push(parsed.diagnostic);
      cache.set(path, null);
      return null;
    }
    const config = parsed.value;
    if (config.component !== true) {
      diagnostics.push(at(`${path}.json`, `"${path}" is not declared as a component ("component": true).`));
      cache.set(path, null);
      return null;
    }
    if (read(`${path}.js`) === null) {
      diagnostics.push(at(`${path}.js`, "A component needs a .js file."));
      cache.set(path, null);
      return null;
    }
    files.add(`${path}.js`);

    const wxmlText = read(`${path}.wxml`);
    if (wxmlText === null) {
      diagnostics.push(at(`${path}.wxml`, "A component needs a .wxml file."));
      cache.set(path, null);
      return null;
    }
    files.add(`${path}.wxml`);
    const used = collectUsedTags(read, `${path}.wxml`, wxmlText);

    let styleIsolation: ComponentStyleIsolation = "isolated";
    if (config.styleIsolation !== undefined) {
      if (typeof config.styleIsolation !== "string" || !STYLE_ISOLATION.has(config.styleIsolation as ComponentStyleIsolation)) {
        diagnostics.push(at(`${path}.json`, `styleIsolation must be isolated, apply-shared or shared.`));
      } else {
        styleIsolation = config.styleIsolation as ComponentStyleIsolation;
      }
    }

    const ownUsing = readUsingComponents(config.usingComponents, `${path}.json`, diagnostics);

    const wxssSource = read(`${path}.wxss`);
    let css: CompiledWxss = { file: `${path}.wxss`, css: "", files: [] };
    if (wxssSource !== null) {
      files.add(`${path}.wxss`);
      const compiledCss = compileWxss(wxssSource, `${path}.wxss`, {
        loadFile: read,
        scopeSelector: `[data-qchat-component="${path}"]`,
      });
      diagnostics.push(...compiledCss.diagnostics);
      if (!compiledCss.ok) {
        cache.set(path, null);
        return null;
      }
      css = compiledCss.value;
      for (const file of css.files) files.add(file);
    }

    const nestedUsing = mergeUsingComponents(appUsing, ownUsing);
    const tags: Record<string, string> = {};
    const templates: Record<string, CompiledComponent> = {};

    stack.push(path);
    try {
      for (const [tag, request] of Object.entries(nestedUsing)) {
        if (used !== null && !used.has(tag)) continue;
        const resolved = resolveComponentPath(`${path}.json`, request);
        if (!resolved) {
          diagnostics.push(at(`${path}.json`, `Unsafe component path "${request}" for <${tag}>.`));
          continue;
        }
        const component = load(resolved, depth + 1);
        if (component) {
          tags[tag] = resolved;
          templates[resolved] = component;
        }
      }
      const compiled = compileWxml(wxmlText, `${path}.wxml`, {
        loadFile: read,
        componentTags: tags,
        componentTemplates: templates,
        allowWxs: false,
      });
      diagnostics.push(...compiled.diagnostics);
      if (!compiled.ok) {
        cache.set(path, null);
        return null;
      }
      for (const file of compiled.value.files) files.add(file);
      const component: CompiledComponent = { path, wxml: compiled.value, css, styleIsolation };
      cache.set(path, component);
      return component;
    } finally {
      stack.pop();
    }
  }

  const tags: Record<string, string> = {};
  const pageSource = read(pageFile);
  const pageUsed = pageSource === null ? new Set<string>() : collectUsedTags(read, pageFile, pageSource);
  const merged = mergeUsingComponents(appUsing, pageUsing);
  for (const [tag, request] of Object.entries(merged)) {
    if (pageUsed !== null && !pageUsed.has(tag)) continue;
    const resolved = resolveComponentPath(pageFile, request);
    if (!resolved) {
      diagnostics.push(at(pageFile, `Unsafe component path "${request}" for <${tag}>.`));
      continue;
    }
    const component = load(resolved, 0);
    if (component) tags[tag] = resolved;
  }

  if (diagnostics.length > 0) return { ok: false, diagnostics };
  // The bundle is flat: a nested component is a top-level entry too, so the
  // host can revive every template once instead of walking component WXML.
  const templates: Record<string, CompiledComponent> = {};
  for (const [path, component] of cache) {
    if (component) templates[path] = component;
  }
  return {
    ok: true,
    diagnostics: [],
    value: { tags, templates, files: [...files].sort() },
  };
}
