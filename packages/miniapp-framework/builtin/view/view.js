import hidden from "../behaviors/hidden.js";
import hover from "../behaviors/hover.js";

export default Component({
  behaviors: [hidden, hover("none")],
});
