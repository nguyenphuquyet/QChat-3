/**
 * WXML compiler.
 *
 * It turns a parsed WXML document into a template tree whose expressions are
 * parsed once, then renders that tree against page data. The renderer receives
 * a typed `RenderNode` tree — never markup, never a script — so a data value
 * can never become an element or an event handler.
 *
 * Supported in M3: `{{ }}`, `wx:if`/`wx:elif`/`wx:else`, `wx:for` with
 * `wx:for-item`/`wx:for-index`/`wx:key`, `block`, `template` with `is`/`data`,
 * `import`, `include`, `slot`, `bind*`/`catch*` events and `data-*` datasets.
 * Anything else is reported with a diagnostic; nothing is silently ignored.
 */

import {
  COMPONENT_REGISTRY,
  type ElementNode,
  type ErrorCode,
  type EventBinding,
  type RenderNode,
  type RenderPropValue,
  type TextNode,
} from "@qchat/miniapp-contracts";
import { diagnostic, type CompileResult, type Diagnostic, type SourceLocation } from "./diagnostics.js";
import {
  evaluateExpression,
  parseExpression,
  stringifyExpressionValue,
  type Expression,
} from "./expression.js";
import { resolvePackagePath } from "./paths.js";
import { parseWxml, type WxmlAttribute, type WxmlDocument, type WxmlElement, type WxmlNode } from "./wxml.js";

export interface CompileOptions {
  /** Custom components the build knows about (M7). Unknown tags are errors. */
  components?: readonly string[];
  /** Read a package file for `import`/`include`; return `null` when absent. */
  loadFile?: (path: string) => string | null;
}

export interface CompiledWxml {
  file: string;
  nodes: TemplateNode[];
  templates: ReadonlyMap<string, TemplateNode[]>;
  /** Files pulled in by `import`/`include`, for the package file list. */
  files: readonly string[];
}

export type TemplatePart =
  | { kind: "text"; text: string }
  | { kind: "expression"; expression: Expression; loc: SourceLocation };

export interface PropTemplate {
  name: string;
  /** `true` for a boolean attribute written without a value. */
  boolean: boolean;
  parts: TemplatePart[];
  loc: SourceLocation;
}

export interface EventTemplate {
  type: string;
  handler: string | { expression: Expression; loc: SourceLocation };
  catch: boolean;
  loc: SourceLocation;
}

export interface ElementTemplate {
  type: "element";
  tag: string;
  props: PropTemplate[];
  dataset: { name: string; parts: TemplatePart[]; loc: SourceLocation }[];
  events: EventTemplate[];
  children: TemplateNode[];
  loc: SourceLocation;
}

export interface TextTemplate {
  type: "text";
  parts: TemplatePart[];
  loc: SourceLocation;
}

export interface ConditionalTemplate {
  type: "conditional";
  branches: { test: Expression; children: TemplateNode[]; loc: SourceLocation }[];
  alternate: TemplateNode[];
  loc: SourceLocation;
}

export interface ForTemplate {
  type: "for";
  list: Expression;
  item: string;
  index: string;
  key: { kind: "this" } | { kind: "property"; path: string[] } | null;
  children: TemplateNode[];
  loc: SourceLocation;
}

export interface TemplateCall {
  type: "templateCall";
  name: string | Expression;
  data: Expression | null;
  loc: SourceLocation;
}

export type TemplateNode =
  | ElementTemplate
  | TextTemplate
  | ConditionalTemplate
  | ForTemplate
  | TemplateCall;

const COMPONENT_NAMES = new Set(COMPONENT_REGISTRY.map((component) => component.name));
const COMMON_PROPERTIES = new Set(["class", "style", "id", "hidden", "slot"]);
const DIRECTIVES = new Set([
  "wx:if", "wx:elif", "wx:else", "wx:for", "wx:for-item", "wx:for-index", "wx:key",
]);
const EVENT_PATTERN = /^(bind|catch|mut-bind)(?::?)([a-z][a-z0-9:_-]*)$/;

interface Context {
  file: string;
  options: CompileOptions;
  templates: Map<string, TemplateNode[]>;
  files: string[];
  diagnostics: Diagnostic[];
  includeDepth: number;
  importDepth: number;
}

function error(ctx: Context, code: ErrorCode, message: string, at: SourceLocation): void {
  ctx.diagnostics.push(diagnostic(code, message, at));
}

function offsetLocation(loc: SourceLocation, text: string, offset: number): SourceLocation {
  let line = loc.line;
  let column = loc.column;
  for (let index = 0; index < offset && index < text.length; index += 1) {
    if (text[index] === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { file: loc.file, line, column, offset: loc.offset + offset };
}

/** Split `a {{ b }} c` into text and expression parts. */
function parseParts(
  value: string,
  loc: SourceLocation,
  ctx: Context,
  code: ErrorCode = "WXML_INVALID_EXPRESSION",
): TemplatePart[] {
  const parts: TemplatePart[] = [];
  let cursor = 0;
  while (cursor < value.length) {
    const open = value.indexOf("{{", cursor);
    if (open === -1) {
      parts.push({ kind: "text", text: value.slice(cursor) });
      break;
    }
    if (open > cursor) parts.push({ kind: "text", text: value.slice(cursor, open) });
    const close = value.indexOf("}}", open + 2);
    if (close === -1) {
      error(ctx, code, "A mustache expression is not terminated.", offsetLocation(loc, value, open));
      return parts;
    }
    const source = value.slice(open + 2, close);
    const parsed = parseExpression(source);
    if (!parsed.ok) {
      error(
        ctx,
        code,
        `Invalid expression: ${parsed.error.message}`,
        offsetLocation(loc, value, open + 2 + parsed.error.offset),
      );
    } else {
      parts.push({
        kind: "expression",
        expression: parsed.expression,
        loc: offsetLocation(loc, value, open + 2),
      });
    }
    cursor = close + 2;
  }
  return parts;
}

/** One expression from a directive value, with or without `{{ }}`. */
function directiveExpression(value: string, loc: SourceLocation, ctx: Context, name: string): Expression | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    error(ctx, "WXML_INVALID_DIRECTIVE", `${name} needs an expression.`, loc);
    return null;
  }
  let source = trimmed;
  let offset = 0;
  if (trimmed.startsWith("{{") && trimmed.endsWith("}}")) {
    source = trimmed.slice(2, -2);
    offset = 2;
  }
  const parsed = parseExpression(source);
  if (!parsed.ok) {
    error(ctx, "WXML_INVALID_EXPRESSION", `Invalid expression in ${name}: ${parsed.error.message}`, offsetLocation(loc, value, offset + parsed.error.offset));
    return null;
  }
  return parsed.expression;
}

/**
 * Template `data` accepts either one object (`{{ item }}`) or WeChat's
 * brace-less object form (`{{ label: title }}`, `{{ ...item, extra: 1 }}`).
 */
function templateDataExpression(value: string, loc: SourceLocation, ctx: Context): Expression | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{{") || !trimmed.endsWith("}}")) {
    error(ctx, "WXML_INVALID_EXPRESSION", "Template data must be written as {{ ... }}.", loc);
    return null;
  }
  const inner = trimmed.slice(2, -2).trim();
  const direct = parseExpression(inner);
  if (direct.ok) return direct.expression;
  const wrapped = parseExpression(`{${inner}}`);
  if (wrapped.ok) return wrapped.expression;
  error(
    ctx,
    "WXML_INVALID_EXPRESSION",
    `Invalid template data: ${direct.error.message}`,
    offsetLocation(loc, value, 2 + direct.error.offset),
  );
  return null;
}

function attribute(element: WxmlElement, name: string): WxmlAttribute | undefined {
  return element.attributes.find((entry) => entry.name === name);
}

function dataSetName(name: string): string {
  return name
    .slice("data-".length)
    .toLowerCase()
    .replace(/-([a-z0-9])/g, (_, character: string) => character.toUpperCase());
}

function eventBinding(entry: WxmlAttribute, ctx: Context): EventTemplate | null {
  const match = EVENT_PATTERN.exec(entry.name);
  if (!match) return null;
  const prefix = match[1];
  const type = match[2];
  if (entry.value === null || entry.value.trim().length === 0) {
    error(ctx, "WXML_INVALID_EVENT", `Event "${entry.name}" needs a handler.`, entry.loc);
    return null;
  }
  const value = entry.value.trim();
  let handler: EventTemplate["handler"];
  if (value.startsWith("{{") && value.endsWith("}}")) {
    const parts = parseParts(value, entry.loc, ctx);
    const expressionPart = parts.find((part) => part.kind === "expression");
    if (!expressionPart || expressionPart.kind !== "expression") {
      error(ctx, "WXML_INVALID_EVENT", `Event "${entry.name}" needs a handler name.`, entry.loc);
      return null;
    }
    handler = { expression: expressionPart.expression, loc: expressionPart.loc };
  } else {
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value)) {
      error(ctx, "WXML_INVALID_EVENT", `"${value}" is not a valid handler name.`, entry.loc);
      return null;
    }
    handler = value;
  }
  return { type, handler, catch: prefix === "catch", loc: entry.loc };
}

function loadDocument(
  path: string,
  ctx: Context,
  loc: SourceLocation,
): WxmlDocument | null {
  if (!ctx.options.loadFile) {
    error(ctx, "WXML_INVALID_ATTRIBUTE", `Cannot load "${path}": the compiler has no file reader.`, loc);
    return null;
  }
  const source = ctx.options.loadFile(path);
  if (source === null) {
    error(ctx, "WXML_INVALID_ATTRIBUTE", `Cannot load "${path}": the file does not exist.`, loc);
    return null;
  }
  const parsed = parseWxml(source, path);
  if (!parsed.ok) {
    ctx.diagnostics.push(...parsed.diagnostics);
    return null;
  }
  ctx.files.push(path);
  return parsed.value;
}

function compileAttribute(
  entry: WxmlAttribute,
  element: WxmlElement,
  tag: string,
  ctx: Context,
): { prop?: PropTemplate; dataset?: ElementTemplate["dataset"][number]; event?: EventTemplate } | null {
  if (DIRECTIVES.has(entry.name)) return null;

  const event = eventBinding(entry, ctx);
  if (event) return { event };

  if (entry.name.startsWith("data-")) {
    if (entry.value === null) {
      return { dataset: { name: dataSetName(entry.name), parts: [], loc: entry.loc } };
    }
    return {
      dataset: {
        name: dataSetName(entry.name),
        parts: parseParts(entry.value, entry.loc, ctx),
        loc: entry.loc,
      },
    };
  }

  if (entry.name.startsWith("capture-")) {
    error(ctx, "COMPILER_UNSUPPORTED_DIRECTIVE", `Capture-phase event "${entry.name}" is not supported.`, entry.loc);
    return null;
  }

  if (entry.name.startsWith("wx:") || entry.name.startsWith("model:")) {
    error(ctx, "COMPILER_UNSUPPORTED_DIRECTIVE", `Directive "${entry.name}" is not supported here.`, entry.loc);
    return null;
  }

  if (!COMMON_PROPERTIES.has(entry.name) && !entry.name.startsWith("aria-")) {
    const component = COMPONENT_REGISTRY.find((candidate) => candidate.name === tag);
    const allowed = component
      ? new Set<string>([...component.properties, ...COMMON_PROPERTIES])
      : null;
    if (allowed && !allowed.has(entry.name)) {
      error(
        ctx,
        "WXML_INVALID_ATTRIBUTE",
        `"${entry.name}" is not a property of <${tag}>.`,
        entry.loc,
      );
      return null;
    }
  }

  if (entry.value === null) {
    return { prop: { name: entry.name, boolean: true, parts: [], loc: entry.loc } };
  }
  return {
    prop: {
      name: entry.name,
      boolean: false,
      parts: parseParts(entry.value, entry.loc, ctx),
      loc: entry.loc,
    },
  };
}

function compileElement(element: WxmlElement, ctx: Context): TemplateNode[] {
  const tag = element.tag;

  if (tag === "wxs") {
    error(ctx, "WXS_UNSUPPORTED", "<wxs> is not implemented by this runtime version.", element.loc);
    return [];
  }

  if (tag === "import") {
    const src = attribute(element, "src");
    if (!src || src.value === null) {
      error(ctx, "WXML_INVALID_ATTRIBUTE", "<import> needs a src.", element.loc);
      return [];
    }
    if (ctx.importDepth > 0) return [];
    const path = resolvePackagePath(ctx.file, src.value);
    if (!path) {
      error(ctx, "WXML_INVALID_ATTRIBUTE", `Unsafe import path "${src.value}".`, src.loc);
      return [];
    }
    const document = loadDocument(path, ctx, src.loc);
    if (!document) return [];
    // `import` brings in template definitions only; it is not recursive.
    const nested: Context = {
      ...ctx,
      file: path,
      templates: new Map(),
      importDepth: ctx.importDepth + 1,
      diagnostics: [],
      files: [],
    };
    for (const child of document.children) compileNode(child, nested);
    for (const [name, nodes] of nested.templates) ctx.templates.set(name, nodes);
    return [];
  }

  if (tag === "include") {
    const src = attribute(element, "src");
    if (!src || src.value === null) {
      error(ctx, "WXML_INVALID_ATTRIBUTE", "<include> needs a src.", element.loc);
      return [];
    }
    const path = resolvePackagePath(ctx.file, src.value);
    if (!path) {
      error(ctx, "WXML_INVALID_ATTRIBUTE", `Unsafe include path "${src.value}".`, src.loc);
      return [];
    }
    const document = loadDocument(path, ctx, src.loc);
    if (!document) return [];
    const nested: Context = { ...ctx, file: path, includeDepth: ctx.includeDepth + 1, diagnostics: ctx.diagnostics };
    const nodes: TemplateNode[] = [];
    for (const child of document.children) {
      if (child.type === "element" && (child.tag === "template" || child.tag === "import")) continue;
      nodes.push(...compileNode(child, nested));
    }
    return nodes;
  }

  if (tag === "template") {
    const name = attribute(element, "name");
    const is = attribute(element, "is");
    if (name && is) {
      error(ctx, "WXML_INVALID_ATTRIBUTE", "<template> cannot have both name and is.", element.loc);
      return [];
    }
    if (name) {
      if (name.value === null || name.value.trim().length === 0) {
        error(ctx, "WXML_INVALID_ATTRIBUTE", "<template name> needs a name.", name.loc);
        return [];
      }
      if (ctx.includeDepth > 0) return [];
      const children = compileChildren(element.children, ctx);
      ctx.templates.set(name.value.trim(), children);
      return [];
    }
    if (!is || is.value === null) {
      error(ctx, "WXML_INVALID_ATTRIBUTE", "<template> needs name or is.", element.loc);
      return [];
    }
    const value = is.value.trim();
    const nameExpression = value.startsWith("{{") && value.endsWith("}}")
      ? directiveExpression(value, is.loc, ctx, "template is")
      : value;
    if (nameExpression === null) return [];
    const dataAttribute = attribute(element, "data");
    const data = dataAttribute && dataAttribute.value !== null
      ? templateDataExpression(dataAttribute.value, dataAttribute.loc, ctx)
      : null;
    if (dataAttribute && data === null) return [];
    return [{ type: "templateCall", name: nameExpression, data, loc: element.loc }];
  }

  if (tag === "slot") {
    const props: PropTemplate[] = [];
    const name = attribute(element, "name");
    if (name && name.value !== null) {
      props.push({ name: "name", boolean: false, parts: parseParts(name.value, name.loc, ctx), loc: name.loc });
    }
    return [{
      type: "element",
      tag: "wx-slot",
      props,
      dataset: [],
      events: [],
      children: [],
      loc: element.loc,
    }];
  }

  if (tag === "block") {
    for (const entry of element.attributes) {
      if (!DIRECTIVES.has(entry.name)) {
        error(ctx, "WXML_INVALID_ATTRIBUTE", `<block> does not render; "${entry.name}" would be lost.`, entry.loc);
      }
    }
    return compileChildren(element.children, ctx);
  }

  const custom = ctx.options.components?.includes(tag) ?? false;
  if (!COMPONENT_NAMES.has(tag) && !custom) {
    error(ctx, "WXML_UNKNOWN_COMPONENT", `<${tag}> is not in the component registry.`, element.loc);
    return [];
  }

  const props: PropTemplate[] = [];
  const dataset: ElementTemplate["dataset"] = [];
  const events: EventTemplate[] = [];
  for (const entry of element.attributes) {
    const compiled = compileAttribute(entry, element, tag, ctx);
    if (!compiled) continue;
    if (compiled.prop) props.push(compiled.prop);
    if (compiled.dataset) dataset.push(compiled.dataset);
    if (compiled.event) events.push(compiled.event);
  }

  return [{
    type: "element",
    tag: `wx-${tag}`,
    props,
    dataset,
    events,
    children: compileChildren(element.children, ctx),
    loc: element.loc,
  }];
}

function compileNode(node: WxmlNode, ctx: Context): TemplateNode[] {
  if (node.type === "text") {
    const parts = parseParts(node.text, node.loc, ctx);
    const onlyText = parts.every((part) => part.kind === "text");
    if (onlyText && node.text.trim().length === 0 && node.text.includes("\n")) return [];
    return [{ type: "text", parts, loc: node.loc }];
  }

  const forAttribute = attribute(node, "wx:for");
  const forItem = attribute(node, "wx:for-item");
  const forIndex = attribute(node, "wx:for-index");
  const keyAttribute = attribute(node, "wx:key");

  if (forItem && !forAttribute) error(ctx, "WXML_INVALID_DIRECTIVE", "wx:for-item needs wx:for.", forItem.loc);
  if (forIndex && !forAttribute) error(ctx, "WXML_INVALID_DIRECTIVE", "wx:for-index needs wx:for.", forIndex.loc);
  if (keyAttribute && !forAttribute) error(ctx, "WXML_INVALID_DIRECTIVE", "wx:key needs wx:for.", keyAttribute.loc);

  let nodes: TemplateNode[] = compileElement(node, ctx);

  if (forAttribute) {
    if (forAttribute.value === null) {
      error(ctx, "WXML_INVALID_DIRECTIVE", "wx:for needs an expression.", forAttribute.loc);
      return nodes;
    }
    const list = directiveExpression(forAttribute.value, forAttribute.loc, ctx, "wx:for");
    if (!list) return nodes;
    let key: ForTemplate["key"] = null;
    if (keyAttribute && keyAttribute.value !== null) {
      const raw = keyAttribute.value.trim();
      if (raw === "*this") {
        key = { kind: "this" };
      } else if (/^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)*$/.test(raw)) {
        key = { kind: "property", path: raw.split(".") };
      } else {
        error(ctx, "WXML_INVALID_DIRECTIVE", `wx:key "${raw}" must be *this or a property path.`, keyAttribute.loc);
      }
    }
    nodes = [{
      type: "for",
      list,
      item: forItem?.value?.trim() || "item",
      index: forIndex?.value?.trim() || "index",
      key,
      children: nodes,
      loc: node.loc,
    }];
  }

  return nodes;
}

function compileChildren(nodes: readonly WxmlNode[], ctx: Context): TemplateNode[] {
  const compiled: TemplateNode[] = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (node.type === "element") {
      const ifAttribute = attribute(node, "wx:if");
      if (ifAttribute) {
        // Gather the sibling `wx:elif` chain and the optional `wx:else`.
        const branches: ConditionalTemplate["branches"] = [];
        const test = ifAttribute.value === null
          ? null
          : directiveExpression(ifAttribute.value, ifAttribute.loc, ctx, "wx:if");
        if (test) branches.push({ test, children: compileNode(node, ctx), loc: node.loc });
        let cursor = index + 1;
        let alternate: TemplateNode[] = [];
        while (cursor < nodes.length) {
          const sibling = nodes[cursor];
          // Formatting whitespace between the branches is allowed.
          if (sibling.type === "text" && sibling.text.trim().length === 0) {
            cursor += 1;
            continue;
          }
          if (sibling.type !== "element") break;
          const elif = attribute(sibling, "wx:elif");
          if (elif) {
            const branchTest = elif.value === null
              ? null
              : directiveExpression(elif.value, elif.loc, ctx, "wx:elif");
            if (branchTest) branches.push({ test: branchTest, children: compileNode(sibling, ctx), loc: sibling.loc });
            cursor += 1;
            continue;
          }
          const otherwise = attribute(sibling, "wx:else");
          if (otherwise) {
            alternate = compileNode(sibling, ctx);
            cursor += 1;
          }
          break;
        }
        compiled.push({ type: "conditional", branches, alternate, loc: node.loc });
        index = cursor - 1;
        continue;
      }

      const elif = attribute(node, "wx:elif");
      const otherwise = attribute(node, "wx:else");
      if (elif) {
        error(ctx, "WXML_INVALID_DIRECTIVE", "wx:elif must follow an element with wx:if.", elif.loc);
        index += 1;
        continue;
      }
      if (otherwise) {
        error(ctx, "WXML_INVALID_DIRECTIVE", "wx:else must follow an element with wx:if or wx:elif.", otherwise.loc);
        index += 1;
        continue;
      }
    }
    compiled.push(...compileNode(node, ctx));
  }
  return compiled;
}

export function compileWxml(source: string, file = "app.wxml", options: CompileOptions = {}): CompileResult<CompiledWxml> {
  const parsed = parseWxml(source, file);
  if (!parsed.ok) return parsed;

  const ctx: Context = {
    file,
    options,
    templates: new Map(),
    files: [],
    diagnostics: [],
    includeDepth: 0,
    importDepth: 0,
  };
  const nodes = compileChildren(parsed.value.children, ctx);
  if (ctx.diagnostics.length > 0) return { ok: false, diagnostics: ctx.diagnostics };
  return {
    ok: true,
    diagnostics: [],
    value: { file, nodes, templates: ctx.templates, files: ctx.files },
  };
}

interface RenderContext {
  templates: ReadonlyMap<string, TemplateNode[]>;
  diagnostics: Diagnostic[];
}

function evaluate(expression: Expression, scope: Record<string, unknown>, ctx: RenderContext, at: SourceLocation): unknown {
  try {
    return evaluateExpression(expression, scope);
  } catch (cause) {
    ctx.diagnostics.push(
      diagnostic("WXML_RENDER_WARNING", `Expression failed: ${String(cause)}`, at),
    );
    return undefined;
  }
}

function partValue(parts: readonly TemplatePart[], scope: Record<string, unknown>, ctx: RenderContext): unknown {
  if (parts.length === 1 && parts[0].kind === "expression") {
    return evaluate(parts[0].expression, scope, ctx, parts[0].loc);
  }
  let result = "";
  for (const part of parts) {
    result += part.kind === "text" ? part.text : stringifyExpressionValue(evaluate(part.expression, scope, ctx, part.loc));
  }
  return result;
}

function propValue(prop: PropTemplate, scope: Record<string, unknown>, ctx: RenderContext): RenderPropValue {
  if (prop.boolean) return true;
  if (prop.parts.length === 1 && prop.parts[0].kind === "expression") {
    const value = evaluate(prop.parts[0].expression, scope, ctx, prop.parts[0].loc);
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
    return stringifyExpressionValue(value);
  }
  return stringifyExpressionValue(partValue(prop.parts, scope, ctx));
}

function keyFor(template: ForTemplate, item: unknown, index: number): string {
  if (!template.key) return "";
  if (template.key.kind === "this") {
    if (typeof item === "string" || typeof item === "number") return String(item);
    return String(index);
  }
  // `wx:key="id"` names a property of the item, not of the page data.
  let cursor: unknown = item;
  for (const segment of template.key.path) {
    if (cursor === null || typeof cursor !== "object") return "";
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor === undefined || cursor === null ? "" : String(cursor);
}

function withKey(node: RenderNode, key: string): RenderNode {
  if (node.type !== "element" || key.length === 0) return node;
  return { ...node, key };
}

function renderNodes(nodes: readonly TemplateNode[], scope: Record<string, unknown>, ctx: RenderContext): RenderNode[] {
  const rendered: RenderNode[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case "text": {
        const text = stringifyExpressionValue(partValue(node.parts, scope, ctx));
        const output: TextNode = { type: "text", text };
        rendered.push(output);
        break;
      }
      case "element": {
        const props: Record<string, RenderPropValue> = {};
        for (const prop of node.props) props[prop.name] = propValue(prop, scope, ctx);
        const dataset: Record<string, string> = {};
        for (const entry of node.dataset) {
          dataset[entry.name] = stringifyExpressionValue(partValue(entry.parts, scope, ctx));
        }
        const events: Record<string, EventBinding> = {};
        for (const event of node.events) {
          let handler: string;
          if (typeof event.handler === "string") {
            handler = event.handler;
          } else {
            const value = evaluate(event.handler.expression, scope, ctx, event.handler.loc);
            if (typeof value !== "string" || value.length === 0) {
              ctx.diagnostics.push(
                diagnostic("WXML_RENDER_WARNING", `Event "${event.type}" resolved to no handler.`, event.loc),
              );
              continue;
            }
            handler = value;
          }
          events[event.type] = event.catch ? { handler, catch: true } : { handler };
        }
        const element: ElementNode = {
          type: "element",
          tag: node.tag,
          props,
          children: renderNodes(node.children, scope, ctx),
        };
        if (Object.keys(dataset).length > 0) element.dataset = dataset;
        if (Object.keys(events).length > 0) element.events = events;
        rendered.push(element);
        break;
      }
      case "conditional": {
        let matched = false;
        for (const branch of node.branches) {
          if (evaluate(branch.test, scope, ctx, branch.loc)) {
            rendered.push(...renderNodes(branch.children, scope, ctx));
            matched = true;
            break;
          }
        }
        if (!matched) rendered.push(...renderNodes(node.alternate, scope, ctx));
        break;
      }
      case "for": {
        const list = evaluate(node.list, scope, ctx, node.loc);
        if (!Array.isArray(list) && (typeof list !== "object" || list === null)) {
          if (list !== undefined && list !== null) {
            ctx.diagnostics.push(
              diagnostic("WXML_RENDER_WARNING", `wx:for needs an array or object, got ${typeof list}.`, node.loc),
            );
          }
          break;
        }
        const entries: [unknown, number][] = Array.isArray(list)
          ? list.map((item, index): [unknown, number] => [item, index])
          : Object.values(list as Record<string, unknown>).map((item, index): [unknown, number] => [item, index]);
        for (const [item, index] of entries) {
          const childScope: Record<string, unknown> = { ...scope, [node.item]: item, [node.index]: index };
          const key = keyFor(node, item, index);
          const children = renderNodes(node.children, childScope, ctx);
          if (key.length === 0) {
            rendered.push(...children);
          } else {
            rendered.push(...children.map((child, childIndex) => withKey(child, children.length === 1 ? key : `${key}:${childIndex}`)));
          }
        }
        break;
      }
      case "templateCall": {
        const name = typeof node.name === "string"
          ? node.name
          : evaluate(node.name, scope, ctx, node.loc);
        if (typeof name !== "string" || name.length === 0) {
          ctx.diagnostics.push(diagnostic("WXML_RENDER_WARNING", "A template call has no name.", node.loc));
          break;
        }
        const nodesForTemplate = ctx.templates.get(name);
        if (!nodesForTemplate) {
          ctx.diagnostics.push(diagnostic("WXML_INVALID_ATTRIBUTE", `Template "${name}" is not defined.`, node.loc));
          break;
        }
        let templateScope: Record<string, unknown> = {};
        if (node.data) {
          const value = evaluate(node.data, scope, ctx, node.loc);
          if (value !== null && typeof value === "object" && !Array.isArray(value)) {
            templateScope = value as Record<string, unknown>;
          } else if (value !== undefined) {
            ctx.diagnostics.push(diagnostic("WXML_RENDER_WARNING", "Template data must be an object.", node.loc));
          }
        }
        rendered.push(...renderNodes(nodesForTemplate, templateScope, ctx));
        break;
      }
    }
  }
  return rendered;
}

export function renderWxml(compiled: CompiledWxml, data: Record<string, unknown>): CompileResult<RenderNode> {
  const ctx: RenderContext = { templates: compiled.templates, diagnostics: [] };
  const nodes = renderNodes(compiled.nodes, data, ctx);
  const tree: RenderNode = nodes.length === 1 && nodes[0].type === "element"
    ? nodes[0]
    : {
      type: "element",
      tag: "wx-view",
      props: { class: "wx-page" },
      children: nodes,
    };
  if (ctx.diagnostics.some((entry) => entry.code !== "WXML_RENDER_WARNING")) {
    return { ok: false, diagnostics: ctx.diagnostics };
  }
  return { ok: true, value: tree, diagnostics: ctx.diagnostics };
}
