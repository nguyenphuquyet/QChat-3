/**
 * Renderer interface contract (specification sections 4.2 and 5).
 *
 * The Service Runtime owns page data; the View Runtime owns the DOM. They only
 * exchange a render tree and typed operations. The tree is data, never HTML or
 * script: the renderer sets text and attributes through the DOM adapter, so a
 * value can never become markup.
 */

import type { ResolvedTheme } from "./theme.js";

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
  | { op: "insert"; path: number[]; index: number; node: RenderNode }
  | { op: "remove"; path: number[]; index: number };

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
  if (node.dataset !== undefined) {
    if (typeof node.dataset !== "object" || node.dataset === null || Array.isArray(node.dataset)) return false;
    for (const [name, entry] of Object.entries(node.dataset as Record<string, unknown>)) {
      if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(name) || typeof entry !== "string" || entry.length > 4096) return false;
    }
  }
  if (node.events !== undefined) {
    if (typeof node.events !== "object" || node.events === null || Array.isArray(node.events)) return false;
    for (const [type, binding] of Object.entries(node.events as Record<string, unknown>)) {
      if (!/^[a-z][a-zA-Z0-9:_-]{0,31}$/.test(type)) return false;
      if (typeof binding !== "object" || binding === null) return false;
      const entry = binding as Record<string, unknown>;
      if (typeof entry.handler !== "string" || entry.handler.length === 0 || entry.handler.length > 128) return false;
      if (entry.catch !== undefined && typeof entry.catch !== "boolean") return false;
    }
  }
  if (!Array.isArray(node.children)) return false;
  return node.children.every((child) => validateRenderNode(child, depth + 1));
}

/** Count nodes; used to bound a single render. */
export function countNodes(node: RenderNode): number {
  if (node.type === "text") return 1;
  return 1 + node.children.reduce((total, child) => total + countNodes(child), 0);
}
