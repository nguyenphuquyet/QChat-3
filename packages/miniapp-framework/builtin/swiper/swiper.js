import hidden from "../behaviors/hidden.js";
import { hostElement } from "../shared/dom.js";

/// `swiper`
///
/// The host is the viewport and the shadow tree owns a flex track. Each
/// `swiper-item` is a descendant component that fills one slot, so the track
/// can translate by `current * itemSize` percent. Touch (and mouse, for the
/// desktop preview) drags are read on the host element; the WeChat events are
/// re-emitted with the documented `{current, source}` detail.
export default Component({
  behaviors: [hidden],
  properties: {
    indicatorDots: { type: Boolean, value: false },
    indicatorColor: { type: String, value: "#0000004D" },
    indicatorActiveColor: { type: String, value: "#000000" },
    autoplay: { type: Boolean, value: false },
    current: { type: Number, value: 0 },
    interval: { type: Number, value: 5000 },
    duration: { type: Number, value: 500 },
    circular: { type: Boolean, value: false },
    vertical: { type: Boolean, value: false },
    previousMargin: { type: String, value: "0px" },
    nextMargin: { type: String, value: "0px" },
    displayMultipleItems: { type: Number, value: 1 },
    skipHiddenItemLayout: { type: Boolean, value: false },
    easingFunction: { type: String, value: "default" },
    snapToEdge: { type: Boolean, value: false },
    currentItemId: { type: String, value: "" },
  },
  data: {
    count: 0,
    dots: [],
    offset: 0,
    itemSize: 100,
  },
  relations: {
    item: {
      type: "descendant",
      target: "/__qchat__/builtin/swiper-item/swiper-item",
      linked() {
        this.__qchatScheduleRefresh();
      },
      unlinked() {
        this.__qchatScheduleRefresh();
      },
    },
  },
  observers: {
    current() {
      if (this.__qchatInternal) return;
      this.__qchatApplyCurrent(true, "");
    },
    displayMultipleItems() {
      this.__qchatRefresh();
    },
    vertical() {
      this.__qchatRefresh();
    },
    autoplay() {
      if (this.__qchatReady) this.__qchatRestartAutoplay();
    },
    interval() {
      if (this.__qchatReady) this.__qchatRestartAutoplay();
    },
    currentItemId(value) {
      if (!value) return;
      const items = this.__qchatItems();
      for (let index = 0; index < items.length; index += 1) {
        if (items[index].data.itemId === value) {
          this.__qchatGoTo(index, "");
          return;
        }
      }
    },
  },
  lifetimes: {
    ready() {
      this.__qchatReady = true;
      this.__qchatRefresh();
      this.__qchatScheduleRefresh();
      this.__qchatBindInput();
    },
    detached() {
      this.__qchatReady = false;
      this.__qchatStopAutoplay();
      if (this.__qchatFinishTimer) clearTimeout(this.__qchatFinishTimer);
      this.__qchatFinishTimer = null;
      if (this.__qchatRefreshTimer) clearTimeout(this.__qchatRefreshTimer);
      this.__qchatRefreshTimer = null;
      if (this.__qchatInputCleanup) this.__qchatInputCleanup();
      this.__qchatInputCleanup = null;
    },
  },
  methods: {
    /// Relations link during render, after `linked` has already returned, so
    /// the item count is read on the next task instead of inside the callback.
    __qchatScheduleRefresh() {
      if (this.__qchatRefreshTimer) return;
      this.__qchatRefreshTimer = setTimeout(() => {
        this.__qchatRefreshTimer = null;
        this.__qchatRefresh();
        if (this.__qchatReady) this.__qchatRestartAutoplay();
      }, 0);
    },
    __qchatItems() {
      if (typeof this.getRelationNodes !== "function") return [];
      return this.getRelationNodes("item") || [];
    },
    __qchatPerView() {
      const requested = Math.max(1, Math.round(Number(this.data.displayMultipleItems) || 1));
      return Math.max(1, Math.min(requested, Math.max(1, this.data.count)));
    },
    __qchatMaxIndex() {
      return Math.max(0, this.data.count - this.__qchatPerView());
    },
    __qchatRefresh() {
      const count = this.__qchatItems().length;
      const perView = Math.max(1, Math.min(Math.round(Number(this.data.displayMultipleItems) || 1), Math.max(1, count)));
      const itemSize = 100 / perView;
      const dots = [];
      for (let index = 0; index < count; index += 1) dots.push(index);
      const maxIndex = Math.max(0, count - perView);
      const requested = Number(this.data.current) || 0;
      const current = this.data.circular && count > 0
        ? ((requested % count) + count) % count
        : Math.min(maxIndex, Math.max(0, requested));
      const offset = current * itemSize;
      // Relations can relink when the shadow tree re-renders. Writing the same
      // values again would re-render it and relink forever, so only patch what
      // actually changed.
      const patch = {};
      if (count !== this.data.count) patch.count = count;
      if (itemSize !== this.data.itemSize) patch.itemSize = itemSize;
      if (current !== this.data.current) patch.current = current;
      if (offset !== this.data.offset) patch.offset = offset;
      if (!sameNumbers(dots, this.data.dots)) patch.dots = dots;
      if (Object.keys(patch).length === 0) return;
      this.__qchatInternal = true;
      try {
        this.setData(patch);
      } finally {
        this.__qchatInternal = false;
      }
    },
    __qchatApplyCurrent(emit, source) {
      const maxIndex = this.__qchatMaxIndex();
      const requested = Number(this.data.current) || 0;
      const count = this.data.count;
      const current = this.data.circular && count > 0
        ? ((requested % count) + count) % count
        : Math.min(maxIndex, Math.max(0, requested));
      const offset = current * this.data.itemSize;
      // A page commonly binds `current` and writes it back in `bindchange`.
      // Re-applying the value it already has must not emit another change, or
      // the write-back would loop forever.
      const changed = current !== this.data.current || offset !== this.data.offset;
      this.__qchatInternal = true;
      try {
        if (changed) this.setData({ current, offset });
      } finally {
        this.__qchatInternal = false;
      }
      if (emit && changed) {
        this.triggerEvent("change", { current, source });
        this.__qchatScheduleFinish(current, source);
      }
    },
    __qchatGoTo(index, source) {
      const count = this.data.count;
      if (count === 0) return;
      const maxIndex = this.__qchatMaxIndex();
      let next = Math.round(Number(index) || 0);
      if (this.data.circular) next = ((next % count) + count) % count;
      else next = Math.min(maxIndex, Math.max(0, next));
      const offset = next * this.data.itemSize;
      this.__qchatInternal = true;
      try {
        this.setData({ current: next, offset });
      } finally {
        this.__qchatInternal = false;
      }
      this.triggerEvent("change", { current: next, source });
      this.__qchatScheduleFinish(next, source);
      if (source === "touch") this.__qchatRestartAutoplay();
    },
    __qchatScheduleFinish(current, source) {
      if (this.__qchatFinishTimer) clearTimeout(this.__qchatFinishTimer);
      const duration = Math.max(0, Number(this.data.duration) || 0);
      this.__qchatFinishTimer = setTimeout(() => {
        this.__qchatFinishTimer = null;
        this.triggerEvent("animationfinish", { current, source });
      }, duration);
    },
    __qchatSwipe(direction, source) {
      if (this.data.count <= 1) return;
      const maxIndex = this.__qchatMaxIndex();
      let next = this.data.current + direction;
      if (next > maxIndex) next = this.data.circular ? 0 : maxIndex;
      if (next < 0) next = this.data.circular ? maxIndex : 0;
      if (next === this.data.current) return;
      this.__qchatGoTo(next, source);
    },
    __qchatAutoplayNext() {
      const maxIndex = this.__qchatMaxIndex();
      if (this.data.count <= 1) return;
      const next = this.data.current >= maxIndex ? 0 : this.data.current + 1;
      this.__qchatGoTo(next, "autoplay");
    },
    __qchatRestartAutoplay() {
      this.__qchatStopAutoplay();
      if (!this.data.autoplay || this.data.count <= 1) return;
      const interval = Math.max(100, Number(this.data.interval) || 5000);
      this.__qchatAutoplayTimer = setInterval(() => this.__qchatAutoplayNext(), interval);
    },
    __qchatStopAutoplay() {
      if (this.__qchatAutoplayTimer) clearInterval(this.__qchatAutoplayTimer);
      this.__qchatAutoplayTimer = null;
    },
    __qchatBindInput() {
      const host = hostElement(this);
      if (!host || typeof host.addEventListener !== "function") return;
      const state = { startX: 0, startY: 0, dragging: false };
      const start = (event) => {
        const point = pointer(event);
        if (!point) return;
        state.startX = point.x;
        state.startY = point.y;
        state.dragging = true;
      };
      const end = (event) => {
        if (!state.dragging) return;
        state.dragging = false;
        const point = pointer(event, true);
        if (!point) return;
        const delta = this.data.vertical ? point.y - state.startY : point.x - state.startX;
        if (Math.abs(delta) < 40) return;
        this.__qchatSwipe(delta < 0 ? 1 : -1, "touch");
      };
      host.addEventListener("touchstart", start, { passive: true });
      host.addEventListener("touchend", end, { passive: true });
      host.addEventListener("touchcancel", end, { passive: true });
      host.addEventListener("mousedown", start);
      host.addEventListener("mouseup", end);
      this.__qchatInputCleanup = () => {
        host.removeEventListener("touchstart", start);
        host.removeEventListener("touchend", end);
        host.removeEventListener("touchcancel", end);
        host.removeEventListener("mousedown", start);
        host.removeEventListener("mouseup", end);
      };
    },
    onDotTap(event) {
      const index = event && event.currentTarget && event.currentTarget.dataset
        ? Number(event.currentTarget.dataset.index)
        : 0;
      this.__qchatGoTo(index, "touch");
    },
  },
});

function pointer(event, changed) {
  if (!event) return null;
  const list = changed
    ? event.changedTouches || event.touches
    : event.touches || event.changedTouches;
  const touch = list && list[0];
  if (touch && typeof touch.clientX === "number") return { x: touch.clientX, y: touch.clientY };
  if (typeof event.clientX === "number") return { x: event.clientX, y: event.clientY };
  return null;
}

function sameNumbers(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}
