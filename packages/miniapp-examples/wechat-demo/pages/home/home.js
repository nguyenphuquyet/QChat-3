Page({
  data: {
    title: "",
    count: 0,
    progress: 30,
    platform: "",
    items: [
      "view",
      "text",
      "button",
      "image",
      "scroll-view",
      "input",
      "textarea",
      "switch",
      "checkbox",
      "radio",
      "slider",
      "navigator",
      "progress",
    ],
  },
  onLoad() {
    const info = wx.getSystemInfoSync();
    this.setData({
      title: getApp().globalData.appName,
      platform: `${info.platform} · ${info.windowWidth}px`,
    });
  },
  increment() {
    this.setData({ count: this.data.count + 1 });
  },
  reset() {
    this.setData({ count: 0, progress: 30 });
  },
  onLower() {
    this.setData({ progress: 100 });
    wx.showToast({ title: "scrolltolower", icon: "none" });
  },
});
