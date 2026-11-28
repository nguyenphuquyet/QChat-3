Page({
  data: {
    count: "0",
  },

  onLoad(query) {
    if (query && typeof query.count === "string") {
      this.setData({ count: query.count });
    }
  },

  onBack() {
    wx.navigateBack();
  },
});
