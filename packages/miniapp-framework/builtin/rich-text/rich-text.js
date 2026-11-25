import hidden from "../behaviors/hidden.js";
import { nativeElement } from "../shared/dom.js";

/// `rich-text`
///
/// WeChat's rich-text accepts an HTML string or a node array. The string is
/// parsed by the browser, then both paths are sanitised against a fixed
/// allowlist: unknown tags are dropped and event handlers, `javascript:` URLs
/// and CSS `url()`/`expression()` are removed. The result is written to a
/// native div inside the component shadow tree.
const ALLOWED_TAGS = new Set([
  "a", "abbr", "b", "blockquote", "br", "code", "col", "colgroup", "dd", "del",
  "div", "dl", "dt", "em", "fieldset", "h1", "h2", "h3", "h4", "h5", "h6", "hr",
  "i", "img", "ins", "label", "legend", "li", "ol", "p", "q", "span", "strong",
  "sub", "sup", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "ul",
]);

const ATTRIBUTES = {
  a: ["href", "target"],
  img: ["src", "alt", "width", "height"],
  table: ["width", "border", "cellpadding", "cellspacing"],
  td: ["colspan", "rowspan", "width", "align", "valign"],
  th: ["colspan", "rowspan", "width", "align", "valign"],
  tr: ["align", "valign"],
  col: ["span", "width"],
  colgroup: ["span", "width"],
  ol: ["start", "type"],
  li: ["value"],
};

export default Component({
  behaviors: [hidden],
  properties: {
    nodes: { type: null, value: [] },
    space: { type: String, value: "" },
    userSelect: { type: Boolean, value: false },
  },
  observers: {
    nodes() {
      this.__qchatRender();
    },
    space() {
      this.__qchatRender();
    },
  },
  lifetimes: {
    ready() {
      this.__qchatRender();
    },
  },
  methods: {
    __qchatRender() {
      const element = nativeElement(this, ".qchat-rich-text");
      if (!element || typeof element.ownerDocument === "undefined") return;
      const document = element.ownerDocument;
      const html = renderNodes(document, this.data.nodes);
      element.innerHTML = html;
      applySpace(element, this.data.space);
    },
  },
});

function renderNodes(document, nodes) {
  const container = document.createElement("div");
  if (typeof nodes === "string") {
    container.innerHTML = nodes;
    sanitize(container);
    return container.innerHTML;
  }
  appendNodes(document, container, nodes);
  sanitize(container);
  return container.innerHTML;
}

function appendNodes(document, parent, nodes) {
  if (!Array.isArray(nodes)) return;
  for (const node of nodes) {
    if (node == null) continue;
    if (typeof node === "string") {
      parent.appendChild(document.createTextNode(node));
      continue;
    }
    if (node.type === "text" || (node.text != null && !node.name)) {
      parent.appendChild(document.createTextNode(String(node.text == null ? "" : node.text)));
      continue;
    }
    const name = String(node.name || "").toLowerCase();
    if (!ALLOWED_TAGS.has(name)) continue;
    const element = document.createElement(name);
    const attributes = node.attrs && typeof node.attrs === "object" ? node.attrs : {};
    for (const [rawName, rawValue] of Object.entries(attributes)) {
      const attribute = rawName.toLowerCase();
      if (!allowedAttribute(name, attribute)) continue;
      const value = String(rawValue == null ? "" : rawValue);
      if ((attribute === "href" || attribute === "src") && !safeUrl(value)) continue;
      if (attribute === "style" && !safeStyle(value)) continue;
      element.setAttribute(attribute, value);
    }
    appendNodes(document, element, node.children);
    parent.appendChild(element);
  }
}

function sanitize(root) {
  const elements = Array.from(root.querySelectorAll("*"));
  for (const element of elements) {
    const tag = element.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      if (typeof element.remove === "function") element.remove();
      continue;
    }
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (!allowedAttribute(tag, name)) {
        element.removeAttribute(attribute.name);
        continue;
      }
      if ((name === "href" || name === "src") && !safeUrl(attribute.value)) {
        element.removeAttribute(attribute.name);
        continue;
      }
      if (name === "style" && !safeStyle(attribute.value)) {
        element.removeAttribute(attribute.name);
      }
    }
  }
}

function allowedAttribute(tag, name) {
  if (name === "class" || name === "style") return true;
  if (name.startsWith("on")) return false;
  const list = ATTRIBUTES[tag];
  return Array.isArray(list) && list.includes(name);
}

function safeUrl(value) {
  const text = String(value == null ? "" : value).trim();
  if (!text) return false;
  if (text.startsWith("#") || text.startsWith("/")) return true;
  if (/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(text)) return true;
  return /^(?:https?|mailto|tel):/i.test(text);
}

function safeStyle(value) {
  return !/url\s*\(|expression\s*\(|javascript:|@import|behavior\s*:|-moz-binding/i.test(
    String(value == null ? "" : value),
  );
}

function applySpace(element, space) {
  const value = String(space || "");
  if (value !== "nbsp" && value !== "ensp" && value !== "emsp") return;
  const character = value === "ensp" ? "\u2002" : value === "emsp" ? "\u2003" : "\u00a0";
  const document = element.ownerDocument;
  const walker = document.createTreeWalker(element, 4 /* NodeFilter.SHOW_TEXT */);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    node.nodeValue = String(node.nodeValue || "").replace(/ /g, character);
  }
}
