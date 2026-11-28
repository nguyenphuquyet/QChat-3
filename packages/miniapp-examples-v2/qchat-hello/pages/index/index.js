Page({
  data: {
    title: "QChat Hello",
    count: 0,
    items: ["WXML", "WXSS", "JavaScript"],
    saved: "",
    hasSaved: false,
  },

  onLoad() {
    const saved = wx.getStorageSync("hello.count");
    if (typeof saved === "number" && saved > 0) {
      this.setData({ count: saved, saved: String(saved), hasSaved: true });
    }
  },

  onIncrement() {
    this.setData({ count: this.data.count + 1 });
  },

  onSave() {
    wx.setStorageSync("hello.count", this.data.count);
    this.setData({ saved: String(this.data.count), hasSaved: true });
    wx.showToast({ title: "Saved", icon: "success" });
  },

  onOpenAbout() {
    wx.navigateTo({ url: "/pages/about/about?count=" + this.data.count });
  },
});
