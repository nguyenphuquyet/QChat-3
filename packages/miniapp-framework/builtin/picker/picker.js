import hidden from "../behaviors/hidden.js";
import { bindHost, nativeElement } from "../shared/dom.js";

/// `picker`
///
/// `selector`, `time` and `date` are real native `<select>` / `<input>`
/// controls stretched invisibly over the host, so the platform chooser opens
/// and its value is read from the DOM. `multiSelector` renders one native
/// column per range and confirms them together. `region` needs a region
/// dataset the host does not ship; it reports `error` instead of faking one.
export default Component({
  behaviors: [hidden],
  properties: {
    mode: { type: String, value: "selector" },
    disabled: { type: Boolean, value: false },
    range: { type: Array, value: [] },
    rangeKey: { type: String, value: "" },
    value: { type: null, value: null },
    start: { type: String, value: "" },
    end: { type: String, value: "" },
    fields: { type: String, value: "day" },
    headerText: { type: String, value: "" },
    name: { type: String, value: "" },
  },
  data: {
    options: [],
    columns: [],
    displayText: "",
    nativeIndex: 0,
    nativeValue: "",
  },
  observers: {
    mode() {
      this.__qchatRebuild();
    },
    range() {
      this.__qchatRebuild();
    },
    rangeKey() {
      this.__qchatRebuild();
    },
    start() {
      this.__qchatRebuild();
    },
    end() {
      this.__qchatRebuild();
    },
    fields() {
      this.__qchatRebuild();
    },
    value() {
      if (this.__qchatInternal) return;
      this.__qchatRebuild();
    },
  },
  lifetimes: {
    ready() {
      this.__qchatRebuild();
      this.__qchatInputCleanup = bindHost(this, [
        ["change", (event) => this.onNativeChange(event)],
      ]);
    },
    detached() {
      if (this.__qchatInputCleanup) this.__qchatInputCleanup();
      this.__qchatInputCleanup = null;
    },
  },
  methods: {
    __qchatInternalSet(patch) {
      this.__qchatInternal = true;
      try {
        this.setData(patch);
      } finally {
        this.__qchatInternal = false;
      }
    },
    __qchatRebuild(override) {
      const mode = String(this.data.mode || "selector");
      const value = override === undefined ? this.data.value : override;
      if (mode === "selector") {
        const options = normalizeRange(this.data.range, this.data.rangeKey);
        const index = clampIndex(value, options.length);
        this.setData({
          options,
          columns: [],
          nativeIndex: index,
          nativeValue: "",
          displayText: options[index] ? options[index].label : "",
        });
        if (value !== index) this.__qchatInternalSet({ value: index });
        return;
      }
      if (mode === "multiSelector") {
        const ranges = Array.isArray(this.data.range) ? this.data.range : [];
        const selected = Array.isArray(value) ? value : [];
        const columns = ranges.map((range, columnIndex) => {
          const options = normalizeRange(range, this.data.rangeKey);
          return { options, index: clampIndex(selected[columnIndex], options.length) };
        });
        const normalized = columns.map((column) => column.index);
        this.setData({
          options: [],
          columns,
          nativeIndex: 0,
          nativeValue: "",
          displayText: columns
            .map((column) => (column.options[column.index] ? column.options[column.index].label : ""))
            .filter(Boolean)
            .join(" "),
        });
        const changed =
          !Array.isArray(value) ||
          value.length !== normalized.length ||
          normalized.some((entry, index) => entry !== value[index]);
        if (changed) this.__qchatInternalSet({ value: normalized });
        return;
      }
      if (mode === "time" || mode === "date") {
        const fallback = mode === "time" ? currentTime() : currentDate();
        const text = typeof value === "string" && value ? value : fallback;
        this.setData({
          options: [],
          columns: [],
          nativeIndex: 0,
          nativeValue: text,
          displayText: text,
        });
        if (value !== text) this.__qchatInternalSet({ value: text });
        return;
      }
      this.setData({ options: [], columns: [], nativeIndex: 0, nativeValue: "", displayText: "" });
    },
    __qchatApply(value, emit) {
      this.__qchatInternalSet({ value });
      this.__qchatRebuild(value);
      if (emit) this.triggerEvent("change", { value });
    },
    onNativeChange(event) {
      const target = event && event.target;
      if (!target) return;
      if (typeof event.stopPropagation === "function") event.stopPropagation();
      const tag = String(target.tagName || "").toUpperCase();
      if (tag === "SELECT") {
        const column = target.dataset ? Number(target.dataset.column) : NaN;
        const index = Math.max(0, Number(target.value) || 0);
        if (this.data.mode === "multiSelector" && Number.isFinite(column)) {
          const columns = this.data.columns.map((entry, entryIndex) =>
            entryIndex === column ? { ...entry, index } : entry,
          );
          this.setData({ columns });
          this.triggerEvent("columnchange", { column, value: index });
          return;
        }
        this.__qchatApply(index, true);
        return;
      }
      if (tag === "INPUT") {
        this.__qchatApply(String(target.value || ""), true);
      }
    },
    onConfirm() {
      const value = (this.data.columns || []).map((column) => column.index);
      this.__qchatApply(value, true);
    },
    onRegionTap() {
      this.triggerEvent("error", {
        errMsg: "picker mode=region needs a region dataset the QChat host does not ship",
        mode: "region",
      });
    },
    __qchatActivate() {
      if (this.data.disabled) return;
      if (this.data.mode === "region") {
        this.onRegionTap();
        return;
      }
      const selector = this.data.mode === "multiSelector"
        ? ".qchat-picker__column"
        : ".qchat-picker__overlay";
      const element = nativeElement(this, selector);
      if (!element) return;
      if (typeof element.showPicker === "function") {
        try {
          element.showPicker();
          return;
        } catch {
          /* older engines do not allow a programmatic picker */
        }
      }
      if (typeof element.focus === "function") element.focus();
      else if (typeof element.click === "function") element.click();
    },
    __qchatFormValue() {
      return this.data.value;
    },
    __qchatResetValue(initial) {
      this.__qchatApply(initial, false);
    },
  },
});

function normalizeRange(range, rangeKey) {
  if (!Array.isArray(range)) return [];
  return range.map((item) => ({ label: optionLabel(item, rangeKey) }));
}

function optionLabel(item, rangeKey) {
  if (rangeKey && item && typeof item === "object") {
    const value = item[rangeKey];
    return value == null ? "" : String(value);
  }
  return item == null ? "" : String(item);
}

function clampIndex(value, length) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number) || length <= 0) return 0;
  return Math.min(length - 1, Math.max(0, number));
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function currentTime() {
  const now = new Date();
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function currentDate() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
