import hidden from "../behaviors/hidden.js";
import { bindHost, nativeElement } from "../shared/dom.js";

const MODES = ["scaleToFill", "aspectFit", "aspectFill", "widthFix", "heightFix"];

export default Component({
  behaviors: [hidden],
  properties: {
    src: { type: String, value: "" },
    mode: { type: String, value: "scaleToFill" },
    lazyLoad: { type: Boolean, value: false },
    showMenuByLongpress: { type: Boolean, value: false },
    webp: { type: Boolean, value: false },
  },
  observers: {
    mode(mode) {
      if (!MODES.includes(mode)) {
        this.setData({ mode: "scaleToFill" });
      }
    },
  },
  lifetimes: {
    ready() {
      const element = nativeElement(this, ".qchat-image__img");
      if (!element) return;
      const emitLoad = (target) => {
        const image = target || element;
        this.triggerEvent("load", {
          width: image.naturalWidth || image.width || 0,
          height: image.naturalHeight || image.height || 0,
        });
      };
      const emitError = () => {
        this.triggerEvent("error", {
          errMsg: "GET_IMAGE_FAILED",
          errno: 0,
        });
      };
      this.__qchatImageCleanup = bindHost(this, [
        ["load", (event) => emitLoad(event && event.target)],
        ["error", () => emitError()],
      ]);
      // An image restored from cache may already be complete before `ready`.
      if (element.complete && element.naturalWidth > 0) emitLoad(element);
    },
    detached() {
      if (this.__qchatImageCleanup) this.__qchatImageCleanup();
      this.__qchatImageCleanup = null;
    },
  },
});
