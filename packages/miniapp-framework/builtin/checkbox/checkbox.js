import hidden from "../behaviors/hidden.js";

/// `checkbox`
///
/// Inside a `checkbox-group` the group owns the value: the child reports the
/// toggle to the group, and the group emits one `change` with the selected
/// values. A standalone checkbox emits its own `change` with `{ value }`.
export default Component({
  behaviors: [hidden],
  properties: {
    value: { type: String, value: "" },
    disabled: { type: Boolean, value: false },
    checked: { type: Boolean, value: false },
    color: { type: String, value: "#09BB07" },
  },
  relations: {
    group: {
      type: "ancestor",
      target: "/__qchat__/builtin/checkbox-group/checkbox-group",
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
      const value = !this.data.checked;
      this.setData({ checked: value });
      const group = this.__qchatGroup;
      if (group && typeof group.__qchatOnChildChange === "function") {
        group.__qchatOnChildChange(this);
      } else {
        this.triggerEvent("change", { value });
      }
    },
  },
});
