Page({
  data: {
    platform: "",
    theme: "",
    stored: "",
    remote: "",
  },

  onLoad() {
    const info = wx.getSystemInfoSync();
    this.setData({ platform: info.platform, theme: info.theme });
  },

  onSave() {
    const page = this;
    wx.setStorage({
      key: "note",
      data: { text: "hello" },
      success() {
        page.setData({ stored: "saved" });
        wx.showToast({ title: "Saved", icon: "success" });
      },
      fail(error) {
        page.setData({ stored: "failed:" + error.code });
      },
    });
  },

  onFetch() {
    const page = this;
    wx.request({
      url: "https://api.example.com/greeting",
      success(result) {
        page.setData({ remote: result.data.message });
      },
      fail(error) {
        page.setData({ remote: "failed:" + error.code });
      },
    });
  },
});
