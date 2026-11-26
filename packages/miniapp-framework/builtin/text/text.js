import hidden from "../behaviors/hidden.js";
import hover from "../behaviors/hover.js";
import { hostElement } from "../shared/dom.js";

/// `text`
///
/// `space` and `decode` rewrite the text nodes the author placed inside the
/// component. They run after the first render and whenever either property
/// changes; replacing a space with a non-breaking space is idempotent, so a
/// second pass is harmless.
export default Component({
  behaviors: [hidden, hover("none")],
  properties: {
    selectable: { type: Boolean, value: false },
    userSelect: { type: Boolean, value: false },
    space: { type: String, value: "" },
    decode: { type: Boolean, value: false },
  },
  observers: {
    space() {
      this.__qchatApplyText();
    },
    decode() {
      this.__qchatApplyText();
    },
  },
  lifetimes: {
    ready() {
      this.__qchatApplyText();
    },
  },
  methods: {
    __qchatApplyText() {
      const host = hostElement(this);
      if (!host) return;
      const document = host.ownerDocument;
      if (!document || typeof document.createTreeWalker !== "function") return;
      const walker = document.createTreeWalker(host, 4 /* NodeFilter.SHOW_TEXT */);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      const space = this.data.space;
      const character = space === "nbsp" ? "\u00a0" : space === "ensp" ? "\u2002" : space === "emsp" ? "\u2003" : "";
      for (const node of nodes) {
        let text = String(node.nodeValue || "");
        if (this.data.decode) text = decodeEntities(text);
        if (character) text = text.replace(/ /g, character);
        if (text !== node.nodeValue) node.nodeValue = text;
      }
    },
  },
});

function decodeEntities(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, "\u00a0")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => codePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => codePoint(parseInt(decimal, 10)))
    .replace(/&amp;/g, "&");
}

function codePoint(value) {
  try {
    return String.fromCodePoint(value);
  } catch {
    return "";
  }
}
