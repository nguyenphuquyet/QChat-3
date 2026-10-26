// Installs the whole QuickJS environment, then records the timer order through
// the SDK console, which forwards to the host log channel. The test drives the
// virtual clock through the harness.
import "@mna/qchat/env/auto";

/** `requestAnimationFrame` has no Node type, and the fixture is type-checked
 * with `types: ["node"]`; the runtime lookup is the same global. */
const scope = globalThis as unknown as Record<string, any>;

const events: string[] = [];
const record = (name: string): number => events.push(name);

// Same-delay timers keep registration order, shorter delays run first.
setTimeout(() => record("t20"), 20);
setTimeout(() => record("t10a"), 10);
setTimeout(() => record("t10b"), 10);

// A cleared timer never runs at all.
const cancelled = setTimeout(() => record("cancelled"), 10);
clearTimeout(cancelled);

// Microtasks and frames run on the next tick, before any timeout.
queueMicrotask(() => record("microtask"));
scope.requestAnimationFrame(() => record("frame"));

// An interval repeats until another timer clears it.
let ticks = 0;
const interval = setInterval(() => record(`interval${++ticks}`), 10);
setTimeout(() => {
  clearInterval(interval);
  record("interval-cleared");
}, 35);

// A timer scheduled from inside a callback waits from the moment it was
// scheduled, not from the moment its callback was created.
setTimeout(() => {
  record("outer");
  setTimeout(() => {
    record("inner");
    console.log("INNER");
  }, 5);
}, 15);

// The final report closes the run.
setTimeout(() => {
  record("report");
  console.log("RESULT", JSON.stringify(events));
}, 60);

console.log("READY", JSON.stringify(events));
console.warn("a warning");
console.debug("a debug line");
console.error("an error line");
console.log("objects", { nested: { deep: { deeper: 1 } } }, [1, "two"], null, undefined);
const circular: Record<string, unknown> = { name: "loop" };
circular.self = circular;
console.log("circular", circular);
console.log("error", new Error("boom"));
