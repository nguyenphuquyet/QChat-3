import hidden from "../behaviors/hidden.js";
import hover from "../behaviors/hover.js";
import { reflectHostClasses } from "../shared/dom.js";

/// `button`
///
/// WeChat's button is a styled control with an `open-type` action. The action
/// is dispatched here, then the tap keeps bubbling so the author's `bindtap`
/// still runs, matching WeChat. A disabled button stops the tap instead.
export default Component({
  behaviors: [hidden, hover("button-hover", 20, 70)],
  properties: {
    size: { type: String, value: "default" },
    type: { type: String, value: "default" },
    plain: { type: Boolean, value: false },
    disabled: { type: Boolean, value: false },
    loading: { type: Boolean, value: false },
    formType: { type: String, value: "" },
    openType: { type: String, value: "" },
    lang: { type: String, value: "en" },
    sessionFrom: { type: String, value: "" },
    sendMessageTitle: { type: String, value: "" },
    sendMessagePath: { type: String, value: "" },
    sendMessageImg: { type: String, value: "" },
    appParameter: { type: String, value: "" },
    showMessageCard: { type: Boolean, value: false },
    groupId: { type: String, value: "" },
  },
  relations: {
    form: {
      type: "ancestor",
      target: "/__qchat__/builtin/form/form",
      linked(form) {
        this.__qchatForm = form;
      },
      unlinked() {
        this.__qchatForm = null;
      },
    },
  },
  observers: {
    size() {
      this.applyState();
    },
    type() {
      this.applyState();
    },
    plain() {
      this.applyState();
    },
    disabled() {
      this.applyState();
    },
  },
  lifetimes: {
    attached() {
      this.applyState();
    },
  },
  methods: {
    applyState() {
      const { size, type, plain, disabled } = this.data;
      reflectHostClasses(this, {
        "qchat-button--mini": size === "mini",
        "qchat-button--primary": type === "primary",
        "qchat-button--warn": type === "warn",
        "qchat-button--plain": Boolean(plain),
        "qchat-button--disabled": Boolean(disabled),
      });
    },
    onTap(event) {
      if (this.data.disabled) {
        if (event && typeof event.stopPropagation === "function") event.stopPropagation();
        return;
      }
      const formType = this.data.formType;
      const form = this.__qchatForm;
      if (formType === "submit" && form && typeof form.__qchatSubmit === "function") {
        form.__qchatSubmit();
      } else if (formType === "reset" && form && typeof form.__qchatReset === "function") {
        form.__qchatReset();
      }
      const openType = this.data.openType;
      if (!openType) return;
      const wx = typeof window !== "undefined" ? window.wx : undefined;
      if (!wx) return;
      if (openType === "share") {
        const share = typeof wx.share === "function" ? wx.share : null;
        if (share) {
          Promise.resolve(
            share({
              title: this.data.sendMessageTitle || undefined,
              path: this.data.sendMessagePath || undefined,
              imageUrl: this.data.sendMessageImg || undefined,
            }),
          ).catch(() => {});
        }
        return;
      }
      if (openType === "getUserInfo") {
        Promise.resolve(wx.getUserInfo({}))
          .then((result) => {
            this.triggerEvent("getuserinfo", {
              userInfo: result,
              errMsg: "getUserInfo:ok",
            });
          })
          .catch((error) => {
            this.triggerEvent("getuserinfo", {
              userInfo: null,
              errMsg: `getUserInfo:fail ${error && error.message ? error.message : "error"}`,
            });
          });
        return;
      }
      // chooseAvatar, contact, share-ticket, feedback, getPhoneNumber,
      // launchApp, openSetting and requestPayment need native capabilities the
      // QChat bridge does not expose. Report instead of faking success.
      this.triggerEvent("error", {
        errMsg: `open-type ${openType} is not supported by the QChat host`,
        openType,
      });
    },
  },
});
