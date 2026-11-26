import hidden from "../behaviors/hidden.js";

/// `swiper-item`
///
/// The host is a flex item of the swiper track. Its main-axis size comes from
/// the `--qchat-swiper-item-size` custom property the swiper sets on the track,
/// so `display-multiple-items` needs no per-item inline style.
export default Component({
  behaviors: [hidden],
  properties: {
    itemId: { type: String, value: "" },
  },
  relations: {
    swiper: {
      type: "ancestor",
      target: "/__qchat__/builtin/swiper/swiper",
      linked(swiper) {
        this.__qchatSwiper = swiper;
        if (swiper && typeof swiper.__qchatScheduleRefresh === "function") {
          swiper.__qchatScheduleRefresh();
        }
      },
      unlinked() {
        this.__qchatSwiper = null;
      },
    },
  },
});
