import hidden from "../behaviors/hidden.js";
import { hostElement } from "../shared/dom.js";

/// `form`
///
/// WeChat collects the `name` of every form control under the form. The
/// controls are discovered from the rendered tree (not a fixed relation list),
/// so nesting them inside `view` still works, and each control exposes
/// `__qchatFormValue` / `__qchatResetValue`. A `button` with `form-type`
/// reaches the form through its ancestor relation.
export default Component({
  behaviors: [hidden],
  properties: {
    reportSubmit: { type: Boolean, value: false },
    reportSubmitTimeout: { type: Number, value: 0 },
  },
  relations: {
    // glass-easel links a relation pair only when both components declare it.
    // The button declares the ancestor side; the form declares this descendant
    // side so `form-type` can reach `__qchatSubmit` / `__qchatReset`.
    button: {
      type: "descendant",
      target: "/__qchat__/builtin/button/button",
      linked() {},
      unlinked() {},
    },
  },
  lifetimes: {
    ready() {
      this.__qchatInitial = new Map();
      for (const control of this.__qchatControls()) this.__qchatRemember(control);
    },
    detached() {
      this.__qchatInitial = null;
    },
  },
  methods: {
    __qchatControls() {
      const host = hostElement(this);
      if (!host || typeof host.querySelectorAll !== "function") return [];
      const seen = new Set();
      const controls = [];
      for (const element of host.querySelectorAll("*")) {
        const component = element.__wxElement;
        if (!component || typeof component.__qchatFormValue !== "function") continue;
        if (seen.has(component)) continue;
        seen.add(component);
        controls.push(component);
      }
      return controls;
    },
    __qchatRemember(control) {
      if (!this.__qchatInitial) this.__qchatInitial = new Map();
      if (!this.__qchatInitial.has(control)) {
        this.__qchatInitial.set(control, cloneValue(control.__qchatFormValue()));
      }
    },
    __qchatCollect() {
      const value = {};
      for (const control of this.__qchatControls()) {
        this.__qchatRemember(control);
        const name = control.data ? control.data.name : "";
        if (!name) continue;
        value[name] = control.__qchatFormValue();
      }
      return value;
    },
    __qchatSubmit() {
      // `report-submit` needs the template-message backend; the event is still
      // emitted so the author's handler runs.
      this.triggerEvent("submit", { value: this.__qchatCollect(), formId: "" });
    },
    __qchatReset() {
      for (const control of this.__qchatControls()) {
        if (!this.__qchatInitial || !this.__qchatInitial.has(control)) continue;
        if (typeof control.__qchatResetValue !== "function") continue;
        control.__qchatResetValue(cloneValue(this.__qchatInitial.get(control)));
      }
      this.triggerEvent("reset", {});
    },
  },
});

function cloneValue(value) {
  if (value === undefined || value === null) return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}
