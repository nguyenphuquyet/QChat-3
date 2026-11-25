import hidden from "../behaviors/hidden.js";
import { hostElement } from "../shared/dom.js";

/// `label`
///
/// Tapping the label activates its control: `for="id"` points at a specific
/// input/checkbox/radio/switch/picker, otherwise the first control inside the
/// label is used. A tap that lands on the control itself is ignored so the
/// control does not toggle twice.
export default Component({
  behaviors: [hidden],
  properties: {
    for: { type: String, value: "" },
  },
  lifetimes: {
    ready() {
      const host = hostElement(this);
      if (!host || typeof host.addEventListener !== "function") return;
      this.__qchatHost = host;
      const handler = (event) => this.onClick(event);
      host.addEventListener("click", handler);
      this.__qchatCleanup = () => host.removeEventListener("click", handler);
    },
    detached() {
      if (this.__qchatCleanup) this.__qchatCleanup();
      this.__qchatCleanup = null;
      this.__qchatHost = null;
    },
  },
  methods: {
    onClick(event) {
      const host = this.__qchatHost;
      if (!host) return;
      let node = event && event.target;
      while (node && node !== host) {
        const component = node.__wxElement;
        if (component && typeof component.__qchatActivate === "function") return;
        node = node.parentNode;
      }
      const control = this.__qchatTarget();
      if (control && typeof control.__qchatActivate === "function") control.__qchatActivate();
    },
    __qchatTarget() {
      const host = this.__qchatHost;
      const id = String(this.data.for || "");
      if (id) {
        const document = host && host.ownerDocument;
        const element = document && typeof document.getElementById === "function"
          ? document.getElementById(id)
          : null;
        const component = element && element.__wxElement;
        if (component && typeof component.__qchatActivate === "function") return component;
      }
      if (!host || typeof host.querySelectorAll !== "function") return null;
      for (const element of host.querySelectorAll("*")) {
        const component = element.__wxElement;
        if (component && typeof component.__qchatActivate === "function") return component;
      }
      return null;
    },
  },
});
