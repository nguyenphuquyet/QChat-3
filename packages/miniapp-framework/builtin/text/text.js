import hidden from "../behaviors/hidden.js";
import hover from "../behaviors/hover.js";

export default Component({
  behaviors: [hidden, hover("none")],
  properties: {
    selectable: { type: Boolean, value: false },
    userSelect: { type: Boolean, value: false },
    space: { type: String, value: "" },
    decode: { type: Boolean, value: false },
  },
});
