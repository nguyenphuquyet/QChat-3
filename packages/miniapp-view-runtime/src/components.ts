/**
 * P0 in-page web components (specification section 7).
 *
 * Every component is a real custom element drawn inside the system WebView.
 * The renderer creates the element, sets attributes and appends text; the
 * element itself owns its shadow DOM, styling and DOM events. No component
 * ever reads page data or touches the bridge: it only emits DOM `CustomEvent`s,
 * which the View Runtime forwards to the Service Runtime.
 *
 * `COMPONENTS_SOURCE` is the script the WebView loads once. It is dependency
 * free and uses only standard DOM APIs available in the minimum WebView.
 */

import { COMPONENT_REGISTRY, type ComponentDefinition } from "@qchat/miniapp-contracts";

export interface WebComponentDefinition {
  /** WeChat component name (`view`, `scroll-view`, ...). */
  name: string;
  /** Registered custom-element tag. */
  tag: string;
  /** Properties reflected as attributes. */
  observedAttributes: readonly string[];
  /** DOM events the component emits. */
  events: readonly string[];
}

const P0: readonly string[] = COMPONENT_REGISTRY
  .filter((component) => component.priority === "P0")
  .map((component) => component.name);

/** The navigation bar is a host component but still drawn by the View Runtime. */
const NAVIGATION_BAR: WebComponentDefinition = {
  name: "navigation-bar",
  tag: "wx-navigation-bar",
  observedAttributes: ["title", "back", "color", "background", "loading"],
  events: ["navback"],
};

export const WEB_COMPONENTS: readonly WebComponentDefinition[] = [
  ...COMPONENT_REGISTRY
    .filter((component) => component.priority === "P0")
    .map((component: ComponentDefinition): WebComponentDefinition => ({
      name: component.name,
      tag: `wx-${component.name}`,
      observedAttributes: component.properties,
      events: component.events,
    })),
  NAVIGATION_BAR,
];

export function webComponentByName(name: string): WebComponentDefinition | undefined {
  return WEB_COMPONENTS.find((component) => component.name === name);
}

export function webComponentByTag(tag: string): WebComponentDefinition | undefined {
  return WEB_COMPONENTS.find((component) => component.tag === tag);
}

/** True when every P0 registry component has a web component. */
export function p0ComponentsCovered(): boolean {
  return P0.every((name) => WEB_COMPONENTS.some((component) => component.name === name));
}

/** `bindinput` detail shape; also what the web component dispatches. */
export function inputEventDetail(value: string, cursor = value.length, keyCode = 0): Record<string, unknown> {
  return { value, cursor, keyCode };
}

/** `bindscroll` detail shape. */
export function scrollEventDetail(state: {
  scrollTop: number;
  scrollLeft: number;
  scrollHeight: number;
  scrollWidth: number;
  deltaX?: number;
  deltaY?: number;
}): Record<string, unknown> {
  return {
    scrollTop: state.scrollTop,
    scrollLeft: state.scrollLeft,
    scrollHeight: state.scrollHeight,
    scrollWidth: state.scrollWidth,
    deltaX: state.deltaX ?? 0,
    deltaY: state.deltaY ?? 0,
  };
}

/** `bindload` / `binderror` detail for `image`. */
export function imageEventDetail(width: number, height: number): Record<string, unknown> {
  return { width, height };
}

/**
 * The WebView bootstrap. It registers every P0 component once. The source is
 * kept as a string so the Flutter host can inject it into the WebView without a
 * bundler; the Node tests parse and execute it against a minimal DOM shim.
 */
export const COMPONENTS_SOURCE = String.raw`
(function () {
  "use strict";
  if (!window.customElements || typeof HTMLElement === "undefined") return;

  function define(tag, ctor) {
    if (!customElements.get(tag)) customElements.define(tag, ctor);
  }
  function emit(element, type, detail) {
    element.dispatchEvent(new CustomEvent(type, { detail: detail || {}, bubbles: true, composed: true }));
  }
  function boolAttr(element, name, fallback) {
    var value = element.getAttribute(name);
    if (value === null) return fallback;
    return value !== "false";
  }
  function numberAttr(element, name, fallback) {
    var value = Number(element.getAttribute(name));
    return isFinite(value) ? value : fallback;
  }
  function base(observed, css, build, update) {
    return class extends HTMLElement {
      static get observedAttributes() { return observed; }
      connectedCallback() {
        if (!this.__qchatBuilt) {
          this.__qchatBuilt = true;
          var root = this.attachShadow({ mode: "open" });
          var style = document.createElement("style");
          style.textContent = css;
          root.appendChild(style);
          build.call(this, root);
        }
        if (update) update.call(this);
      }
      attributeChangedCallback() {
        if (this.__qchatBuilt && update) update.call(this);
      }
      disconnectedCallback() {
        if (this.__qchatCleanup) this.__qchatCleanup();
      }
    };
  }

  var VIEW_CSS = ":host{display:block;box-sizing:border-box}";
  var View = base(
    ["hover-class", "hover-start-time", "hover-stay-time", "hover-stop-propagation"],
    VIEW_CSS,
    function (root) {
      root.innerHTML = "<slot></slot>";
      var self = this;
      var timer = null;
      var active = false;
      function start() {
        if (!self.getAttribute("hover-class")) return;
        if (self.hasAttribute("disabled")) return;
        var delay = numberAttr(self, "hover-start-time", 50);
        timer = setTimeout(function () {
          active = true;
          self.classList.add(self.getAttribute("hover-class"));
        }, delay);
      }
      function end() {
        clearTimeout(timer);
        if (!active) return;
        active = false;
        var stay = numberAttr(self, "hover-stay-time", 400);
        var className = self.getAttribute("hover-class");
        setTimeout(function () { if (className) self.classList.remove(className); }, stay);
      }
      this.addEventListener("touchstart", function (event) {
        if (boolAttr(self, "hover-stop-propagation", false)) event.stopPropagation();
        start();
      }, { passive: true });
      this.addEventListener("touchend", end, { passive: true });
      this.addEventListener("touchcancel", end, { passive: true });
    },
    null
  );

  var TEXT_CSS = ":host{display:inline;white-space:normal;word-break:break-word}" +
    ":host([selectable=\"true\"]){user-select:text;-webkit-user-select:text}" +
    ":host([space]){white-space:pre-wrap}";
  function transformText(element) {
    if (element.__qchatTransforming) return;
    var decode = boolAttr(element, "decode", false);
    var space = element.getAttribute("space");
    if (!decode && !space) return;
    element.__qchatTransforming = true;
    try {
      var walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
      var node;
      while ((node = walker.nextNode())) {
        var text = node.nodeValue || "";
        if (decode) {
          text = text.replace(/&nbsp;/g, "\u00a0").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
            .replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&amp;/g, "&");
        }
        if (space === "ensp") text = text.replace(/ /g, "\u2002");
        else if (space === "emsp") text = text.replace(/ /g, "\u2003");
        else if (space === "nbsp") text = text.replace(/ /g, "\u00a0");
        if (text !== node.nodeValue) node.nodeValue = text;
      }
    } finally {
      element.__qchatTransforming = false;
    }
  }
  var Text = base(
    ["selectable", "space", "decode"],
    TEXT_CSS,
    function (root) {
      root.innerHTML = "<slot></slot>";
      var self = this;
      if (typeof MutationObserver !== "undefined") {
        this.__qchatObserver = new MutationObserver(function () { transformText(self); });
        this.__qchatObserver.observe(this, { childList: true, subtree: true, characterData: true });
        this.__qchatCleanup = function () {
          if (self.__qchatObserver) self.__qchatObserver.disconnect();
        };
      }
    },
    function () { transformText(this); }
  );

  var IMAGE_CSS = ":host{display:inline-block;overflow:hidden}" +
    "img{display:block;width:100%;height:100%;border:0}";
  var Image = base(
    ["src", "mode", "lazy-load", "show-menu-by-longpress"],
    IMAGE_CSS,
    function (root) {
      root.innerHTML = "<img part=\"image\" alt=\"\" />";
      var image = root.querySelector("img");
      var self = this;
      image.addEventListener("load", function () {
        emit(self, "load", { width: image.naturalWidth, height: image.naturalHeight });
      });
      image.addEventListener("error", function () {
        emit(self, "error", { errMsg: "image load failed" });
      });
      this.__qchatImage = image;
    },
    function () {
      var image = this.__qchatImage;
      if (!image) return;
      var src = this.getAttribute("src");
      if (src !== null && image.getAttribute("src") !== src) image.setAttribute("src", src);
      var mode = this.getAttribute("mode") || "scaleToFill";
      if (mode === "aspectFit") image.style.objectFit = "contain";
      else if (mode === "aspectFill") image.style.objectFit = "cover";
      else if (mode === "widthFix") { image.style.width = "100%"; image.style.height = "auto"; }
      else image.style.objectFit = "fill";
      image.loading = boolAttr(this, "lazy-load", false) ? "lazy" : "eager";
    }
  );

  var BUTTON_CSS = ":host{display:inline-block}" +
    "button{display:inline-flex;align-items:center;justify-content:center;gap:6px;margin:0;" +
    "padding:8px 16px;border:1px solid rgba(0,0,0,.12);border-radius:6px;background:#f7f7f7;" +
    "color:inherit;font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}" +
    "button[data-size=mini]{padding:3px 10px;font-size:12px}" +
    "button[data-type=primary]{background:var(--qchat-primary,#3b82f6);color:#fff;border-color:transparent}" +
    "button[data-type=warn]{background:#dc2626;color:#fff;border-color:transparent}" +
    "button[data-plain=true]{background:transparent;color:inherit}" +
    "button[disabled]{opacity:.5;cursor:not-allowed}" +
    "button[data-loading=true]::before{content:\"\";width:12px;height:12px;border:2px solid currentColor;" +
    "border-right-color:transparent;border-radius:50%;animation:qchat-spin .8s linear infinite}" +
    "@keyframes qchat-spin{to{transform:rotate(360deg)}}";
  var Button = base(
    ["size", "type", "plain", "disabled", "loading", "form-type", "open-type", "hover-class"],
    BUTTON_CSS,
    function (root) {
      root.innerHTML = "<button part=\"button\"><slot></slot></button>";
      var button = root.querySelector("button");
      var self = this;
      button.addEventListener("click", function (event) {
        if (self.hasAttribute("disabled")) return;
        emit(self, "tap", { x: event.clientX, y: event.clientY });
      });
      button.addEventListener("contextmenu", function (event) {
        if (self.hasAttribute("disabled")) event.preventDefault();
      });
      this.__qchatButton = button;
    },
    function () {
      var button = this.__qchatButton;
      if (!button) return;
      button.dataset.size = this.getAttribute("size") || "default";
      button.dataset.type = this.getAttribute("type") || "default";
      button.dataset.plain = String(boolAttr(this, "plain", false));
      button.dataset.loading = String(boolAttr(this, "loading", false));
      button.disabled = boolAttr(this, "disabled", false);
      button.setAttribute("aria-busy", String(boolAttr(this, "loading", false)));
    }
  );

  var INPUT_CSS = ":host{display:block}" +
    "input{display:block;width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid rgba(0,0,0,.14);" +
    "border-radius:6px;background:transparent;color:inherit;font:inherit;outline:none}" +
    "input:focus{border-color:var(--qchat-primary,#3b82f6)}" +
    "input[disabled]{opacity:.5}";
  var Input = base(
    ["value", "type", "password", "placeholder", "disabled", "maxlength", "focus", "confirm-type"],
    INPUT_CSS,
    function (root) {
      root.innerHTML = "<input part=\"input\" />";
      var input = root.querySelector("input");
      var self = this;
      input.addEventListener("input", function () {
        emit(self, "input", { value: input.value, cursor: input.selectionStart || 0, keyCode: 0 });
      });
      input.addEventListener("focus", function () { emit(self, "focus", { value: input.value, height: 0 }); });
      input.addEventListener("blur", function () { emit(self, "blur", { value: input.value }); });
      input.addEventListener("keydown", function (event) {
        if (event.key === "Enter") emit(self, "confirm", { value: input.value });
      });
      this.__qchatInput = input;
    },
    function () {
      var input = this.__qchatInput;
      if (!input) return;
      var password = boolAttr(this, "password", false);
      var type = password ? "password" : (this.getAttribute("type") || "text");
      input.type = type === "number" || type === "digit" || type === "idcard" ? "text" : type;
      var value = this.getAttribute("value");
      if (value !== null && input.value !== value) input.value = value;
      var placeholder = this.getAttribute("placeholder");
      if (placeholder !== null) input.placeholder = placeholder;
      input.disabled = boolAttr(this, "disabled", false);
      var maxlength = this.getAttribute("maxlength");
      if (maxlength !== null) input.maxLength = Number(maxlength) || 140;
      input.setAttribute("enterkeyhint", this.getAttribute("confirm-type") || "done");
      if (boolAttr(this, "focus", false) && (!document.activeElement || document.activeElement !== input)) input.focus();
    }
  );

  var SCROLL_CSS = ":host{display:block;overflow:hidden}" +
    ".scroll{width:100%;height:100%;overflow:hidden;-webkit-overflow-scrolling:touch}" +
    ".scroll[data-x=true]{overflow-x:auto}" +
    ".scroll[data-y=true]{overflow-y:auto}" +
    ".scroll[data-scrollbar=false]{scrollbar-width:none}" +
    ".scroll[data-scrollbar=false]::-webkit-scrollbar{display:none}";
  var ScrollView = base(
    ["scroll-x", "scroll-y", "upper-threshold", "lower-threshold", "scroll-top", "scroll-left", "enhanced", "show-scrollbar"],
    SCROLL_CSS,
    function (root) {
      root.innerHTML = "<div class=\"scroll\" part=\"scroll\"><slot></slot></div>";
      var scroller = root.querySelector(".scroll");
      var self = this;
      var lastTop = 0;
      var lastLeft = 0;
      var queued = false;
      scroller.addEventListener("scroll", function () {
        if (queued) return;
        queued = true;
        requestAnimationFrame(function () {
          queued = false;
          var top = scroller.scrollTop;
          var left = scroller.scrollLeft;
          emit(self, "scroll", {
            scrollTop: top, scrollLeft: left,
            scrollHeight: scroller.scrollHeight, scrollWidth: scroller.scrollWidth,
            deltaX: left - lastLeft, deltaY: top - lastTop
          });
          var upper = numberAttr(self, "upper-threshold", 50);
          var lower = numberAttr(self, "lower-threshold", 50);
          if (top <= upper && lastTop > upper) emit(self, "scrolltoupper", { direction: "top" });
          if (top + scroller.clientHeight >= scroller.scrollHeight - lower && lastTop + scroller.clientHeight < scroller.scrollHeight - lower) {
            emit(self, "scrolltolower", { direction: "bottom" });
          }
          lastTop = top;
          lastLeft = left;
        });
      }, { passive: true });
      this.__qchatScroller = scroller;
    },
    function () {
      var scroller = this.__qchatScroller;
      if (!scroller) return;
      scroller.dataset.x = String(boolAttr(this, "scroll-x", false));
      scroller.dataset.y = String(boolAttr(this, "scroll-y", false));
      scroller.dataset.scrollbar = String(boolAttr(this, "show-scrollbar", true));
      var top = numberAttr(this, "scroll-top", 0);
      if (scroller.scrollTop !== top) scroller.scrollTop = top;
      var left = numberAttr(this, "scroll-left", 0);
      if (scroller.scrollLeft !== left) scroller.scrollLeft = left;
    }
  );

  var NAV_CSS = ":host{display:flex;align-items:center;gap:8px;min-height:44px;padding:0 12px;" +
    "box-sizing:border-box;background:var(--qchat-nav-bg,#ffffff);color:var(--qchat-nav-fg,#111111);" +
    "font:inherit;font-weight:600;border-bottom:1px solid rgba(0,0,0,.08)}" +
    ".back{appearance:none;border:0;background:transparent;color:inherit;font:inherit;padding:6px;cursor:pointer}" +
    ".title{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".spinner{width:14px;height:14px;border:2px solid currentColor;border-right-color:transparent;" +
    "border-radius:50%;animation:qchat-spin .8s linear infinite}";
  var NavigationBar = base(
    ["title", "back", "color", "background", "loading"],
    NAV_CSS,
    function (root) {
      root.innerHTML = "<button class=\"back\" part=\"back\" aria-label=\"Back\">&#8249;</button>" +
        "<span class=\"title\" part=\"title\"></span><span class=\"spinner\" part=\"loading\" hidden></span>";
      var self = this;
      var back = root.querySelector(".back");
      back.addEventListener("click", function () { emit(self, "navback", {}); });
      this.__qchatNav = root;
    },
    function () {
      var root = this.__qchatNav;
      if (!root) return;
      root.querySelector(".title").textContent = this.getAttribute("title") || "";
      root.querySelector(".back").hidden = !boolAttr(this, "back", false);
      root.querySelector(".spinner").hidden = !boolAttr(this, "loading", false);
      this.style.color = this.getAttribute("color") || "#111111";
      this.style.background = this.getAttribute("background") || "#ffffff";
    }
  );

  define("wx-view", View);
  define("wx-text", Text);
  define("wx-image", Image);
  define("wx-button", Button);
  define("wx-input", Input);
  define("wx-scroll-view", ScrollView);
  define("wx-navigation-bar", NavigationBar);
})();
`;
