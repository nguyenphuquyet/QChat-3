App({
  globalData: {
    appName: "QChat WeChat Demo",
    submitted: null,
  },
  onLaunch() {
    this.globalData.launchedAt = Date.now();
  },
});
