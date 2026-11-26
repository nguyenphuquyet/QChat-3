import hidden from "../behaviors/hidden.js";

/// `radio`
///
/// A radio selects one value inside a `radio-group`; the group emits the single
/// `change` event. A standalone radio emits its own `change` with the new
/// checked state.
export default Component({
  behaviors: [hidden],
  properties: {
    value: { type: String, value: "" },
    checked: { type: Boolean, value: false },
    disabled: { type: Boolean, value: false },
    color: { type: String, value: "#09BB07" },
  },
  relations: {
    group: {
      type: "ancestor",
      target: "/__qchat__/builtin/radio-group/radio-group",
      linked(group) {
        this.__qchatGroup = group;
        if (typeof group.__qchatOnChildLinked === "function") group.__qchatOnChildLinked(this);
      },
      unlinked() {
        this.__qchatGroup = null;
      },
    },
  },
  methods: {
    onTap(event) {
      if (this.data.disabled) {
        if (event && typeof event.stopPropagation === "function") event.stopPropagation();
        return;
      }
      if (this.data.checked) return;
      this.setData({ checked: true });
      const group = this.__qchatGroup;
      if (group && typeof group.__qchatOnChildChange === "function") {
        group.__qchatOnChildChange(this);
      } else {
        this.triggerEvent("change", { value: true });
      }
    },
    __qchatActivate() {
      this.onTap();
    },
  },
});
