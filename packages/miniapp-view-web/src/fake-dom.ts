/**
 * A small DOM for Node tests: elements, text, attributes, style, bubbling
 * events and `stopPropagation`. It is not a browser; it is the minimum the
 * browser adapter and the View client use, so the same code path runs in a
 * test without a WebView.
 */

import { VIEW_ROOT_ID, type DomDocumentLike, type DomElementLike, type DomEventLike, type DomNodeLike, type DomStyleLike, type DomTextLike } from "./dom.js";

export class FakeStyle implements DomStyleLike {
  readonly properties = new Map<string, string>();

  setProperty(name: string, value: string): void {
    this.properties.set(name, value);
  }
}

export class FakeText implements DomTextLike {
  data: string;
  parent: FakeElement | null = null;

  constructor(data: string) {
    this.data = data;
  }
}

export type FakeNode = FakeElement | FakeText;

export interface FakeEventInit {
  clientX?: number;
  clientY?: number;
  detail?: unknown;
}

export class FakeEvent implements DomEventLike {
  readonly type: string;
  target: DomNodeLike | null = null;
  currentTarget: DomNodeLike | null = null;
  readonly clientX?: number;
  readonly clientY?: number;
  readonly detail?: unknown;
  propagationStopped = false;
  defaultPrevented = false;

  constructor(type: string, init: FakeEventInit = {}) {
    this.type = type;
    if (init.clientX !== undefined) this.clientX = init.clientX;
    if (init.clientY !== undefined) this.clientY = init.clientY;
    if (init.detail !== undefined) this.detail = init.detail;
  }

  stopPropagation(): void {
    this.propagationStopped = true;
  }

  preventDefault(): void {
    this.defaultPrevented = true;
  }
}

export class FakeElement implements DomElementLike {
  readonly tag: string;
  readonly attributes = new Map<string, string>();
  readonly children: FakeNode[] = [];
  readonly style = new FakeStyle();
  readonly listeners = new Map<string, Set<(event: DomEventLike) => void>>();
  parent: FakeElement | null = null;
  value: unknown = undefined;

  constructor(tag: string) {
    this.tag = tag;
  }

  get childNodes(): ArrayLike<DomNodeLike> {
    return this.children;
  }

  get textContent(): string {
    return this.children.map((child) => (child instanceof FakeText ? child.data : child.textContent)).join("");
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  appendChild(child: DomNodeLike): void {
    this.attach(child, this.children.length);
  }

  insertBefore(child: DomNodeLike, reference: DomNodeLike | null): void {
    if (reference === null) {
      this.attach(child, this.children.length);
      return;
    }
    const index = this.children.indexOf(reference as FakeNode);
    if (index === -1) throw new Error("insertBefore: the reference is not a child");
    this.attach(child, index);
  }

  removeChild(child: DomNodeLike): void {
    const index = this.children.indexOf(child as FakeNode);
    if (index === -1) throw new Error("removeChild: not a child");
    const [removed] = this.children.splice(index, 1);
    removed.parent = null;
  }

  addEventListener(type: string, listener: (event: DomEventLike) => void): void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
  }

  removeEventListener(type: string, listener: (event: DomEventLike) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  /** Dispatch a bubbling event from this element up to the document root. */
  dispatchEvent(event: FakeEvent): boolean {
    if (event.target === null) event.target = this;
    let node: FakeElement | null = this;
    while (node) {
      event.currentTarget = node;
      for (const listener of [...(node.listeners.get(event.type) ?? [])]) {
        listener(event);
        if (event.propagationStopped) break;
      }
      if (event.propagationStopped) break;
      node = node.parent;
    }
    event.currentTarget = null;
    return !event.defaultPrevented;
  }

  private attach(child: DomNodeLike, index: number): void {
    const node = child as FakeNode;
    if (!(node instanceof FakeElement) && !(node instanceof FakeText)) {
      throw new Error("appendChild: not a fake node");
    }
    if (node.parent) node.parent.removeChild(node);
    node.parent = this;
    this.children.splice(index, 0, node);
  }
}

export class FakeDocument implements DomDocumentLike {
  readonly documentElement = new FakeElement("html");
  private readonly byId = new Map<string, FakeElement>();

  createElement(tag: string): FakeElement {
    return new FakeElement(tag);
  }

  createTextNode(text: string): FakeText {
    return new FakeText(text);
  }

  getElementById(id: string): FakeElement | null {
    return this.byId.get(id) ?? null;
  }

  register(id: string, element: FakeElement): void {
    this.byId.set(id, element);
  }

  unregister(id: string): void {
    this.byId.delete(id);
  }
}

export interface FakePage {
  document: FakeDocument;
  root: FakeElement;
}

/** A document with the page root the host serves. */
export function createFakePage(): FakePage {
  const document = new FakeDocument();
  const root = document.createElement("div");
  root.setAttribute("id", VIEW_ROOT_ID);
  document.register(VIEW_ROOT_ID, root);
  document.documentElement.appendChild(root);
  return { document, root };
}
