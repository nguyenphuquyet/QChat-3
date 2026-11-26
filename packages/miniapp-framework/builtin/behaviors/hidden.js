/// Hides a built-in component without unmounting it.
///
/// WeChat's `hidden` attribute is accepted by every built-in component. The
/// host node keeps its layout slot and the component keeps its state; only the
/// rendered box is removed. `StyleSegmentIndex.TEMP_EXTRA` is the segment the
/// official `view` component uses for the same purpose, so user styles that
/// write `display` still win over this temporary rule.
import { StyleSegmentIndex } from "glass-easel";

export default Behavior({
  properties: {
    hidden: { type: Boolean, value: false },
  },
  observers: {
    hidden(hidden) {
      const element = this._$;
      if (!element) return;
      element.setNodeStyle(
        hidden ? "display: none" : "",
        StyleSegmentIndex.TEMP_EXTRA,
      );
    },
  },
});
