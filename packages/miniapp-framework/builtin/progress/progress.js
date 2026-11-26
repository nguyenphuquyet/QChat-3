import hidden from "../behaviors/hidden.js";

/// `progress`
///
/// The host is a flex row so `show-info` can place the percentage next to the
/// bar like WeChat. `percent` is clamped to 0..100.
export default Component({
  behaviors: [hidden],
  properties: {
    percent: { type: Number, value: 0 },
    showInfo: { type: Boolean, value: false },
    strokeWidth: { type: Number, value: 6 },
    activeColor: { type: String, value: "#09BB07" },
    backgroundColor: { type: String, value: "#EBEBEB" },
    active: { type: Boolean, value: false },
    activeMode: { type: String, value: "backwards" },
    duration: { type: Number, value: 30 },
    borderRadius: { type: Number, value: 0 },
    fontSize: { type: Number, value: 16 },
  },
  observers: {
    percent(value) {
      const number = Number(value);
      const clamped = Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : 0;
      if (clamped !== number) this.setData({ percent: clamped });
    },
  },
});
