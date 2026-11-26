import "@mna/qchat/env/auto";

// A one-millisecond interval would catch up hundreds of times after a long
// stall. The queue caps how much work one host tick may do.
let ticks = 0;
setInterval(() => {
  ticks += 1;
}, 1);
