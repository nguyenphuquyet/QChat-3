/**
 * Renderer interface contract (specification sections 4.2 and 5).
 *
 * The Service Runtime owns page data; the View Runtime owns the DOM. They only
 * exchange a render tree and typed operations. The tree is data, never HTML or
 * script: the renderer sets text and attributes through the DOM adapter, so a
 * value can never become markup.
 */

import { isResolvedTheme, type ResolvedTheme } from "./theme.js";

export const RENDERER_VERSION = 1 as const;

export type RenderPropValue = string | number | boolean;

export interface ElementNode {
  type: "element";
  /** Lower-case web component tag, e.g. `wx-view`. */
  tag: string;
  /** Stable identity for keyed diffing. */
  key?: string;
  props: Record<string, RenderPropValue>;
  /** Dataset values, exposed as `event.currentTarget.dataset`. */
  dataset?: Record<string, string>;
  /** Event bindings, keyed by WeChat event type (`tap`, `input`, ...). */
  events?: Record<string, EventBinding>;
  children: RenderNode[];
}

export interface EventBinding {
  /** Handler name from WXML, without `bind`/`catch`. */
  handler: string;
  /** `catch` stops propagation; `bind` lets it bubble. */
  catch?: boolean;
}

export interface TextNode {
  type: "text";
  text: string;
}

export type RenderNode = ElementNode | TextNode;

/** A typed tree update. `setData` produces these; the renderer applies them. */
export type RenderOp =
  | { op: "replace"; path: number[]; node: RenderNode }
  | { op: "setText"; path: number[]; text: string }
  | { op: "setProp"; path: number[]; name: string; value: RenderPropValue }
  | { op: "removeProp"; path: number[]; name: string }
  | { op: "setDataset"; path: number[]; dataset: Record<string, string> }
  | { op: "setEvents"; path: number[]; events: Record<string, EventBinding> }
  | { op: "insert"; path: number[]; index: number; node: RenderNode }
  | { op: "remove"; path: number[]; index: number };

/**
 * One page update. The first render of a visible page carries the whole tree;
 * every later `setData` carries only the operations that changed it.
 */
export type RenderUpdate =
  | { kind: "tree"; tree: RenderNode; theme: ResolvedTheme }
  | { kind: "ops"; ops: readonly RenderOp[]; theme: ResolvedTheme };

/**
 * The `view.render` payload. `seq` is monotonic per service runtime: a view
 * applies a payload only when its `seq` is greater than the last applied one.
 */
export interface RenderPayload {
  pageId: string;
  seq: number;
  update: RenderUpdate;
}

/**
 * Bridge event names used by the two runtimes. They are not `wx.*` APIs and are
 * therefore not in the API allowlist; the host routes them internally.
 */
export const VIEW_RENDER_EVENT = "view.render" as const;
export const VIEW_THEME_EVENT = "view.theme" as const;
export const VIEW_DESTROY_EVENT = "view.destroy" as const;
/** View Runtime to Service Runtime. */
export const VIEW_INPUT_EVENT = "view.event" as const;

/** An event the View Runtime sends back to the Service Runtime. */
export interface ViewEvent {
  /** Handler name declared in WXML, without `bind`/`catch`. */
  handler: string;
  /** WeChat event type, e.g. `tap`, `input`, `change`. */
  type: string;
  detail: Record<string, unknown>;
  dataset: Record<string, string>;
  /** `bind` bubbles, `catch` stops propagation. */
  catch: boolean;
  timeStamp: number;
}

/**
 * The renderer the host drives. `render` replaces the tree, `patch` applies
 * operations, `setTheme` writes only the page root values.
 */
export interface ViewRenderer {
  render(tree: RenderNode): void;
  patch(ops: readonly RenderOp[]): void;
  setTheme(theme: ResolvedTheme): void;
  destroy(): void;
}

/**
 * The DOM surface the renderer needs. Android and iOS provide the same shape
 * over their WebView; tests provide an in-memory implementation.
 */
export interface DomAdapter {
  /** Handle of the page root the renderer draws into. */
  readonly root: string;
  createElement(tag: string): string;
  createText(text: string): string;
  setAttribute(handle: string, name: string, value: string): void;
  removeAttribute(handle: string, name: string): void;
  setText(handle: string, text: string): void;
  appendChild(parent: string, child: string): void;
  insertBefore(parent: string, child: string, index: number): void;
  removeChild(parent: string, child: string): void;
  addEventListener(handle: string, type: string, handler: (event: DomEvent) => void): void;
  removeEventListener(handle: string, type: string, handler: (event: DomEvent) => void): void;
  setRootTheme(theme: ResolvedTheme): void;
}

export interface DomEvent {
  type: string;
  detail: Record<string, unknown>;
  dataset: Record<string, string>;
}

/** Validate an untrusted tree before rendering it. Depth is bounded. */
export function validateRenderNode(value: unknown, depth = 0): value is RenderNode {
  if (depth > 64) return false;
  if (typeof value !== "object" || value === null) return false;
  const node = value as Record<string, unknown>;
  if (node.type === "text") return typeof node.text === "string" && node.text.length <= 100_000;
  if (node.type !== "element") return false;
  // Only QChat's own web components are renderable. This keeps a data value
  // from ever naming `script`, `iframe`, `object` or another active tag.
  if (typeof node.tag !== "string" || !/^wx-[a-z][a-z0-9-]{0,61}$/.test(node.tag)) return false;
  if (typeof node.props !== "object" || node.props === null || Array.isArray(node.props)) return false;
  for (const [name, prop] of Object.entries(node.props as Record<string, unknown>)) {
    if (!/^[a-zA-Z][a-zA-Z0-9:_-]{0,63}$/.test(name)) return false;
    if (!["string", "number", "boolean"].includes(typeof prop)) return false;
    if (typeof prop === "string" && prop.length > 100_000) return false;
  }
  if (node.dataset !== undefined && !validateDataset(node.dataset)) return false;
  if (node.events !== undefined && !validateEvents(node.events)) return false;
  if (!Array.isArray(node.children)) return false;
  return node.children.every((child) => validateRenderNode(child, depth + 1));
}

const PROP_NAME = /^[a-zA-Z][a-zA-Z0-9:_-]{0,63}$/;
const EVENT_TYPE = /^[a-z][a-zA-Z0-9:_-]{0,31}$/;
const DATASET_NAME = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
const MAX_PATH_DEPTH = 64;

function isRenderPropValue(value: unknown): value is RenderPropValue {
  if (typeof value === "string") return value.length <= 100_000;
  if (typeof value === "number") return Number.isFinite(value);
  return typeof value === "boolean";
}

export function validateDataset(value: unknown): value is Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  for (const [name, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!DATASET_NAME.test(name) || typeof entry !== "string" || entry.length > 4096) return false;
  }
  return true;
}

export function validateEvents(value: unknown): value is Record<string, EventBinding> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  for (const [type, binding] of Object.entries(value as Record<string, unknown>)) {
    if (!EVENT_TYPE.test(type)) return false;
    if (typeof binding !== "object" || binding === null) return false;
    const entry = binding as Record<string, unknown>;
    if (typeof entry.handler !== "string" || entry.handler.length === 0 || entry.handler.length > 128) return false;
    if (entry.catch !== undefined && typeof entry.catch !== "boolean") return false;
  }
  return true;
}

function validatePath(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_PATH_DEPTH &&
    value.every((index) => typeof index === "number" && Number.isSafeInteger(index) && index >= 0 && index <= 1_000_000)
  );
}

/** Validate one operation received from the service runtime. */
export function validateRenderOp(value: unknown): value is RenderOp {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const op = value as Record<string, unknown>;
  if (!validatePath(op.path)) return false;
  switch (op.op) {
    case "replace":
      return validateRenderNode(op.node);
    case "setText":
      return typeof op.text === "string" && op.text.length <= 100_000;
    case "setProp":
      return typeof op.name === "string" && PROP_NAME.test(op.name) && isRenderPropValue(op.value);
    case "removeProp":
      return typeof op.name === "string" && PROP_NAME.test(op.name);
    case "setDataset":
      return validateDataset(op.dataset);
    case "setEvents":
      return validateEvents(op.events);
    case "insert":
      return (
        typeof op.index === "number" &&
        Number.isSafeInteger(op.index) &&
        op.index >= 0 &&
        validateRenderNode(op.node)
      );
    case "remove":
      return typeof op.index === "number" && Number.isSafeInteger(op.index) && op.index >= 0;
    default:
      return false;
  }
}

export function validateRenderOps(value: unknown): value is RenderOp[] {
  return Array.isArray(value) && value.length <= 10_000 && value.every((entry) => validateRenderOp(entry));
}

export function validateRenderPayload(value: unknown): value is RenderPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  if (typeof payload.pageId !== "string" || !/^p[0-9]{1,9}$/.test(payload.pageId)) return false;
  if (typeof payload.seq !== "number" || !Number.isSafeInteger(payload.seq) || payload.seq < 1) return false;
  const update = payload.update;
  if (typeof update !== "object" || update === null || Array.isArray(update)) return false;
  const entry = update as Record<string, unknown>;
  if (!isResolvedTheme(entry.theme)) return false;
  if (entry.kind === "tree") return validateRenderNode(entry.tree);
  if (entry.kind === "ops") return validateRenderOps(entry.ops);
  return false;
}

/** True when the renderer can update `previous` into `next` in place. */
export function canReuseRenderNode(previous: RenderNode, next: RenderNode): boolean {
  if (previous.type !== next.type) return false;
  if (next.type === "text") return true;
  return (previous as ElementNode).tag === (next as ElementNode).tag &&
    (previous as ElementNode).key === (next as ElementNode).key;
}

function sameStringRecord(
  previous: Record<string, string> | undefined,
  next: Record<string, string> | undefined,
): boolean {
  const before = previous ?? {};
  const after = next ?? {};
  const names = Object.keys(before);
  if (names.length !== Object.keys(after).length) return false;
  return names.every((name) => after[name] === before[name]);
}

function sameEventBindings(
  previous: Record<string, EventBinding> | undefined,
  next: Record<string, EventBinding> | undefined,
): boolean {
  const before = previous ?? {};
  const after = next ?? {};
  const types = Object.keys(before);
  if (types.length !== Object.keys(after).length) return false;
  return types.every((type) => {
    const first = before[type];
    const second = after[type];
    return (
      second !== undefined &&
      first.handler === second.handler &&
      (first.catch ?? false) === (second.catch ?? false)
    );
  });
}

/**
 * Compute the operations that turn `previous` into `next`.
 *
 * Ordering is defined and deterministic:
 * - a node update emits its property, dataset and event operations first, then
 *   its children, in ascending index order;
 * - a node that cannot be reused is replaced as a whole and its children are
 *   not visited;
 * - inserts run in ascending index order after the updates;
 * - removes run in descending index order, so every earlier index stays valid.
 *
 * The view applies a batch in exactly this order.
 */
export function diffRenderTree(previous: RenderNode, next: RenderNode): RenderOp[] {
  const ops: RenderOp[] = [];
  diffRenderNode(previous, next, [], ops);
  return ops;
}

function diffRenderNode(previous: RenderNode, next: RenderNode, path: number[], ops: RenderOp[]): void {
  if (!canReuseRenderNode(previous, next)) {
    ops.push({ op: "replace", path, node: next });
    return;
  }
  if (next.type === "text") {
    if ((previous as TextNode).text !== next.text) ops.push({ op: "setText", path, text: next.text });
    return;
  }
  const before = previous as ElementNode;
  for (const name of Object.keys(before.props)) {
    if (!(name in next.props) || next.props[name] === false) {
      if (before.props[name] !== false) ops.push({ op: "removeProp", path, name });
    }
  }
  for (const [name, value] of Object.entries(next.props)) {
    if (value === false) continue;
    if (before.props[name] !== value) ops.push({ op: "setProp", path, name, value });
  }
  if (!sameStringRecord(before.dataset, next.dataset)) {
    ops.push({ op: "setDataset", path, dataset: { ...(next.dataset ?? {}) } });
  }
  if (!sameEventBindings(before.events, next.events)) {
    ops.push({ op: "setEvents", path, events: { ...(next.events ?? {}) } });
  }
  const common = Math.min(before.children.length, next.children.length);
  for (let index = 0; index < common; index += 1) {
    diffRenderNode(before.children[index], next.children[index], [...path, index], ops);
  }
  for (let index = common; index < next.children.length; index += 1) {
    ops.push({ op: "insert", path, index, node: next.children[index] });
  }
  for (let index = before.children.length - 1; index >= next.children.length; index -= 1) {
    ops.push({ op: "remove", path, index });
  }
}

/** Count nodes; used to bound a single render. */
export function countNodes(node: RenderNode): number {
  if (node.type === "text") return 1;
  return 1 + node.children.reduce((total, child) => total + countNodes(child), 0);
}
