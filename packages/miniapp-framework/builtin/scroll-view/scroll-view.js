import hidden from "../behaviors/hidden.js";
import { bindNative, nativeElement } from "../shared/dom.js";

/// `scroll-view`
///
/// The host element is the scroll viewport; an inner native `div` does the
/// scrolling so the author's `scroll-view { height: ... }` sizes the viewport
/// exactly like WeChat's. `scroll` / `scrolltolower` / `scrolltoupper` are
/// re-emitted with WeChat's detail shape from native DOM events.
export default Component({
  behaviors: [hidden],
  properties: {
    scrollX: { type: Boolean, value: false },
    scrollY: { type: Boolean, value: false },
    upperThreshold: { type: Number, value: 50 },
    lowerThreshold: { type: Number, value: 50 },
    scrollTop: { type: Number, value: 0 },
    scrollLeft: { type: Number, value: 0 },
    scrollIntoView: { type: String, value: "" },
    scrollWithAnimation: { type: Boolean, value: false },
    enableBackToTop: { type: Boolean, value: false },
    enableFlex: { type: Boolean, value: false },
    enhanced: { type: Boolean, value: false },
    showScrollbar: { type: Boolean, value: false },
    pagingEnabled: { type: Boolean, value: false },
    fastDeceleration: { type: Boolean, value: false },
    scrollAnchoring: { type: Boolean, value: false },
    refresherEnabled: { type: Boolean, value: false },
    refresherThreshold: { type: Number, value: 45 },
    refresherDefaultStyle: { type: String, value: "black" },
    refresherBackground: { type: String, value: "#FFF" },
    refresherTriggered: { type: Boolean, value: false },
  },
  observers: {
    scrollX() {
      if (this.__qchatScrollDirection) this.__qchatScrollDirection();
    },
    scrollY() {
      if (this.__qchatScrollDirection) this.__qchatScrollDirection();
    },
    scrollTop(value) {
      const element = nativeElement(this, ".qchat-scroll-view__body");
      if (!element) return;
      const top = Number(value) || 0;
      if (Math.abs(element.scrollTop - top) < 1) return;
      setScroll(element, "scrollTop", top, this.data.scrollWithAnimation);
    },
    scrollLeft(value) {
      const element = nativeElement(this, ".qchat-scroll-view__body");
      if (!element) return;
      const left = Number(value) || 0;
      if (Math.abs(element.scrollLeft - left) < 1) return;
      setScroll(element, "scrollLeft", left, this.data.scrollWithAnimation);
    },
    scrollIntoView(value) {
      if (!value) return;
      const body = nativeElement(this, ".qchat-scroll-view__body");
      if (!body || typeof body.querySelector !== "function") return;
      const target = body.querySelector(`#${cssEscape(String(value))}`);
      if (!target) return;
      if (typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ block: "nearest", inline: "nearest" });
        return;
      }
      const top = Number(target.offsetTop) || 0;
      setScroll(body, "scrollTop", top, this.data.scrollWithAnimation);
    },
  },
  lifetimes: {
    ready() {
      const state = {
        lastTop: 0,
        lastLeft: 0,
        upperLatched: false,
        lowerLatched: false,
      };
      this.__qchatScroll = state;
      const element = nativeElement(this, ".qchat-scroll-view__body");
      if (element) {
        const applyDirection = () => {
          const { scrollX, scrollY } = this.data;
          element.style.overflowX = scrollX ? "auto" : "hidden";
          element.style.overflowY = scrollY ? "auto" : "hidden";
        };
        applyDirection();
        this.__qchatScrollDirection = applyDirection;
      }
      this.__qchatScrollCleanup = bindNative(this, ".qchat-scroll-view__body", [
        ["scroll", (event) => this.__qchatOnScroll(event)],
      ]);
    },
    detached() {
      if (this.__qchatScrollCleanup) this.__qchatScrollCleanup();
      this.__qchatScrollCleanup = null;
      this.__qchatScroll = null;
      this.__qchatScrollDirection = null;
    },
  },
  methods: {
    onRefresherTouchStart() {
      // The pull-to-refresh gesture needs a touch pipeline the WebView host
      // does not expose to the component tree yet. The property still drives
      // the visual state, and the gap is recorded in the audit document.
    },
    __qchatOnScroll() {
      const element = nativeElement(this, ".qchat-scroll-view__body");
      const state = this.__qchatScroll;
      if (!element || !state) return;
      const scrollTop = element.scrollTop || 0;
      const scrollLeft = element.scrollLeft || 0;
      const detail = {
        scrollTop,
        scrollLeft,
        scrollHeight: element.scrollHeight || 0,
        scrollWidth: element.scrollWidth || 0,
        deltaX: state.lastLeft - scrollLeft,
        deltaY: state.lastTop - scrollTop,
      };
      state.lastTop = scrollTop;
      state.lastLeft = scrollLeft;
      this.triggerEvent("scroll", detail);

      const upperThreshold = Number(this.data.upperThreshold) || 0;
      const lowerThreshold = Number(this.data.lowerThreshold) || 0;
      const vertical = this.data.scrollY;
      const position = vertical ? scrollTop : scrollLeft;
      const size = vertical ? element.clientHeight || 0 : element.clientWidth || 0;
      const total = vertical ? element.scrollHeight || 0 : element.scrollWidth || 0;
      const atUpper = position <= upperThreshold;
      const atLower = total - size - position <= lowerThreshold;
      if (atUpper && !state.upperLatched) {
        state.upperLatched = true;
        this.triggerEvent("scrolltoupper", {
          direction: vertical ? "top" : "left",
        });
      } else if (!atUpper) {
        state.upperLatched = false;
      }
      if (atLower && !state.lowerLatched) {
        state.lowerLatched = true;
        this.triggerEvent("scrolltolower", {
          direction: vertical ? "bottom" : "right",
        });
      } else if (!atLower) {
        state.lowerLatched = false;
      }
    },
  },
});

function setScroll(element, property, value, smooth) {
  try {
    element[property] = value;
  } catch {
    element[property] = value;
  }
  if (smooth && typeof element.scrollTo === "function") {
    const options = { behavior: "smooth" };
    if (property === "scrollTop") options.top = value;
    else options.left = value;
    try {
      element.scrollTo(options);
    } catch {
      /* jsdom and older engines only support scrollTo(x, y) */
    }
  }
}

function cssEscape(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}
