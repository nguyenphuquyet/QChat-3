/**
 * Browser DOM adapter for the View Runtime.
 *
 * The renderer contract is transport agnostic (`DomAdapter`), so the same
 * renderer, session and diff run on a phone WebView and in a Node test. This
 * adapter is the only file that touches the real DOM. It creates only the
 * `wx-*` tags the contract allows, writes text with `Text.data` (never
 * `innerHTML`), and maps WXML event names to DOM events.
 */

import { isRecord, type DomAdapter, type DomEvent, type ResolvedTheme } from "@qchat/miniapp-contracts";

export interface DomStyleLike {
  setProperty(name: string, value: string): void;
}

export interface DomNodeLike {}

export interface DomTextLike extends DomNodeLike {
  data: string;
}

export interface DomEventLike {
  readonly type: string;
  readonly target: DomNodeLike | null;
  readonly currentTarget: DomNodeLike | null;
  readonly clientX?: number;
  readonly clientY?: number;
  readonly detail?: unknown;
  stopPropagation(): void;
  preventDefault?(): void;
}

export interface DomElementLike extends DomNodeLike {
  readonly childNodes: ArrayLike<DomNodeLike>;
  readonly style?: DomStyleLike;
  readonly value?: unknown;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  appendChild(child: DomNodeLike): void;
  insertBefore(child: DomNodeLike, reference: DomNodeLike | null): void;
  removeChild(child: DomNodeLike): void;
  addEventListener(type: string, listener: (event: DomEventLike) => void): void;
  removeEventListener(type: string, listener: (event: DomEventLike) => void): void;
}

export interface DomDocumentLike {
  createElement(tag: string): DomElementLike;
  createTextNode(text: string): DomTextLike;
  readonly documentElement: DomElementLike;
  getElementById(id: string): DomElementLike | null;
}

/** The page root the host serves and the renderer draws into. */
export const VIEW_ROOT_ID = "qchat-root";

/** WXML event names that differ from their DOM event. */
const WXML_TO_DOM_EVENT: Readonly<Record<string, string>> = { tap: "click" };

const TAG = /^wx-[a-z][a-z0-9-]{0,61}$/;

/** Attributes whose value is a package-relative resource URL. */
const URL_ATTRIBUTES = new Set(["src", "poster"]);

/**
 * WXML `/assets/logo.png` means the package root. The page document lives under
 * `/qchat/<appId>/<version>/`, so a root-absolute URL would leave the installed
 * version and hit the origin root, which the host refuses. A relative URL keeps
 * the resource inside the versioned directory. Protocol-relative `//host` stays
 * untouched: it is a remote URL and the CSP refuses it.
 */
function packageUrl(name: string, value: string): string {
  if (URL_ATTRIBUTES.has(name) && value.startsWith("/") && !value.startsWith("//")) {
    return `.${value}`;
  }
  return value;
}

export interface BrowserDomAdapter extends DomAdapter {
  /** Release every handle and listener. Called after `destroy`. */
  dispose(): void;
}

interface Handle {
  node: DomNodeLike;
  kind: "element" | "text";
}

interface ListenerRecord {
  type: string;
  handler: (event: DomEvent) => void;
  wrapped: (event: DomEventLike) => void;
}

function safeDetail(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return {};
  try {
    const parsed: unknown = JSON.parse(JSON.stringify(value));
    return isRecord(parsed) ? parsed : {};
  } catch {
    // A DOM event detail can hold a node, a function or a cycle. Only JSON
    // data may cross the bridge, so anything else becomes an empty detail.
    return {};
  }
}

function toDomEvent(type: string, native: DomEventLike): DomEvent {
  const detail = safeDetail(native.detail);
  if ((type === "input" || type === "change") && detail.value === undefined) {
    const target = native.target as { value?: unknown } | null;
    if (target && typeof target.value === "string") detail.value = target.value;
  }
  if (type === "tap") {
    if (detail.x === undefined) detail.x = typeof native.clientX === "number" ? native.clientX : 0;
    if (detail.y === undefined) detail.y = typeof native.clientY === "number" ? native.clientY : 0;
  }
  return { type, detail, dataset: {} };
}

/**
 * Build the adapter over a real (or test) document. `root` is the element the
 * page tree is mounted in; the theme is written on `document.documentElement`,
 * which is what `:root[data-theme]` selects.
 */
export function createBrowserDomAdapter(document: DomDocumentLike, root: DomElementLike): BrowserDomAdapter {
  const handles = new Map<string, Handle>();
  const listeners = new Map<string, ListenerRecord[]>();
  let next = 0;

  handles.set("root", { node: root, kind: "element" });

  function handle(value: string): Handle {
    const entry = handles.get(value);
    if (!entry) throw new Error(`unknown DOM handle ${value}`);
    return entry;
  }

  function element(value: string): DomElementLike {
    const entry = handle(value);
    if (entry.kind !== "element") throw new Error("the handle is not an element");
    return entry.node as DomElementLike;
  }

  function text(value: string): DomTextLike {
    const entry = handle(value);
    if (entry.kind !== "text") throw new Error("the handle is not a text node");
    return entry.node as DomTextLike;
  }

  function add(node: DomNodeLike, kind: "element" | "text"): string {
    next += 1;
    const id = `d${next}`;
    handles.set(id, { node, kind });
    return id;
  }

  return {
    root: "root",

    createElement(tag: string): string {
      if (!TAG.test(tag)) throw new Error(`the tag ${JSON.stringify(tag)} is not a QChat web component`);
      return add(document.createElement(tag), "element");
    },

    createText(value: string): string {
      return add(document.createTextNode(value), "text");
    },

    setAttribute(value: string, name: string, attribute: string): void {
      element(value).setAttribute(name, packageUrl(name, attribute));
    },

    removeAttribute(value: string, name: string): void {
      element(value).removeAttribute(name);
    },

    setText(value: string, content: string): void {
      text(value).data = content;
    },

    appendChild(parent: string, child: string): void {
      element(parent).appendChild(handle(child).node);
    },

    insertBefore(parent: string, child: string, index: number): void {
      const parentElement = element(parent);
      const reference = parentElement.childNodes[index] ?? null;
      parentElement.insertBefore(handle(child).node, reference);
    },

    removeChild(parent: string, child: string): void {
      element(parent).removeChild(handle(child).node);
    },

    addEventListener(
      value: string,
      type: string,
      listener: (event: DomEvent) => void,
      options?: { stopPropagation?: boolean },
    ): void {
      const target = element(value);
      const domType = WXML_TO_DOM_EVENT[type] ?? type;
      const wrapped = (event: DomEventLike): void => {
        if (options?.stopPropagation) event.stopPropagation();
        listener(toDomEvent(type, event));
      };
      target.addEventListener(domType, wrapped);
      const records = listeners.get(value) ?? [];
      records.push({ type, handler: listener, wrapped });
      listeners.set(value, records);
    },

    removeEventListener(value: string, type: string, listener: (event: DomEvent) => void): void {
      const records = listeners.get(value);
      if (!records) return;
      const index = records.findIndex((record) => record.type === type && record.handler === listener);
      if (index === -1) return;
      const [record] = records.splice(index, 1);
      element(value).removeEventListener(WXML_TO_DOM_EVENT[type] ?? type, record.wrapped);
      if (records.length === 0) listeners.delete(value);
    },

    setRootTheme(theme: ResolvedTheme): void {
      const page = document.documentElement;
      page.setAttribute("data-theme", theme);
      if (!page.style) throw new Error("the page root has no style");
      page.style.setProperty("color-scheme", theme);
    },

    dispose(): void {
      for (const [value, records] of listeners) {
        const entry = handles.get(value);
        if (!entry || entry.kind !== "element") continue;
        const target = entry.node as DomElementLike;
        for (const record of records) {
          target.removeEventListener(WXML_TO_DOM_EVENT[record.type] ?? record.type, record.wrapped);
        }
      }
      listeners.clear();
      handles.clear();
    },
  };
}
