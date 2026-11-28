/**
 * QChat Mini App View Runtime — M1 spike.
 *
 * Scope of this spike: render a typed tree into a DOM adapter, reconcile it
 * without reloading the page, bind events back to the Service Runtime, and apply
 * the resolved theme to the page root only. WXML/WXSS compilation, the web
 * components and WXS are M3/M7 work; this module never parses HTML and never
 * executes data.
 */

import {
  VIEW_INPUT_EVENT,
  countNodes,
  validateRenderNode,
  type DomAdapter,
  type DomEvent,
  type ElementNode,
  type EventBinding,
  type RenderNode,
  type RenderOp,
  type ResolvedTheme,
  type TextNode,
  type ViewEvent,
  type ViewRenderer,
} from "@qchat/miniapp-contracts";

export * from "./components.js";
export * from "./memory-dom.js";
export * from "./session.js";

export interface ViewRendererOptions {
  /** Called for every bound event; the host forwards it to the service. */
  onEvent?: (event: ViewEvent) => void;
  now?: () => number;
  /** Guard against a runaway tree. */
  maxNodes?: number;
}

export interface SpikeViewRenderer extends ViewRenderer {
  currentTree(): RenderNode | null;
  theme(): ResolvedTheme | null;
}

interface Listener {
  binding: EventBinding;
  handle: (event: DomEvent) => void;
}

interface Mounted {
  node: RenderNode;
  handle: string;
  dataset: Record<string, string>;
  listeners: Map<string, Listener>;
  children: Mounted[];
}

const DEFAULT_MAX_NODES = 20_000;

function attributeValue(value: string | number | boolean): string | null {
  if (value === false) return null;
  return value === true ? "" : String(value);
}

function canReuse(previous: Mounted, next: RenderNode): boolean {
  if (previous.node.type !== next.type) return false;
  if (next.type === "text") return true;
  return (previous.node as ElementNode).tag === next.tag && (previous.node as ElementNode).key === next.key;
}

export function createViewRenderer(adapter: DomAdapter, options: ViewRendererOptions = {}): SpikeViewRenderer {
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES;
  const now = options.now ?? (() => Date.now());
  let mounted: Mounted[] = [];
  let tree: RenderNode | null = null;
  let currentTheme: ResolvedTheme | null = null;
  let destroyed = false;

  function emitEvent(binding: EventBinding, dataset: Record<string, string>, event: DomEvent): void {
    options.onEvent?.({
      handler: binding.handler,
      type: event.type,
      detail: event.detail ?? {},
      dataset,
      catch: binding.catch ?? false,
      timeStamp: now(),
    });
  }

  function create(node: RenderNode): Mounted {
    if (node.type === "text") {
      return {
        node,
        handle: adapter.createText(node.text),
        dataset: {},
        listeners: new Map(),
        children: [],
      };
    }
    const handle = adapter.createElement(node.tag);
    for (const [name, value] of Object.entries(node.props)) {
      const serialized = attributeValue(value);
      if (serialized !== null) adapter.setAttribute(handle, name, serialized);
    }
    const record: Mounted = {
      node,
      handle,
      dataset: { ...(node.dataset ?? {}) },
      listeners: new Map(),
      children: [],
    };
    for (const [type, binding] of Object.entries(node.events ?? {})) {
      const listener: Listener = {
        binding,
        handle: (event: DomEvent) => emitEvent(binding, record.dataset, event),
      };
      adapter.addEventListener(handle, type, listener.handle, { stopPropagation: binding.catch ?? false });
      record.listeners.set(type, listener);
    }
    record.children = node.children.map((child) => create(child));
    for (const child of record.children) adapter.appendChild(handle, child.handle);
    return record;
  }

  function update(record: Mounted, next: RenderNode): void {
    if (next.type === "text") {
      if ((record.node as TextNode).text !== next.text) adapter.setText(record.handle, next.text);
      record.node = next;
      return;
    }
    const previous = record.node as ElementNode;
    const element = next as ElementNode;

    for (const name of Object.keys(previous.props)) {
      if (!(name in element.props) || attributeValue(element.props[name]) === null) {
        adapter.removeAttribute(record.handle, name);
      }
    }
    for (const [name, value] of Object.entries(element.props)) {
      const serialized = attributeValue(value);
      if (serialized === null) {
        adapter.removeAttribute(record.handle, name);
      } else if (attributeValue(previous.props[name]) !== serialized) {
        adapter.setAttribute(record.handle, name, serialized);
      }
    }

    record.dataset = { ...(element.dataset ?? {}) };

    const nextEvents = element.events ?? {};
    for (const [type, listener] of record.listeners) {
      if (!(type in nextEvents)) {
        adapter.removeEventListener(record.handle, type, listener.handle);
        record.listeners.delete(type);
      }
    }
    for (const [type, binding] of Object.entries(nextEvents)) {
      const existing = record.listeners.get(type);
      if (existing && existing.binding.handler === binding.handler && (existing.binding.catch ?? false) === (binding.catch ?? false)) {
        existing.binding = binding;
        continue;
      }
      if (existing) adapter.removeEventListener(record.handle, type, existing.handle);
      const listener: Listener = {
        binding,
        handle: (event: DomEvent) => emitEvent(binding, record.dataset, event),
      };
      adapter.addEventListener(record.handle, type, listener.handle, { stopPropagation: binding.catch ?? false });
      record.listeners.set(type, listener);
    }

    reconcile(record, element.children);
    record.node = next;
  }

  function reconcile(parent: Mounted, nextChildren: RenderNode[]): void {
    const current = parent.children;
    for (let index = 0; index < nextChildren.length; index += 1) {
      const next = nextChildren[index];
      const previous = current[index];
      if (previous && canReuse(previous, next)) {
        update(previous, next);
        continue;
      }
      const created = create(next);
      if (previous) {
        destroyRecord(previous);
        adapter.removeChild(parent.handle, previous.handle);
        adapter.insertBefore(parent.handle, created.handle, index);
        current[index] = created;
      } else {
        adapter.insertBefore(parent.handle, created.handle, index);
        current.push(created);
      }
    }
    while (current.length > nextChildren.length) {
      const removed = current.pop();
      if (!removed) break;
      destroyRecord(removed);
      adapter.removeChild(parent.handle, removed.handle);
    }
  }

  function destroyRecord(record: Mounted): void {
    for (const [type, listener] of record.listeners) {
      adapter.removeEventListener(record.handle, type, listener.handle);
    }
    record.listeners.clear();
    for (const child of record.children) destroyRecord(child);
    record.children = [];
  }

  function render(next: RenderNode): void {
    if (destroyed) throw new Error("the view renderer is destroyed");
    if (!validateRenderNode(next)) throw new Error("invalid render tree");
    if (countNodes(next) > maxNodes) throw new Error(`render tree exceeds ${maxNodes} nodes`);
    // A single root node keeps paths stable. The host provides a page wrapper,
    // so a fragment root is wrapped rather than rendered as many siblings.
    if (mounted.length === 0) {
      const record = create(next);
      adapter.insertBefore(adapter.root, record.handle, 0);
      mounted = [record];
    } else if (canReuse(mounted[0], next)) {
      update(mounted[0], next);
    } else {
      destroyRecord(mounted[0]);
      adapter.removeChild(adapter.root, mounted[0].handle);
      const record = create(next);
      adapter.insertBefore(adapter.root, record.handle, 0);
      mounted = [record];
    }
    tree = next;
  }

  /** Replace the tree root with an updated copy, then let the diff do the work. */
  function patch(ops: readonly RenderOp[]): void {
    if (!tree) throw new Error("patch before render");
    if (ops.length === 1 && ops[0].op === "replace" && ops[0].path.length === 0) {
      render(ops[0].node);
      return;
    }
    // A recursive copy, not `structuredClone`: the minimum Android WebView
    // predates it, and the tree is JSON-shaped data by contract.
    const next = cloneRenderNode(tree);
    for (const operation of ops) {
      applyOp(next, operation);
    }
    render(next);
  }

  function applyOp(root: RenderNode, operation: RenderOp): void {
    if (operation.op === "insert" || operation.op === "remove") {
      const parent = operation.path.length === 0 ? root : nodeAt(root, operation.path);
      if (!parent || parent.type !== "element") throw new Error("insert/remove needs an element path");
      const children = parent.children;
      if (operation.op === "insert") {
        if (!Number.isInteger(operation.index) || operation.index < 0 || operation.index > children.length) {
          throw new Error("insert index is out of range");
        }
        children.splice(operation.index, 0, operation.node);
      } else {
        if (!Number.isInteger(operation.index) || operation.index < 0 || operation.index >= children.length) {
          throw new Error("remove index is out of range");
        }
        children.splice(operation.index, 1);
      }
      return;
    }
    if (operation.path.length === 0) throw new Error("the root cannot be replaced by an operation");
    const parentPath = operation.path.slice(0, -1);
    const index = operation.path[operation.path.length - 1];
    const parent = parentPath.length === 0 ? root : nodeAt(root, parentPath);
    if (!parent || parent.type !== "element") throw new Error("operation path does not resolve to an element");
    const children = parent.children;
    if (!Number.isInteger(index) || index < 0 || index >= children.length) throw new Error("operation index is out of range");
    if (operation.op === "replace") {
      children[index] = operation.node;
    } else if (operation.op === "setText") {
      const target = children[index];
      if (target.type !== "text") throw new Error("setText needs a text node");
      target.text = operation.text;
    } else if (operation.op === "setProp") {
      const target = children[index];
      if (target.type !== "element") throw new Error("setProp needs an element");
      target.props[operation.name] = operation.value;
    } else if (operation.op === "setDataset") {
      const target = children[index];
      if (target.type !== "element") throw new Error("setDataset needs an element");
      target.dataset = { ...operation.dataset };
    } else if (operation.op === "setEvents") {
      const target = children[index];
      if (target.type !== "element") throw new Error("setEvents needs an element");
      target.events = { ...operation.events };
    } else {
      const target = children[index];
      if (target.type !== "element") throw new Error("removeProp needs an element");
      delete target.props[operation.name];
    }
  }

  function nodeAt(root: RenderNode, path: readonly number[]): RenderNode | null {
    let node: RenderNode | undefined = root;
    for (const index of path) {
      if (!node || node.type !== "element") return null;
      node = node.children[index];
      if (!node) return null;
    }
    return node ?? null;
  }

  return {
    render,
    patch,
    setTheme(theme) {
      if (destroyed) throw new Error("the view renderer is destroyed");
      currentTheme = theme;
      adapter.setRootTheme(theme);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const record of mounted) {
        destroyRecord(record);
        adapter.removeChild(adapter.root, record.handle);
      }
      mounted = [];
      tree = null;
    },
    currentTree() {
      return tree;
    },
    theme() {
      return currentTheme;
    },
  };
}

function cloneRenderNode(node: RenderNode): RenderNode {
  if (node.type === "text") return { type: "text", text: node.text };
  const copy: ElementNode = {
    type: "element",
    tag: node.tag,
    props: { ...node.props },
    children: node.children.map(cloneRenderNode),
  };
  if (node.key !== undefined) copy.key = node.key;
  if (node.dataset) copy.dataset = { ...node.dataset };
  if (node.events) {
    copy.events = {};
    for (const [type, binding] of Object.entries(node.events)) {
      copy.events[type] = { handler: binding.handler, ...(binding.catch ? { catch: true } : {}) };
    }
  }
  return copy;
}

/** The bridge event name the view uses to send an event to the service. */
export const VIEW_EVENT_NAME = VIEW_INPUT_EVENT;

export type { ElementNode, RenderNode, ViewEvent };
