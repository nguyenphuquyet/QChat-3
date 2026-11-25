import hidden from "../behaviors/hidden.js";
import { bindHost, inputValue, nativeElement, setHostExtraStyle } from "../shared/dom.js";

/// `textarea`
///
/// Like `input`, a native `<textarea>` does the editing. `auto-height` grows
/// the component host to the textarea's `scrollHeight`, because the host is the
/// box the author sizes.
export default Component({
  behaviors: [hidden],
  properties: {
    value: { type: String, value: "" },
    placeholder: { type: String, value: "" },
    placeholderStyle: { type: String, value: "" },
    placeholderClass: { type: String, value: "" },
    disabled: { type: Boolean, value: false },
    maxlength: { type: Number, value: 140 },
    autoFocus: { type: Boolean, value: false },
    focus: { type: Boolean, value: false },
    autoHeight: { type: Boolean, value: false },
    fixed: { type: Boolean, value: false },
    cursorSpacing: { type: Number, value: 0 },
    cursor: { type: Number, value: -1 },
    showConfirmBar: { type: Boolean, value: true },
    selectionStart: { type: Number, value: -1 },
    selectionEnd: { type: Number, value: -1 },
    adjustPosition: { type: Boolean, value: true },
    holdKeyboard: { type: Boolean, value: false },
    disableDefaultPadding: { type: Boolean, value: false },
    confirmType: { type: String, value: "return" },
    confirmHold: { type: Boolean, value: false },
    name: { type: String, value: "" },
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
      const element = nativeElement(this, ".qchat-textarea");
      if (!element) return;
      const next = value == null ? "" : String(value);
      if (element.value !== next) element.value = next;
      this.applyAutoHeight();
    },
    autoHeight() {
      this.applyAutoHeight();
    },
    focus(value) {
      const element = nativeElement(this, ".qchat-textarea");
      if (!element) return;
      if (value && typeof element.focus === "function") element.focus();
      else if (!value && typeof element.blur === "function") element.blur();
    },
    disabled(value) {
      const element = nativeElement(this, ".qchat-textarea");
      if (element) element.disabled = Boolean(value);
    },
  },
  lifetimes: {
    ready() {
      const element = nativeElement(this, ".qchat-textarea");
      if (element) {
        element.value = this.data.value == null ? "" : String(this.data.value);
        element.disabled = Boolean(this.data.disabled);
      }
      this.__qchatTextareaCleanup = bindHost(this, [
        ["input", (event) => this.onNativeInput(event)],
        ["focus", (event) => this.onNativeFocus(event)],
        ["blur", (event) => this.onNativeBlur(event)],
        ["keydown", (event) => this.onNativeKeydown(event)],
      ]);
      this.applyAutoHeight();
      if ((this.data.autoFocus || this.data.focus) && element && typeof element.focus === "function") {
        element.focus();
      }
    },
    detached() {
      if (this.__qchatTextareaCleanup) this.__qchatTextareaCleanup();
      this.__qchatTextareaCleanup = null;
    },
  },
  methods: {
    applyAutoHeight() {
      if (!this.data.autoHeight) return;
      const element = nativeElement(this, ".qchat-textarea");
      if (!element) return;
      const height = Math.max(Number(element.scrollHeight) || 0, 0);
      if (height > 0) setHostExtraStyle(this, `height:${height}px`);
    },
    onNativeInput(event) {
      const element = (event && event.target) || nativeElement(this, ".qchat-textarea");
      if (!element) return;
      if (event && typeof event.stopPropagation === "function") event.stopPropagation();
      const value = inputValue(element);
      const height = Number(element.scrollHeight) || 0;
      this.triggerEvent("input", {
        value,
        cursor: typeof element.selectionStart === "number" ? element.selectionStart : value.length,
        keyCode: 0,
      });
      if (this.data.autoHeight && height > 0) {
        this.triggerEvent("linechange", {
          height,
          heightRpx: height,
          lineCount: countLines(element),
        });
      }
      if (value !== this.data.value) this.setData({ value });
      this.applyAutoHeight();
    },
    onNativeFocus(event) {
      const element = (event && event.target) || nativeElement(this, ".qchat-textarea");
      if (event && typeof event.stopPropagation === "function") event.stopPropagation();
      this.triggerEvent("focus", {
        value: element ? inputValue(element) : "",
        height: 0,
      });
    },
    onNativeBlur(event) {
      const element = (event && event.target) || nativeElement(this, ".qchat-textarea");
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
      const element = (event && event.target) || nativeElement(this, ".qchat-textarea");
      this.triggerEvent("confirm", { value: element ? inputValue(element) : "" });
      if (!this.data.confirmHold && element && typeof element.blur === "function") element.blur();
    },
    __qchatActivate() {
      if (this.data.disabled) return;
      const element = nativeElement(this, ".qchat-textarea");
      if (element && typeof element.focus === "function") element.focus();
    },
    __qchatFormValue() {
      return this.data.value;
    },
    __qchatResetValue(initial) {
      const value = initial == null ? "" : String(initial);
      this.setData({ value });
      const element = nativeElement(this, ".qchat-textarea");
      if (element) element.value = value;
      this.applyAutoHeight();
    },
  },
});

function countLines(element) {
  let lineHeight = 0;
  try {
    const computed = element.ownerDocument?.defaultView?.getComputedStyle?.(element);
    lineHeight = computed ? parseFloat(computed.lineHeight) : 0;
  } catch {
    lineHeight = 0;
  }
  if (!Number.isFinite(lineHeight) || lineHeight <= 0) lineHeight = 20;
  const total = Number(element.scrollHeight) || 0;
  return Math.max(1, Math.round(total / lineHeight));
}
