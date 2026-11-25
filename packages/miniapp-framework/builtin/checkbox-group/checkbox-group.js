import hidden from "../behaviors/hidden.js";

/// `checkbox-group`
///
/// Collects the checked children and emits one `change` with
/// `{ value: [string, ...] }`, matching WeChat. Setting `value` on the group
/// selects the matching children; the children's own `checked` attribute is the
/// initial state when the group has no value.
export default Component({
  behaviors: [hidden],
  properties: {
    value: { type: Array, value: [] },
  },
  relations: {
    checkbox: {
      type: "descendant",
      target: "/__qchat__/builtin/checkbox/checkbox",
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
      return this.getRelationNodes("checkbox") || [];
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
      const selected = Array.isArray(this.data.value) ? this.data.value : [];
      if (selected.length === 0) return;
      this.__qchatSyncing = true;
      try {
        for (const child of this.__qchatChildren()) {
          const checked = selected.includes(child.data.value);
          if (Boolean(child.data.checked) !== checked) child.setData({ checked });
        }
      } finally {
        this.__qchatSyncing = false;
      }
    },
    __qchatOnChildLinked(child) {
      const selected = Array.isArray(this.data.value) ? this.data.value : [];
      if (selected.length === 0) return;
      const checked = selected.includes(child.data.value);
      if (Boolean(child.data.checked) !== checked) child.setData({ checked });
    },
    __qchatOnChildChange() {
      if (this.__qchatSyncing) return;
      const values = [];
      for (const child of this.__qchatChildren()) {
        if (child.data.checked) values.push(child.data.value);
      }
      this.__qchatSyncing = true;
      try {
        this.setData({ value: values });
      } finally {
        this.__qchatSyncing = false;
      }
      this.triggerEvent("change", { value: values });
    },
  },
});
