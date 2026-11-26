/// WeChat's `hover-class` behaviour.
///
/// A built-in that accepts `hover-class` starts with a default (`none` for most
/// components, `button-hover` for `button`, `navigator-hover` for `navigator`).
/// The class is applied to the component host so the author's own stylesheet can
/// style it, and it is removed after `hover-stay-time`.
///
/// `hover-stop-propagation` is accepted but has no effect: the host element does
/// not hover its ancestors in this runtime.
import { hostElement, later } from "../shared/dom.js";

export default function hoverBehavior(defaultClass, startTime, stayTime) {
  return Behavior({
    properties: {
      hoverClass: { type: String, value: defaultClass || "none" },
      hoverStopPropagation: { type: Boolean, value: false },
      hoverStartTime: { type: Number, value: startTime == null ? 50 : startTime },
      hoverStayTime: { type: Number, value: stayTime == null ? 400 : stayTime },
    },
    lifetimes: {
      ready() {
        const element = hostElement(this);
        if (!element || typeof element.addEventListener !== "function") return;
        const state = { start: null, stay: null, active: false };
        this.__qchatHover = state;

        const clear = () => {
          if (state.start) state.start();
          if (state.stay) state.stay();
          state.start = null;
          state.stay = null;
        };

        const begin = () => {
          clear();
          const name = this.data.hoverClass;
          if (!name || name === "none") return;
          state.start = later(() => {
            state.start = null;
            state.active = true;
            this._$.toggleNodeClass(name, true);
          }, this.data.hoverStartTime);
        };

        const end = () => {
          clear();
          const name = this.data.hoverClass;
          if (!name || name === "none") return;
          state.stay = later(() => {
            state.stay = null;
            state.active = false;
            this._$.toggleNodeClass(name, false);
          }, this.data.hoverStayTime);
        };

        const cancel = () => {
          clear();
          const name = this.data.hoverClass;
          if (state.active && name && name !== "none") this._$.toggleNodeClass(name, false);
          state.active = false;
        };

        element.addEventListener("touchstart", begin, { passive: true });
        element.addEventListener("touchend", end);
        element.addEventListener("touchcancel", cancel);
        element.addEventListener("mousedown", begin);
        element.addEventListener("mouseup", end);
        element.addEventListener("mouseleave", cancel);

        this.__qchatHoverCleanup = () => {
          cancel();
          element.removeEventListener("touchstart", begin);
          element.removeEventListener("touchend", end);
          element.removeEventListener("touchcancel", cancel);
          element.removeEventListener("mousedown", begin);
          element.removeEventListener("mouseup", end);
          element.removeEventListener("mouseleave", cancel);
        };
      },
      detached() {
        if (this.__qchatHoverCleanup) this.__qchatHoverCleanup();
        this.__qchatHoverCleanup = null;
        this.__qchatHover = null;
      },
    },
  });
}
