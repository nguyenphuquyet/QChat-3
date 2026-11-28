
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
        var formType = self.getAttribute("form-type");
        if (formType === "submit") emit(self, "formsubmit", {});
        else if (formType === "reset") emit(self, "formreset", {});
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

  function clearChildren(node) {
    if (!node) return;
    while (node.childNodes && node.childNodes.length > 0) {
      if (typeof node.removeChild === "function") node.removeChild(node.childNodes[0]);
      else { node.innerHTML = ""; break; }
    }
  }
  function jsonAttr(element, name, fallback) {
    var raw = element.getAttribute(name);
    if (raw === null || raw === "") return fallback;
    try {
      var parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (error) {
      return fallback;
    }
  }
  function checkedValue(element) {
    if (element.__qchatInput) return element.__qchatInput.checked === true;
    return boolAttr(element, "checked", false);
  }
  function namedValue(element) {
    if (element.__qchatValue !== undefined) return element.__qchatValue;
    if (element.__qchatInput) return element.__qchatInput.value;
    if (element.__qchatChecked !== undefined) return element.__qchatChecked;
    return element.getAttribute("value") || "";
  }

  var TEXTAREA_CSS = ":host{display:block}" +
    "textarea{display:block;width:100%;box-sizing:border-box;min-height:72px;padding:8px 10px;" +
    "border:1px solid rgba(0,0,0,.14);border-radius:6px;background:transparent;color:inherit;" +
    "font:inherit;resize:none;outline:none}" +
    "textarea:focus{border-color:var(--qchat-primary,#3b82f6)}" +
    "textarea[disabled]{opacity:.5}";
  var Textarea = base(
    ["value", "placeholder", "disabled", "maxlength", "auto-height", "fixed"],
    TEXTAREA_CSS,
    function (root) {
      root.innerHTML = "<textarea part=\"textarea\"></textarea>";
      var area = root.querySelector("textarea");
      var self = this;
      area.addEventListener("input", function () {
        if (boolAttr(self, "auto-height", false)) {
          area.style.height = "auto";
          area.style.height = String(area.scrollHeight) + "px";
        }
        emit(self, "input", { value: area.value, cursor: area.selectionStart || 0, keyCode: 0 });
      });
      area.addEventListener("focus", function () { emit(self, "focus", { value: area.value, height: 0 }); });
      area.addEventListener("blur", function () { emit(self, "blur", { value: area.value }); });
      area.addEventListener("keydown", function (event) {
        if (event.key === "Enter" && !event.shiftKey) emit(self, "confirm", { value: area.value });
      });
      this.__qchatInput = area;
    },
    function () {
      var area = this.__qchatInput;
      if (!area) return;
      var value = this.getAttribute("value");
      if (value !== null && area.value !== value) area.value = value;
      var placeholder = this.getAttribute("placeholder");
      if (placeholder !== null) area.placeholder = placeholder;
      area.disabled = boolAttr(this, "disabled", false);
      var maxlength = this.getAttribute("maxlength");
      if (maxlength !== null) area.maxLength = Number(maxlength) || 140;
    }
  );

  var CHOICE_CSS = ":host{display:inline-flex;align-items:center;gap:6px;cursor:pointer;vertical-align:middle}" +
    "input{width:18px;height:18px;margin:0;accent-color:var(--qchat-primary,#3b82f6)}" +
    ":host([disabled]){opacity:.5;cursor:not-allowed}";
  var Checkbox = base(
    ["value", "checked", "disabled", "color"],
    CHOICE_CSS,
    function (root) {
      root.innerHTML = "<input type=\"checkbox\" part=\"checkbox\" /><slot></slot>";
      var input = root.querySelector("input");
      var self = this;
      input.addEventListener("change", function () {
        self.__qchatChecked = input.checked;
        emit(self, "change", { value: input.checked });
      });
      this.__qchatInput = input;
    },
    function () {
      var input = this.__qchatInput;
      if (!input) return;
      input.checked = boolAttr(this, "checked", false);
      this.__qchatChecked = input.checked;
      input.value = this.getAttribute("value") || "on";
      input.disabled = boolAttr(this, "disabled", false);
      var color = this.getAttribute("color");
      if (color) input.style.accentColor = color;
    }
  );

  var CHECKBOX_GROUP_CSS = ":host{display:block}";
  var CheckboxGroup = base(
    [],
    CHECKBOX_GROUP_CSS,
    function (root) {
      root.innerHTML = "<slot></slot>";
      var self = this;
      this.addEventListener("change", function () {
        if (self.__qchatGrouping) return;
        var nodes = self.querySelectorAll("wx-checkbox");
        var values = [];
        for (var index = 0; index < nodes.length; index += 1) {
          if (checkedValue(nodes[index])) values.push(nodes[index].getAttribute("value") || "on");
        }
        self.__qchatValue = values;
        self.__qchatGrouping = true;
        emit(self, "change", { value: values });
        self.__qchatGrouping = false;
      });
    },
    null
  );

  var Radio = base(
    ["value", "checked", "disabled", "color"],
    CHOICE_CSS,
    function (root) {
      root.innerHTML = "<input type=\"radio\" part=\"radio\" /><slot></slot>";
      var input = root.querySelector("input");
      var self = this;
      input.addEventListener("change", function () {
        self.__qchatChecked = input.checked;
        emit(self, "change", { value: input.checked });
      });
      this.__qchatInput = input;
    },
    function () {
      var input = this.__qchatInput;
      if (!input) return;
      input.checked = boolAttr(this, "checked", false);
      this.__qchatChecked = input.checked;
      input.value = this.getAttribute("value") || "on";
      input.disabled = boolAttr(this, "disabled", false);
      var color = this.getAttribute("color");
      if (color) input.style.accentColor = color;
    }
  );

  var RadioGroup = base(
    [],
    ":host{display:block}",
    function (root) {
      root.innerHTML = "<slot></slot>";
      var self = this;
      this.addEventListener("change", function () {
        if (self.__qchatGrouping) return;
        var nodes = self.querySelectorAll("wx-radio");
        var selected = "";
        for (var index = 0; index < nodes.length; index += 1) {
          if (checkedValue(nodes[index])) {
            selected = nodes[index].getAttribute("value") || "on";
            break;
          }
        }
        for (var reset = 0; reset < nodes.length; reset += 1) {
          var node = nodes[reset];
          var own = node.getAttribute("value") || "on";
          if (node.__qchatInput && own !== selected) node.__qchatInput.checked = false;
          if (own !== selected) node.__qchatChecked = false;
        }
        self.__qchatValue = selected;
        self.__qchatGrouping = true;
        emit(self, "change", { value: selected });
        self.__qchatGrouping = false;
      });
    },
    null
  );

  var SWITCH_CSS = ":host{display:inline-block}" +
    "button{position:relative;width:48px;height:28px;padding:0;border:0;border-radius:14px;" +
    "background:rgba(0,0,0,.18);cursor:pointer;transition:background .2s;vertical-align:middle}" +
    "button .knob{position:absolute;top:2px;left:2px;width:24px;height:24px;border-radius:50%;" +
    "background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .2s}" +
    "button[data-checked=true]{background:var(--qchat-primary,#3b82f6)}" +
    "button[data-checked=true] .knob{transform:translateX(20px)}" +
    "button[disabled]{opacity:.5;cursor:not-allowed}";
  var Switch = base(
    ["checked", "disabled", "type", "color"],
    SWITCH_CSS,
    function (root) {
      root.innerHTML = "<button type=\"button\" role=\"switch\" part=\"switch\" aria-checked=\"false\"><span class=\"knob\"></span></button>";
      var button = root.querySelector("button");
      var self = this;
      button.addEventListener("click", function () {
        if (boolAttr(self, "disabled", false)) return;
        var next = !self.__qchatChecked;
        self.__qchatChecked = next;
        button.dataset.checked = String(next);
        button.setAttribute("aria-checked", String(next));
        emit(self, "change", { value: next });
      });
      this.__qchatSwitch = button;
    },
    function () {
      var button = this.__qchatSwitch;
      if (!button) return;
      var checked = boolAttr(this, "checked", false);
      this.__qchatChecked = checked;
      button.dataset.checked = String(checked);
      button.dataset.type = this.getAttribute("type") || "switch";
      button.setAttribute("aria-checked", String(checked));
      button.disabled = boolAttr(this, "disabled", false);
      var color = this.getAttribute("color");
      if (color) button.style.background = color;
    }
  );

  var SLIDER_CSS = ":host{display:block}" +
    "input{display:block;width:100%;margin:0;accent-color:var(--qchat-primary,#3b82f6)}" +
    "input[disabled]{opacity:.5}";
  var Slider = base(
    ["value", "min", "max", "step", "disabled", "activeColor", "backgroundColor", "block-size"],
    SLIDER_CSS,
    function (root) {
      root.innerHTML = "<input type=\"range\" part=\"slider\" />";
      var input = root.querySelector("input");
      var self = this;
      input.addEventListener("input", function () { emit(self, "changing", { value: Number(input.value) }); });
      input.addEventListener("change", function () {
        self.__qchatValue = Number(input.value);
        emit(self, "change", { value: Number(input.value) });
      });
      this.__qchatInput = input;
    },
    function () {
      var input = this.__qchatInput;
      if (!input) return;
      input.min = String(numberAttr(this, "min", 0));
      input.max = String(numberAttr(this, "max", 100));
      input.step = String(numberAttr(this, "step", 1));
      var value = numberAttr(this, "value", 0);
      input.value = String(value);
      this.__qchatValue = value;
      input.disabled = boolAttr(this, "disabled", false);
      var active = this.getAttribute("activeColor");
      if (active) input.style.accentColor = active;
      var background = this.getAttribute("backgroundColor");
      if (background) input.style.background = background;
    }
  );

  var PICKER_CSS = ":host{display:block}" +
    "select,input{display:block;width:100%;box-sizing:border-box;padding:8px 10px;" +
    "border:1px solid rgba(0,0,0,.14);border-radius:6px;background:transparent;color:inherit;font:inherit}" +
    "[disabled]{opacity:.5}";
  var Picker = base(
    ["mode", "range", "range-key", "value", "start", "end", "disabled"],
    PICKER_CSS,
    function (root) {
      root.innerHTML = "<select part=\"select\"></select><input part=\"date\" type=\"date\" />";
      var select = root.querySelector("select");
      var date = root.querySelector("input");
      var self = this;
      function mode() { return self.getAttribute("mode") || "selector"; }
      select.addEventListener("change", function () {
        if (mode() === "multiSelector") {
          var picked = [];
          for (var index = 0; index < select.options.length; index += 1) {
            if (select.options[index].selected) picked.push(index);
          }
          self.__qchatValue = picked;
          emit(self, "change", { value: picked });
          return;
        }
        var value = Number(select.value);
        self.__qchatValue = value;
        emit(self, "change", { value: value });
      });
      date.addEventListener("change", function () {
        self.__qchatValue = date.value;
        emit(self, "change", { value: date.value });
      });
      this.__qchatSelect = select;
      this.__qchatDate = date;
    },
    function () {
      var select = this.__qchatSelect;
      var date = this.__qchatDate;
      if (!select || !date) return;
      var mode = this.getAttribute("mode") || "selector";
      var isDate = mode === "date" || mode === "time" || mode === "datetime";
      select.hidden = isDate;
      date.hidden = !isDate;
      select.disabled = boolAttr(this, "disabled", false);
      date.disabled = boolAttr(this, "disabled", false);
      if (isDate) {
        date.type = mode === "time" ? "time" : mode === "datetime" ? "datetime-local" : "date";
        var start = this.getAttribute("start");
        if (start !== null) date.min = start;
        var end = this.getAttribute("end");
        if (end !== null) date.max = end;
        var current = this.getAttribute("value");
        if (current !== null) date.value = current;
        return;
      }
      var range = jsonAttr(this, "range", []);
      if (!Array.isArray(range)) range = [];
      if (mode === "multiSelector" && range.length > 0 && Array.isArray(range[0])) range = range[0];
      var rangeKey = this.getAttribute("range-key");
      clearChildren(select);
      select.multiple = mode === "multiSelector";
      for (var index = 0; index < range.length; index += 1) {
        var option = document.createElement("option");
        var entry = range[index];
        var label = entry;
        if (rangeKey && entry && typeof entry === "object") label = entry[rangeKey];
        option.value = String(index);
        option.textContent = String(label === undefined || label === null ? "" : label);
        select.appendChild(option);
      }
      var value = numberAttr(this, "value", 0);
      select.value = String(value);
      this.__qchatValue = mode === "multiSelector" ? [value] : value;
    }
  );

  var FORM_CSS = ":host{display:block}form{display:block;margin:0}";
  var Form = base(
    ["report-submit"],
    FORM_CSS,
    function (root) {
      root.innerHTML = "<form part=\"form\"><slot></slot></form>";
      var self = this;
      function collect() {
        var values = {};
        var tags = ["wx-input", "wx-textarea", "wx-switch", "wx-slider", "wx-checkbox-group", "wx-radio-group", "wx-picker"];
        for (var tagIndex = 0; tagIndex < tags.length; tagIndex += 1) {
          var nodes = self.querySelectorAll(tags[tagIndex]);
          for (var index = 0; index < nodes.length; index += 1) {
            var node = nodes[index];
            var name = node.getAttribute("name");
            if (name) values[name] = namedValue(node);
          }
        }
        return values;
      }
      this.addEventListener("formsubmit", function () {
        self.__qchatGrouping = true;
        emit(self, "submit", { value: collect() });
        self.__qchatGrouping = false;
      });
      this.addEventListener("formreset", function () {
        var tags = ["wx-input", "wx-textarea", "wx-switch", "wx-slider", "wx-checkbox-group", "wx-radio-group", "wx-picker"];
        for (var tagIndex = 0; tagIndex < tags.length; tagIndex += 1) {
          var nodes = self.querySelectorAll(tags[tagIndex]);
          for (var index = 0; index < nodes.length; index += 1) {
            if (typeof nodes[index].__qchatReset === "function") nodes[index].__qchatReset();
          }
        }
        emit(self, "reset", {});
      });
      this.__qchatForm = root.querySelector("form");
    },
    null
  );

  var SWIPER_CSS = ":host{display:block;position:relative;overflow:hidden}" +
    ".track{display:flex;height:100%;will-change:transform}" +
    ".track[data-vertical=true]{flex-direction:column}" +
    ".dots{position:absolute;left:0;right:0;bottom:6px;display:flex;justify-content:center;gap:6px}" +
    ".dot{width:6px;height:6px;border-radius:50%;background:rgba(0,0,0,.25)}" +
    ".dot.active{background:var(--qchat-primary,#3b82f6)}";
  var Swiper = base(
    ["indicator-dots", "indicator-color", "indicator-active-color", "autoplay", "current", "interval", "duration", "circular", "vertical"],
    SWIPER_CSS,
    function (root) {
      root.innerHTML = "<div class=\"track\" part=\"track\"><slot></slot></div><div class=\"dots\" part=\"dots\"></div>";
      this.__qchatSwiper = { track: root.querySelector(".track"), dots: root.querySelector(".dots"), index: 0, timer: null };
    },
    function () {
      var state = this.__qchatSwiper;
      if (!state) return;
      var self = this;
      var current = numberAttr(this, "current", 0);
      var vertical = boolAttr(this, "vertical", false);
      var duration = numberAttr(this, "duration", 500);
      state.track.dataset.vertical = String(vertical);
      state.track.style.transition = "transform " + duration + "ms ease";
      state.track.style.transform = vertical ? "translateY(-" + current * 100 + "%)" : "translateX(-" + current * 100 + "%)";
      var items = this.querySelectorAll("wx-swiper-item");
      clearChildren(state.dots);
      if (boolAttr(this, "indicator-dots", false)) {
        for (var index = 0; index < items.length; index += 1) {
          var dot = document.createElement("span");
          dot.setAttribute("class", index === current ? "dot active" : "dot");
          var color = this.getAttribute("indicator-color");
          if (color && index !== current) dot.style.background = color;
          var activeColor = this.getAttribute("indicator-active-color");
          if (activeColor && index === current) dot.style.background = activeColor;
          state.dots.appendChild(dot);
        }
      }
      if (current !== state.index) {
        state.index = current;
        emit(this, "change", { current: current, source: "setData" });
      }
      clearTimeout(state.timer);
      if (boolAttr(this, "autoplay", false) && items.length > 1) {
        var interval = numberAttr(this, "interval", 5000);
        state.timer = setTimeout(function () {
          var next = current + 1;
          if (next >= items.length) next = boolAttr(self, "circular", false) ? 0 : current;
          if (next === current) return;
          self.setAttribute("current", String(next));
        }, interval);
      }
    }
  );

  var SWIPER_ITEM_CSS = ":host{display:block;flex:0 0 100%;width:100%;height:100%;box-sizing:border-box}";
  var SwiperItem = base([], SWIPER_ITEM_CSS, function (root) { root.innerHTML = "<slot></slot>"; }, null);

  var TAB_CSS = ":host{display:block}" +
    ".bar{display:flex;align-items:stretch;background:var(--qchat-tab-bg,#ffffff);" +
    "color:var(--qchat-tab-fg,#6b7280);border-top:1px solid rgba(0,0,0,.08)}" +
    ".item{flex:1;appearance:none;border:0;background:transparent;color:inherit;font:inherit;" +
    "padding:6px 0;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px}" +
    ".item[data-selected=true]{color:var(--qchat-tab-active,#3b82f6)}" +
    ".label{font-size:11px}";
  var TabBar = base(
    ["items", "selected", "color", "selected-color", "background-color", "border-style"],
    TAB_CSS,
    function (root) {
      root.innerHTML = "<div class=\"bar\" part=\"bar\"></div>";
      this.__qchatBar = root.querySelector(".bar");
    },
    function () {
      var bar = this.__qchatBar;
      if (!bar) return;
      var self = this;
      var items = jsonAttr(this, "items", []);
      if (!Array.isArray(items)) items = [];
      var selected = numberAttr(this, "selected", 0);
      clearChildren(bar);
      var background = this.getAttribute("background-color");
      if (background) bar.style.background = background;
      var color = this.getAttribute("color");
      if (color) bar.style.color = color;
      for (var index = 0; index < items.length; index += 1) {
        var entry = items[index] || {};
        var button = document.createElement("button");
        button.setAttribute("type", "button");
        button.setAttribute("class", "item");
        button.dataset.index = String(index);
        button.dataset.selected = String(index === selected);
        if (index === selected) {
          var selectedColor = this.getAttribute("selected-color");
          if (selectedColor) button.style.color = selectedColor;
        }
        var label = document.createElement("span");
        label.setAttribute("class", "label");
        label.textContent = String(entry.text === undefined ? "" : entry.text);
        button.appendChild(label);
        button.addEventListener("click", (function (position) {
          return function () {
            self.setAttribute("selected", String(position));
            emit(self, "tap", { index: position });
            emit(self, "change", { index: position });
          };
        })(index));
        bar.appendChild(button);
      }
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
  define("wx-textarea", Textarea);
  define("wx-checkbox", Checkbox);
  define("wx-checkbox-group", CheckboxGroup);
  define("wx-radio", Radio);
  define("wx-radio-group", RadioGroup);
  define("wx-switch", Switch);
  define("wx-slider", Slider);
  define("wx-picker", Picker);
  define("wx-form", Form);
  define("wx-swiper", Swiper);
  define("wx-swiper-item", SwiperItem);
  define("wx-tab-bar", TabBar);
})();
