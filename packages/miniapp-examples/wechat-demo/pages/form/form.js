Page({
  data: {
    name: "",
    note: "",
    subscribe: true,
    topics: ["wxml"],
    plan: "free",
    volume: 40,
    result: "",
  },
  onName(event) {
    this.setData({ name: event.detail.value });
  },
  onNote(event) {
    this.setData({ note: event.detail.value });
  },
  onSubscribe(event) {
    this.setData({ subscribe: event.detail.value });
  },
  onTopics(event) {
    this.setData({ topics: event.detail.value });
  },
  onPlan(event) {
    this.setData({ plan: event.detail.value });
  },
  onVolume(event) {
    this.setData({ volume: event.detail.value });
  },
  submit() {
    const result = [
      `name=${this.data.name}`,
      `note=${this.data.note}`,
      `subscribe=${this.data.subscribe}`,
      `topics=${this.data.topics.join(",")}`,
      `plan=${this.data.plan}`,
      `volume=${this.data.volume}`,
    ].join("\n");
    getApp().globalData.submitted = result;
    this.setData({ result });
    wx.showToast({ title: "Saved", icon: "success" });
  },
});
