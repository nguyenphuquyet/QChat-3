Component({
  properties: {
    title: { type: String, value: "" },
    count: { type: Number, value: 0 },
  },
  data: {
    taps: 0,
  },
  methods: {
    onTap() {
      this.setData({ taps: this.data.taps + 1 });
      this.triggerEvent("change", { clicks: this.data.taps });
    },
  },
});
