import hidden from "../behaviors/hidden.js";
import hover from "../behaviors/hover.js";

/// `navigator`
///
/// WeChat's `navigator` is a link: it runs one `wx` navigation API and keeps the
/// tap bubbling so the author's own `bindtap` still fires. `target` defaults to
/// `self`; a `miniProgram` jump needs another Mini Program, which the QChat host
/// cannot open.
export default Component({
  behaviors: [hidden, hover("navigator-hover", 50, 600)],
  properties: {
    target: { type: String, value: "self" },
    url: { type: String, value: "" },
    openType: { type: String, value: "navigate" },
    delta: { type: Number, value: 1 },
    appId: { type: String, value: "" },
    path: { type: String, value: "" },
    extraData: { type: Object, value: {} },
    version: { type: String, value: "release" },
  },
  methods: {
    onTap() {
      if (this.data.target === "miniProgram") {
        this.triggerEvent("error", {
          errMsg: "navigator target=miniProgram is not supported by the QChat host",
        });
        return;
      }
      const wx = typeof window !== "undefined" ? window.wx : undefined;
      if (!wx) return;
      const url = this.data.url;
      const openType = this.data.openType || "navigate";
      if (openType === "navigateBack") {
        if (typeof wx.navigateBack === "function") {
          wx.navigateBack({ delta: Number(this.data.delta) || 1 });
        }
        return;
      }
      if (!url) return;
      if (openType === "navigate" && typeof wx.navigateTo === "function") {
        wx.navigateTo({ url });
      } else if (openType === "redirect" && typeof wx.redirectTo === "function") {
        wx.redirectTo({ url });
      } else if (openType === "switchTab" && typeof wx.switchTab === "function") {
        wx.switchTab({ url });
      } else if (openType === "reLaunch" && typeof wx.reLaunch === "function") {
        wx.reLaunch({ url });
      } else {
        this.triggerEvent("error", {
          errMsg: `navigator open-type ${openType} is not supported by the QChat host`,
          openType,
        });
      }
    },
  },
});
