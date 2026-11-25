import hidden from "../behaviors/hidden.js";

/// `switch`
///
/// WeChat draws the switch itself, so the host is just the tap target and the
/// visible track/thumb are native spans. `type="checkbox"` is the square
/// variant, not a `checkbox` component.
export default Component({
  behaviors: [hidden],
  properties: {
    checked: { type: Boolean, value: false },
    disabled: { type: Boolean, value: false },
    type: { type: String, value: "switch" },
    color: { type: String, value: "#04BE02" },
  },
  methods: {
    onTap(event) {
      if (this.data.disabled) {
        if (event && typeof event.stopPropagation === "function") event.stopPropagation();
        return;
      }
      const value = !this.data.checked;
      this.setData({ checked: value });
      this.triggerEvent("change", { value });
    },
  },
});
