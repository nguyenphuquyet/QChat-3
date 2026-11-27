import type { DomAdapter, DomEvent, ResolvedTheme } from "@qchat/miniapp-contracts";

export interface MemoryNode {
  tag: string;
  text: string | null;
  attrs: Map<string, string>;
  children: string[];
  parent: string | null;
  listeners: Map<string, Set<(event: DomEvent) => void>>;
}

export interface MemorySnapshot {
  tag: string;
  text?: string;
  attrs: Record<string, string>;
  children: MemorySnapshot[];
}

/**
 * An in-memory DOM adapter. It records exactly what the renderer does, so a
 * test can assert that an update changed a node instead of recreating it.
 * Android and iOS provide the same `DomAdapter` surface over the WebView.
 */
export class MemoryDomAdapter implements DomAdapter {
  readonly root = "root";
  readonly nodes = new Map<string, MemoryNode>();
  readonly createdTags: string[] = [];
  theme: ResolvedTheme | null = null;
  private next = 0;

  constructor() {
    this.nodes.set(this.root, {
      tag: "#root",
      text: null,
      attrs: new Map(),
      children: [],
      parent: null,
      listeners: new Map(),
    });
  }

  private create(tag: string, text: string | null): string {
    this.next += 1;
    const handle = `n${this.next}`;
    this.nodes.set(handle, { tag, text, attrs: new Map(), children: [], parent: null, listeners: new Map() });
    return handle;
  }

  createElement(tag: string): string {
    this.createdTags.push(tag);
    return this.create(tag, null);
  }

  createText(text: string): string {
    return this.create("#text", text);
  }

  setAttribute(handle: string, name: string, value: string): void {
    this.nodes.get(handle)?.attrs.set(name, value);
  }

  removeAttribute(handle: string, name: string): void {
    this.nodes.get(handle)?.attrs.delete(name);
  }

  setText(handle: string, text: string): void {
    const node = this.nodes.get(handle);
    if (node) node.text = text;
  }

  appendChild(parent: string, child: string): void {
    const parentNode = this.nodes.get(parent);
    const childNode = this.nodes.get(child);
    if (!parentNode || !childNode) throw new Error("appendChild: unknown handle");
    childNode.parent = parent;
    parentNode.children.push(child);
  }

  insertBefore(parent: string, child: string, index: number): void {
    const parentNode = this.nodes.get(parent);
    const childNode = this.nodes.get(child);
    if (!parentNode || !childNode) throw new Error("insertBefore: unknown handle");
    if (index < 0 || index > parentNode.children.length) throw new Error("insertBefore: index out of range");
    childNode.parent = parent;
    parentNode.children.splice(index, 0, child);
  }

  removeChild(parent: string, child: string): void {
    const parentNode = this.nodes.get(parent);
    const childNode = this.nodes.get(child);
    if (!parentNode || !childNode) throw new Error("removeChild: unknown handle");
    const index = parentNode.children.indexOf(child);
    if (index === -1) throw new Error("removeChild: not a child");
    parentNode.children.splice(index, 1);
    childNode.parent = null;
  }

  addEventListener(handle: string, type: string, handler: (event: DomEvent) => void): void {
    const node = this.nodes.get(handle);
    if (!node) throw new Error("addEventListener: unknown handle");
    let set = node.listeners.get(type);
    if (!set) {
      set = new Set();
      node.listeners.set(type, set);
    }
    set.add(handler);
  }

  removeEventListener(handle: string, type: string, handler: (event: DomEvent) => void): void {
    this.nodes.get(handle)?.listeners.get(type)?.delete(handler);
  }

  setRootTheme(theme: ResolvedTheme): void {
    this.theme = theme;
  }

  /** Simulate a DOM event on a handle. */
  dispatch(handle: string, type: string, detail: Record<string, unknown> = {}): void {
    const node = this.nodes.get(handle);
    if (!node) throw new Error("dispatch: unknown handle");
    for (const handler of [...(node.listeners.get(type) ?? [])]) {
      handler({ type, detail, dataset: {} });
    }
  }

  handleForTag(tag: string): string {
    for (const [handle, node] of this.nodes) {
      if (node.tag === tag) return handle;
    }
    throw new Error(`no node with tag ${tag}`);
  }

  snapshot(handle = this.root): MemorySnapshot {
    const node = this.nodes.get(handle);
    if (!node) throw new Error("snapshot: unknown handle");
    const snapshot: MemorySnapshot = {
      tag: node.tag,
      attrs: Object.fromEntries(node.attrs),
      children: node.children.map((child) => this.snapshot(child)),
    };
    if (node.text !== null) snapshot.text = node.text;
    return snapshot;
  }
}
