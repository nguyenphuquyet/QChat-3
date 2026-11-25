import hidden from "../behaviors/hidden.js";

/// `radio-group`
///
/// Exactly one child is checked. `value` selects it; a tap reports the new value
/// through the group's single `change` event.
export default Component({
  behaviors: [hidden],
  properties: {
    value: { type: String, value: "" },
  },
  relations: {
    radio: {
      type: "descendant",
      target: "/__qchat__/builtin/radio/radio",
      linked() {
        this.__qchatScheduleSync();
      },
      unlinked() {
        this.__qchatScheduleSync();
      },
    },
  },
  observers: {
    value() {
      this.__qchatScheduleSync();
    },
  },
  lifetimes: {
    detached() {
      if (this.__qchatSyncTimer) clearTimeout(this.__qchatSyncTimer);
      this.__qchatSyncTimer = null;
    },
  },
  methods: {
    __qchatChildren() {
      if (typeof this.getRelationNodes !== "function") return [];
      return this.getRelationNodes("radio") || [];
    },
    __qchatScheduleSync() {
      if (this.__qchatSyncing) return;
      if (this.__qchatSyncTimer) clearTimeout(this.__qchatSyncTimer);
      this.__qchatSyncTimer = setTimeout(() => {
        this.__qchatSyncTimer = null;
        this.__qchatSyncFromValue();
      }, 0);
    },
    __qchatSyncFromValue() {
      const selected = this.data.value == null ? "" : String(this.data.value);
      this.__qchatSyncing = true;
      try {
        for (const child of this.__qchatChildren()) {
          const checked = selected !== "" && child.data.value === selected;
          if (Boolean(child.data.checked) !== checked) child.setData({ checked });
        }
      } finally {
        this.__qchatSyncing = false;
      }
    },
    __qchatOnChildLinked(child) {
      const selected = this.data.value == null ? "" : String(this.data.value);
      if (selected === "") return;
      const checked = child.data.value === selected;
      if (Boolean(child.data.checked) !== checked) child.setData({ checked });
    },
    __qchatOnChildChange(changed) {
      if (this.__qchatSyncing) return;
      this.__qchatSyncing = true;
      try {
        for (const child of this.__qchatChildren()) {
          if (child !== changed && child.data.checked) child.setData({ checked: false });
        }
        this.setData({ value: changed.data.value });
      } finally {
        this.__qchatSyncing = false;
      }
      this.triggerEvent("change", { value: changed.data.value });
    },
  },
});
