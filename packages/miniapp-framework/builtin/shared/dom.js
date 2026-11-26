/// Shared DOM helpers for QChat's built-in components.
///
/// A built-in is a glass-easel custom component, so its template owns a shadow
/// tree. Native elements inside that tree (`<input>`, `<img>`, `<div>`) are not
/// Mini Program components and their DOM events do not carry a Mini Program
/// `detail`, so the built-ins read them through the backend element directly and
/// re-emit a WeChat-shaped event with `triggerEvent`.
import { StyleSegmentIndex } from "glass-easel";

/// Finds a node in the component's shadow tree by CSS selector.
///
/// The virtual selector only understands `#id` and `.class`, and a class in the
/// rendered tree is style-scope prefixed (`F--qchat-input`). When the virtual
/// lookup misses, fall back to the real DOM under the component host and match
/// the class token with or without that prefix.
export function shadowQuery(component, selector) {
  const element = component && component._$;
  if (!element || typeof element.getShadowRoot !== "function") return null;
  const root = element.getShadowRoot();
  if (root && typeof root.querySelector === "function") {
    const direct = root.querySelector(selector);
    if (direct) return direct;
  }
  const host = hostElement(component);
  if (!host || typeof host.querySelector !== "function") return null;
  const className = classSelectorName(selector);
  if (className) return findClassInDom(host, className);
  try {
    return host.querySelector(selector);
  } catch {
    return null;
  }
}

/// The native DOM element behind a node in the component's shadow tree.
export function nativeElement(component, selector) {
  const node = shadowQuery(component, selector);
  if (!node) return null;
  if (typeof node.getBackendElement === "function") return node.getBackendElement();
  // The fallback already returns a real DOM element.
  return node;
}

/// The component's own host DOM element (the `<wx-view>` style element).
export function hostElement(component) {
  const element = component && component._$;
  if (!element || typeof element.getBackendElement !== "function") return null;
  return element.getBackendElement();
}

/// Adds DOM listeners to a node in the shadow tree and returns a cleanup
/// function. `entries` is a list of `[type, handler, options?]`.
export function bindNative(component, selector, entries) {
  const element = nativeElement(component, selector);
  if (!element || typeof element.addEventListener !== "function") return () => {};
  const cleanups = [];
  for (const entry of entries) {
    const [type, handler, options] = entry;
    element.addEventListener(type, handler, options);
    cleanups.push(() => element.removeEventListener(type, handler, options));
  }
  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}

/// Adds capture listeners to the component host. Native form events are not
/// delegated by glass-easel, so the host capture listener sees them first and
/// can stop the raw DOM event from bubbling out as a second, detail-less Mini
/// Program event. Listening on the host (instead of the native node) also
/// survives a template re-render that replaces the node.
export function bindHost(component, entries) {
  const host = hostElement(component);
  if (!host || typeof host.addEventListener !== "function") return () => {};
  const cleanups = [];
  for (const entry of entries) {
    const [type, handler, extra] = entry;
    const options = { capture: true, ...(extra || {}) };
    host.addEventListener(type, handler, options);
    cleanups.push(() => host.removeEventListener(type, handler, options));
  }
  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}
/// Reads `value` from a native form element without relying on DOM event
/// `detail`, which glass-easel only fills from own enumerable event fields.
export function inputValue(element) {
  return element && typeof element.value === "string" ? element.value : "";
}

/// Applies an inline style to the component's host node. The host is the
/// element the author styled, so this must not replace author styles: it writes
/// the temporary segment the official `view` component also uses.
export function setHostExtraStyle(component, style) {
  const element = component && component._$;
  if (!element) return;
  element.setNodeStyle(style, StyleSegmentIndex.TEMP_EXTRA);
}

export function setHostClass(component, name, force) {
  const element = component && component._$;
  if (!element || !name || name === "none") return;
  element.toggleNodeClass(name, force);
}

/// Reflects state onto the component host as classes, in a class segment that
/// does not fight the author's own `class` attribute. The classes are global by
/// design: `base.wxss` styles them with host-tag selectors.
export function reflectHostClasses(component, classes) {
  const element = component && component._$;
  if (!element || typeof element.toggleNodeClass !== "function") return;
  for (const [name, active] of Object.entries(classes)) {
    element.toggleNodeClass(name, Boolean(active), 3);
  }
}

/// Runs `callback` after `ms` milliseconds, returning a cancel function.
export function later(callback, ms) {
  const timer = setTimeout(callback, Math.max(0, Number(ms) || 0));
  return () => clearTimeout(timer);
}

function classSelectorName(selector) {
  if (!selector || selector[0] !== ".") return null;
  const name = selector.slice(1);
  return /^[A-Za-z0-9_-]+$/.test(name) ? name : null;
}

function findClassInDom(host, name) {
  const suffix = "--" + name;
  const nodes = host.querySelectorAll("[class]");
  for (const node of nodes) {
    const tokens = String(node.getAttribute("class") || "").split(/\s+/);
    for (const token of tokens) {
      if (token === name || token === suffix || token.endsWith(suffix)) return node;
    }
  }
  return null;
}
