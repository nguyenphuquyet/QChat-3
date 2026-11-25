import hidden from "../behaviors/hidden.js";
import { bindHost, inputValue, nativeElement } from "../shared/dom.js";

/// `input`
///
/// A native `<input>` inside the component does the editing; WeChat's events
/// are re-emitted from native DOM events because glass-easel's native-node
/// event detail is empty. Writing `value` back with `setData` is what makes
/// `model:value` work: glass-easel's model binding listens to the property
/// change.
export default Component({
  behaviors: [hidden],
  properties: {
    value: { type: String, value: "" },
    type: { type: String, value: "text" },
    password: { type: Boolean, value: false },
    placeholder: { type: String, value: "" },
    placeholderStyle: { type: String, value: "" },
    placeholderClass: { type: String, value: "" },
    disabled: { type: Boolean, value: false },
    maxlength: { type: Number, value: 140 },
    cursor: { type: Number, value: -1 },
    cursorSpacing: { type: Number, value: 0 },
    focus: { type: Boolean, value: false },
    confirmType: { type: String, value: "done" },
    confirmHold: { type: Boolean, value: false },
    holdKeyboard: { type: Boolean, value: false },
    adjustPosition: { type: Boolean, value: true },
    autoBlur: { type: Boolean, value: false },
    alwaysEmbed: { type: Boolean, value: false },
    selectionStart: { type: Number, value: -1 },
    selectionEnd: { type: Number, value: -1 },
  },
  data: {
    nativeMaxlength: 140,
    placeholderColor: "",
  },
  observers: {
    maxlength(value) {
      const limit = Number(value);
      this.setData({ nativeMaxlength: Number.isFinite(limit) && limit >= 0 ? limit : -1 });
    },
    placeholderStyle(value) {
      const match = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(String(value || ""));
      this.setData({ placeholderColor: match ? match[1].trim() : "" });
    },
    value(value) {
      const element = nativeElement(this, ".qchat-input");
      if (!element) return;
      const next = value == null ? "" : String(value);
      if (element.value !== next) element.value = next;
    },
    focus(value) {
      const element = nativeElement(this, ".qchat-input");
      if (!element) return;
      if (value && typeof element.focus === "function") element.focus();
      else if (!value && typeof element.blur === "function") element.blur();
    },
    disabled(value) {
      const element = nativeElement(this, ".qchat-input");
      if (element) element.disabled = Boolean(value);
    },
  },
  lifetimes: {
    ready() {
      const element = nativeElement(this, ".qchat-input");
      if (element) {
        element.value = this.data.value == null ? "" : String(this.data.value);
        element.disabled = Boolean(this.data.disabled);
      }
      this.__qchatInputCleanup = bindHost(this, [
        ["input", (event) => this.onNativeInput(event)],
        ["focus", (event) => this.onNativeFocus(event)],
        ["blur", (event) => this.onNativeBlur(event)],
        ["keydown", (event) => this.onNativeKeydown(event)],
      ]);
      if (this.data.focus && element && typeof element.focus === "function") element.focus();
    },
    detached() {
      if (this.__qchatInputCleanup) this.__qchatInputCleanup();
      this.__qchatInputCleanup = null;
    },
  },
  methods: {
    onNativeInput(event) {
      const element = (event && event.target) || nativeElement(this, ".qchat-input");
      if (!element) return;
      // Keep the raw DOM event from bubbling out as a second `input` event
      // whose glass-easel detail is empty. The re-emitted event below is the
      // one the author sees.
      if (event && typeof event.stopPropagation === "function") event.stopPropagation();
      const value = inputValue(element);
      this.triggerEvent("input", {
        value,
        cursor: typeof element.selectionStart === "number" ? element.selectionStart : value.length,
        keyCode: 0,
      });
      // Keep the property in sync so `model:value` sees the edit.
      if (value !== this.data.value) this.setData({ value });
    },
    onNativeFocus(event) {
      const element = (event && event.target) || nativeElement(this, ".qchat-input");
      if (event && typeof event.stopPropagation === "function") event.stopPropagation();
      this.triggerEvent("focus", {
        value: element ? inputValue(element) : "",
        height: 0,
      });
    },
    onNativeBlur(event) {
      const element = (event && event.target) || nativeElement(this, ".qchat-input");
      if (event && typeof event.stopPropagation === "function") event.stopPropagation();
      const value = element ? inputValue(element) : "";
      if (value !== this.data.value) this.setData({ value });
      this.triggerEvent("blur", {
        value,
        cursor: element && typeof element.selectionStart === "number" ? element.selectionStart : value.length,
      });
    },
    onNativeKeydown(event) {
      if (!event || event.key !== "Enter") return;
      if (typeof event.stopPropagation === "function") event.stopPropagation();
      const element = (event && event.target) || nativeElement(this, ".qchat-input");
      this.triggerEvent("confirm", { value: element ? inputValue(element) : "" });
      if (!this.data.confirmHold && element && typeof element.blur === "function") element.blur();
    },
  },
});
