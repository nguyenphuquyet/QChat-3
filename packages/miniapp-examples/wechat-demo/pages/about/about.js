Page({
  data: {
    title: "",
    platform: "",
    submitted: "",
    pages: 0,
  },
  onShow() {
    const info = wx.getSystemInfoSync();
    this.setData({
      title: getApp().globalData.appName,
      platform: `${info.platform} · SDK ${info.SDKVersion}`,
      submitted: getApp().globalData.submitted || "(form not submitted yet)",
      pages: getCurrentPages().length,
    });
  },
  backHome() {
    wx.navigateBack({ delta: 2 });
  },
});
