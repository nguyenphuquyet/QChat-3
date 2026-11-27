/**
 * A minimal DOM for executing the real `COMPONENTS_SOURCE` in Node.
 *
 * It is deliberately small: only the APIs the web components use are
 * implemented, so a component that reaches for something else fails loudly
 * instead of silently working here and breaking in the WebView.
 */

export interface ShimEventInit {
  detail?: unknown;
  bubbles?: boolean;
  composed?: boolean;
  [key: string]: unknown;
}

export class ShimEvent {
  type: string;
  detail: unknown;
  bubbles: boolean;
  composed: boolean;
  defaultPrevented = false;
  propagationStopped = false;
  target: ShimElement | null = null;

  constructor(type: string, init: ShimEventInit = {}) {
    this.type = type;
    this.detail = init.detail ?? {};
    this.bubbles = init.bubbles ?? false;
    this.composed = init.composed ?? false;
    Object.assign(this, init);
  }

  preventDefault(): void {
    this.defaultPrevented = true;
  }

  stopPropagation(): void {
    this.propagationStopped = true;
  }
}

type Listener = (event: ShimEvent) => void;

let activeDocument: ShimDocument | null = null;

export class ShimElement {
  tagName: string;
  attrs = new Map<string, string>();
  childNodes: ShimElement[] = [];
  parentNode: ShimElement | null = null;
  shadowRoot: ShimElement | null = null;
  listeners = new Map<string, Set<Listener>>();
  dispatched: ShimEvent[] = [];
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  hidden = false;
  nodeValue: string | null = null;
  value = "";
  selectionStart = 0;
  placeholder = "";
  type = "text";
  disabled = false;
  maxLength = 140;
  loading = "eager";
  naturalWidth = 0;
  naturalHeight = 0;
  scrollTop = 0;
  scrollLeft = 0;
  scrollHeight = 0;
  scrollWidth = 0;
  clientHeight = 0;
  private text = "";

  constructor(tagName = "unknown") {
    this.tagName = tagName;
  }

  get children(): ShimElement[] {
    return this.childNodes.filter((node) => !node.tagName.startsWith("#"));
  }

  get classList() {
    const read = (): string[] => (this.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
    return {
      add: (name: string): void => {
        const values = new Set(read());
        values.add(name);
        this.setAttribute("class", [...values].join(" "));
      },
      remove: (name: string): void => {
        const values = new Set(read());
        values.delete(name);
        if (values.size === 0) this.removeAttribute("class");
        else this.setAttribute("class", [...values].join(" "));
      },
      contains: (name: string): boolean => read().includes(name),
    };
  }

  get textContent(): string {
    if (this.text.length > 0) return this.text;
    return this.childNodes.map((node) => node.nodeValue ?? "").join("");
  }

  set textContent(value: string) {
    this.text = value;
    this.childNodes = [];
  }

  get innerHTML(): string {
    return this.childNodes.map((node) => (node.nodeValue === null ? `<${node.tagName}>` : node.nodeValue)).join("");
  }

  set innerHTML(html: string) {
    this.childNodes = [];
    this.text = "";
    parseInto(this, html);
  }

  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }

  hasAttribute(name: string): boolean {
    return this.attrs.has(name);
  }

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, String(value));
    if (name === "hidden") this.hidden = true;
  }

  removeAttribute(name: string): void {
    this.attrs.delete(name);
    if (name === "hidden") this.hidden = false;
  }

  attachShadow(_init: { mode: "open" | "closed" }): ShimElement {
    const root = new ShimElement("#shadow-root");
    root.parentNode = this;
    this.shadowRoot = root;
    return root;
  }

  appendChild(child: ShimElement): ShimElement {
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  addEventListener(type: string, listener: Listener): void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: ShimEvent): boolean {
    event.target = this;
    this.dispatched.push(event);
    for (const listener of [...(this.listeners.get(event.type) ?? [])]) listener(event);
    return !event.defaultPrevented;
  }

  focus(): void {
    if (activeDocument) activeDocument.activeElement = this;
  }

  querySelector(selector: string): ShimElement | null {
    for (const node of this.childNodes) {
      if (node.tagName.startsWith("#")) continue;
      if (matches(node, selector)) return node;
      const nested = node.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  }

  querySelectorAll(selector: string): ShimElement[] {
    const found: ShimElement[] = [];
    for (const node of this.childNodes) {
      if (node.tagName.startsWith("#")) continue;
      if (matches(node, selector)) found.push(node);
      found.push(...node.querySelectorAll(selector));
    }
    return found;
  }
}

function matches(node: ShimElement, selector: string): boolean {
  if (selector.startsWith(".")) return node.classList.contains(selector.slice(1));
  if (selector.startsWith("#")) return node.getAttribute("id") === selector.slice(1);
  return node.tagName === selector;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&nbsp;/g, "\u00a0")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

const ATTRIBUTE = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

function parseInto(root: ShimElement, html: string): void {
  const stack: ShimElement[] = [root];
  let index = 0;
  const pushText = (text: string): void => {
    if (text.length === 0) return;
    const node = new ShimElement("#text");
    node.nodeValue = decodeEntities(text);
    node.parentNode = stack[stack.length - 1];
    stack[stack.length - 1].childNodes.push(node);
  };
  while (index < html.length) {
    const lt = html.indexOf("<", index);
    if (lt === -1) {
      pushText(html.slice(index));
      return;
    }
    pushText(html.slice(index, lt));
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      index = end === -1 ? html.length : end + 3;
      continue;
    }
    const gt = html.indexOf(">", lt);
    if (gt === -1) {
      pushText(html.slice(lt));
      return;
    }
    const inner = html.slice(lt + 1, gt);
    index = gt + 1;
    if (inner.startsWith("/")) {
      const name = inner.slice(1).trim();
      for (let depth = stack.length - 1; depth > 0; depth -= 1) {
        if (stack[depth].tagName === name) {
          stack.length = depth;
          break;
        }
      }
      continue;
    }
    const selfClosing = inner.endsWith("/");
    const body = selfClosing ? inner.slice(0, -1) : inner;
    const space = body.search(/\s/);
    const tag = (space === -1 ? body : body.slice(0, space)).trim();
    const node = new ShimElement(tag);
    node.parentNode = stack[stack.length - 1];
    stack[stack.length - 1].childNodes.push(node);
    if (space !== -1) {
      for (const match of body.slice(space).matchAll(ATTRIBUTE)) {
        node.setAttribute(match[1], decodeEntities(match[2] ?? match[3] ?? match[4] ?? ""));
      }
    }
    if (!selfClosing) stack.push(node);
  }
}

export interface ShimDocument {
  activeElement: ShimElement | null;
  createElement(tag: string): ShimElement;
  createTreeWalker(root: ShimElement, whatToShow: number): { nextNode(): ShimElement | null };
}

type CustomElementConstructor = new () => ShimElement;

export interface DomShim {
  context: Record<string, unknown>;
  window: { customElements: { define(tag: string, ctor: CustomElementConstructor): void; get(tag: string): CustomElementConstructor | undefined } };
  customElements: DomShim["window"]["customElements"];
  document: ShimDocument;
  element(tag: string, attrs?: Record<string, string>): ShimElement;
  text(value: string): ShimElement;
  runTimers(): void;
}

export function createDomShim(): DomShim {
  const registry = new Map<string, CustomElementConstructor>();
  const customElements = {
    define(tag: string, ctor: CustomElementConstructor): void {
      if (registry.has(tag)) throw new Error(`${tag} is already defined`);
      registry.set(tag, ctor);
    },
    get(tag: string): CustomElementConstructor | undefined {
      return registry.get(tag);
    },
  };

  const document: ShimDocument = {
    activeElement: null,
    createElement: (tag) => new ShimElement(tag),
    createTreeWalker(root, whatToShow) {
      const nodes: ShimElement[] = [];
      const visit = (node: ShimElement): void => {
        for (const child of node.childNodes) {
          if (child.tagName === "#text") {
            if ((whatToShow & 4) !== 0) nodes.push(child);
            continue;
          }
          if ((whatToShow & 1) !== 0) nodes.push(child);
          visit(child);
        }
      };
      visit(root);
      let cursor = 0;
      return { nextNode: () => nodes[cursor++] ?? null };
    },
  };
  activeDocument = document;

  const timers = new Map<number, () => void>();
  let nextTimer = 1;
  const setTimeout = (callback: () => void, _delay?: number): number => {
    const id = nextTimer;
    nextTimer += 1;
    timers.set(id, callback);
    return id;
  };
  const clearTimeout = (id: number): void => {
    timers.delete(id);
  };

  const window = { customElements };

  const context: Record<string, unknown> = {
    window,
    customElements,
    document,
    HTMLElement: ShimElement,
    CustomEvent: ShimEvent,
    NodeFilter: { SHOW_ELEMENT: 1, SHOW_TEXT: 4 },
    MutationObserver: class {
      observe(): void {}
      disconnect(): void {}
    },
    requestAnimationFrame: (callback: () => void): void => callback(),
    setTimeout,
    clearTimeout,
  };

  return {
    context,
    window,
    customElements,
    document,
    element(tag, attrs = {}) {
      const element = new ShimElement(tag);
      for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value);
      return element;
    },
    text(value) {
      const node = new ShimElement("#text");
      node.nodeValue = value;
      return node;
    },
    runTimers() {
      const pending = [...timers.values()];
      timers.clear();
      for (const callback of pending) callback();
    },
  };
}
