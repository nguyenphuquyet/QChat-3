import hidden from "../behaviors/hidden.js";
import { nativeElement } from "../shared/dom.js";

/// `slider`
///
/// The track is a native div; pointer drags are read from DOM mouse/touch
/// coordinates because the Mini Program event detail does not carry them for a
/// native node. `changing` fires while dragging and `change` on release.
export default Component({
  behaviors: [hidden],
  properties: {
    min: { type: Number, value: 0 },
    max: { type: Number, value: 100 },
    step: { type: Number, value: 1 },
    value: { type: Number, value: 0 },
    selectedColor: { type: String, value: "#1aad19" },
    activeColor: { type: String, value: "#1aad19" },
    backgroundColor: { type: String, value: "#e9e9e9" },
    blockSize: { type: Number, value: 28 },
    blockColor: { type: String, value: "#ffffff" },
    showValue: { type: Boolean, value: false },
    disabled: { type: Boolean, value: false },
    name: { type: String, value: "" },
  },
  data: {
    percent: 0,
  },
  observers: {
    value() {
      this.updatePercent();
    },
    min() {
      this.updatePercent();
    },
    max() {
      this.updatePercent();
    },
    step() {
      this.updatePercent();
    },
  },
  lifetimes: {
    ready() {
      this.updatePercent();
      const track = nativeElement(this, ".qchat-slider__track");
      if (!track || typeof track.addEventListener !== "function") return;
      const view = track.ownerDocument && track.ownerDocument.defaultView;
      const doc = track.ownerDocument;
      const state = { dragging: false };
      this.__qchatSlider = state;

      const start = (event) => {
        if (this.data.disabled) return;
        state.dragging = true;
        if (event && typeof event.preventDefault === "function") event.preventDefault();
        this.__qchatMoveTo(event, "changing");
      };
      const move = (event) => {
        if (!state.dragging) return;
        if (event && typeof event.preventDefault === "function") event.preventDefault();
        this.__qchatMoveTo(event, "changing");
      };
      const end = (event) => {
        if (!state.dragging) return;
        state.dragging = false;
        this.__qchatMoveTo(event, "change");
      };

      track.addEventListener("mousedown", start);
      track.addEventListener("touchstart", start, { passive: false });
      if (doc) {
        doc.addEventListener("mousemove", move);
        doc.addEventListener("mouseup", end);
        doc.addEventListener("touchmove", move, { passive: false });
        doc.addEventListener("touchend", end);
        doc.addEventListener("touchcancel", end);
      }
      this.__qchatSliderCleanup = () => {
        track.removeEventListener("mousedown", start);
        track.removeEventListener("touchstart", start);
        if (doc) {
          doc.removeEventListener("mousemove", move);
          doc.removeEventListener("mouseup", end);
          doc.removeEventListener("touchmove", move);
          doc.removeEventListener("touchend", end);
          doc.removeEventListener("touchcancel", end);
        }
      };
      void view;
    },
    detached() {
      if (this.__qchatSliderCleanup) this.__qchatSliderCleanup();
      this.__qchatSliderCleanup = null;
      this.__qchatSlider = null;
    },
  },
  methods: {
    updatePercent() {
      const min = Number(this.data.min) || 0;
      const max = Number(this.data.max);
      const value = Number(this.data.value);
      const span = max - min;
      if (!Number.isFinite(span) || span <= 0) {
        this.setData({ percent: 0 });
        return;
      }
      const ratio = Math.min(1, Math.max(0, (Number.isFinite(value) ? value : min) - min) / span);
      this.setData({ percent: Math.round(ratio * 10000) / 100 });
    },
    __qchatMoveTo(event, name) {
      const track = nativeElement(this, ".qchat-slider__track");
      if (!track || typeof track.getBoundingClientRect !== "function") return;
      const point = pointerX(event);
      if (point === null) return;
      const rect = track.getBoundingClientRect();
      const width = Number(rect.width) || 0;
      if (width <= 0) return;
      const ratio = Math.min(1, Math.max(0, (point - rect.left) / width));
      const value = this.__qchatQuantize(ratio);
      if (value === this.data.value && name === "change") {
        this.triggerEvent("change", { value });
        return;
      }
      this.setData({ value });
      this.triggerEvent(name, { value });
    },
    __qchatQuantize(ratio) {
      const min = Number(this.data.min) || 0;
      const max = Number(this.data.max);
      const span = max - min;
      if (!Number.isFinite(span) || span <= 0) return min;
      let step = Number(this.data.step);
      if (!Number.isFinite(step) || step <= 0) step = 1;
      const raw = min + ratio * span;
      const steps = Math.round((raw - min) / step);
      const snapped = min + steps * step;
      const clamped = Math.min(max, Math.max(min, snapped));
      const digits = decimalPlaces(step);
      return Number(clamped.toFixed(digits));
    },
    __qchatFormValue() {
      return Number(this.data.value) || 0;
    },
    __qchatResetValue(initial) {
      const value = Number(initial);
      this.setData({ value: Number.isFinite(value) ? value : Number(this.data.min) || 0 });
      this.updatePercent();
    },
  },
});

function pointerX(event) {
  if (!event) return null;
  const touch = event.touches && event.touches[0];
  if (touch && typeof touch.clientX === "number") return touch.clientX;
  const changed = event.changedTouches && event.changedTouches[0];
  if (changed && typeof changed.clientX === "number") return changed.clientX;
  if (typeof event.clientX === "number") return event.clientX;
  return null;
}

function decimalPlaces(value) {
  const text = String(value);
  const dot = text.indexOf(".");
  return dot < 0 ? 0 : text.length - dot - 1;
}
