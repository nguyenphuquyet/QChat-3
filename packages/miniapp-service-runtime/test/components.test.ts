import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createNodeEngine,
  createSdkRuntime,
  type SdkMessage,
} from "../src/index.js";

const CARD = "components/card/card";

const SOURCES: Record<string, string> = {
  "app.js": "App({});",
  [`${CARD}.js`]: `
    Component({
      properties: {
        title: { type: String, value: "default" },
        count: { type: Number, value: 0 },
        active: Boolean,
        tags: { type: Array, value: [] },
        info: { type: Object, value: { a: 1 } }
      },
      data: { taps: 0, doubled: 0 },
      observers: {
        count: function (next) { this.setData({ doubled: next * 2 }); }
      },
      lifetimes: {
        created: function () { globalThis.__life = (globalThis.__life || []).concat("created"); },
        attached: function () { globalThis.__life.push("attached"); },
        ready: function () { globalThis.__life.push("ready"); },
        detached: function () { globalThis.__life.push("detached"); }
      },
      methods: {
        onTap: function () {
          this.setData({ taps: this.data.taps + 1 });
          this.triggerEvent("change", { taps: this.data.taps });
        },
        onEcho: function (event) { this.setData({ echoed: event.detail }); }
      }
    });
  `,
  [`${CARD}2.js`]: `Component({ properties: { label: String } });`,
};

function setup() {
  const engine = createNodeEngine();
  const messages: SdkMessage[] = [];
  const runtime = createSdkRuntime({
    engine,
    source: { read: (path) => SOURCES[path] ?? null },
    allowlist: [],
    onMessage: (message) => messages.push(message),
    onRequest: () => undefined,
  });
  assert.equal(runtime.install().ok, true);
  assert.equal(runtime.loadApp().ok, true);
  return { engine, runtime, messages };
}

interface Mounted {
  ok: boolean;
  data?: Record<string, unknown>;
  created?: boolean;
  message?: string;
}

function mount(
  runtime: ReturnType<typeof setup>["runtime"],
  key: string,
  path: string,
  props: Record<string, unknown> = {},
): Mounted {
  const result = runtime.componentMount({ key, path, props });
  assert.equal(result.ok, true, JSON.stringify(result.error));
  // The engine returns objects from its own realm; the host sees JSON.
  return JSON.parse(JSON.stringify(result.value)) as Mounted;
}

test("a component mounts with defaults, coerced properties and lifecycles", () => {
  const { engine, runtime } = setup();
  assert.equal(runtime.loadPage(CARD).ok, true);

  const value = mount(runtime, "p1:0", CARD, {
    title: 5,
    count: "3",
    active: "yes",
    tags: "nope",
    info: [],
  });
  assert.equal(value.ok, true);
  assert.equal(value.created, true);
  assert.deepEqual(value.data, {
    title: "5",
    count: 3,
    active: true,
    tags: [],
    info: {},
    taps: 0,
    doubled: 0,
  });
  assert.deepEqual(
    JSON.parse(JSON.stringify(engine.evaluate("globalThis.__life", "check.js").value)),
    ["created", "attached", "ready"],
  );
});

test("an absent property takes its declared default", () => {
  const { runtime } = setup();
  runtime.loadPage(CARD);
  const value = mount(runtime, "p1:0", CARD, {});
  assert.equal(value.data?.title, "default");
  assert.equal(value.data?.count, 0);
  assert.deepEqual(value.data?.info, { a: 1 });
});

test("an update runs the observer and posts component.setData", () => {
  const { runtime, messages } = setup();
  runtime.loadPage(CARD);
  mount(runtime, "p1:0", CARD, { count: 2 });
  messages.length = 0;

  const value = mount(runtime, "p1:0", CARD, { count: 4, title: "next" });
  assert.equal(value.created, false);
  assert.equal(value.data?.count, 4);
  assert.equal(value.data?.doubled, 8);
  const update = messages.filter((message) => message.kind === "component.setData").pop();
  assert.deepEqual(update?.payload, {
    key: "p1:0",
    path: CARD,
    data: {
      title: "next",
      count: 4,
      active: false,
      tags: [],
      info: { a: 1 },
      taps: 0,
      doubled: 8,
    },
  });
});

test("a method runs with its event and can set data and trigger an event", () => {
  const { runtime, messages } = setup();
  runtime.loadPage(CARD);
  mount(runtime, "p1:0", CARD, { count: 1 });
  messages.length = 0;

  const delivered = runtime.componentDeliver({
    key: "p1:0",
    handler: "onTap",
    event: { type: "tap", detail: {} },
  });
  assert.equal(delivered.ok, true, JSON.stringify(delivered.error));
  const kinds = messages.map((message) => message.kind);
  assert.deepEqual(kinds, ["component.setData", "component.event"]);
  assert.equal((messages[0].payload.data as Record<string, unknown>).taps, 1);
  assert.deepEqual(messages[1].payload, { key: "p1:0", name: "change", detail: { taps: 1 } });

  runtime.componentDeliver({ key: "p1:0", handler: "onEcho", event: { detail: { text: "hi" } } });
  const echo = messages.filter((message) => message.kind === "component.setData").pop();
  assert.deepEqual((echo?.payload.data as Record<string, unknown>).echoed, { text: "hi" });
});

test("an unknown method is reported, never silently dropped", () => {
  const { runtime } = setup();
  runtime.loadPage(CARD);
  mount(runtime, "p1:0", CARD);
  const result = runtime.componentDeliver({ key: "p1:0", handler: "nope", event: {} });
  assert.equal(result.ok, true);
  assert.equal((result.value as { ok: boolean }).ok, false);
  assert.equal((result.value as { code?: string }).code, "BRIDGE_UNKNOWN_METHOD");
});

test("unmount runs detached and refuses later events", () => {
  const { engine, runtime } = setup();
  runtime.loadPage(CARD);
  mount(runtime, "p1:0", CARD);
  assert.equal(runtime.componentUnmount("p1:0").ok, true);
  assert.equal(engine.evaluate("globalThis.__life[globalThis.__life.length - 1]", "check.js").value, "detached");

  const delivered = runtime.componentDeliver({ key: "p1:0", handler: "onTap", event: {} });
  assert.equal(delivered.ok, true);
  assert.equal((delivered.value as { code?: string }).code, "BRIDGE_PAGE_CLOSED");
});

test("unmounting a page drops only that page's components", () => {
  const { runtime } = setup();
  runtime.loadPage(CARD);
  mount(runtime, "p1:0", CARD);
  mount(runtime, "p1:1", CARD);
  mount(runtime, "p2:0", CARD);

  const result = runtime.unmountPageComponents("p1");
  assert.equal(result.ok, true);
  assert.equal((result.value as { removed: number }).removed, 2);

  const first = runtime.componentDeliver({ key: "p1:0", handler: "onTap", event: {} });
  assert.equal((first.value as { code?: string }).code, "BRIDGE_PAGE_CLOSED");
  const second = runtime.componentDeliver({ key: "p2:0", handler: "onTap", event: {} });
  assert.equal((second.value as { ok: boolean }).ok, true);
});

test("a mount without a Component definition is COMPONENT_UNSUPPORTED", () => {
  const { runtime } = setup();
  const result = mount(runtime, "p1:0", "components/missing/missing");
  assert.equal(result.ok, false);
  assert.equal(result.message, "No Component() definition for components/missing/missing");
});

test("mount rejects an invalid key or path before touching the engine", () => {
  const { runtime } = setup();
  const badKey = runtime.componentMount({ key: "bad key!", path: CARD, props: {} });
  assert.equal(badKey.ok, false);
  assert.equal(badKey.error?.code, "BRIDGE_INVALID_MESSAGE");

  const badPath = runtime.componentMount({ key: "p1:0", path: "../escape", props: {} });
  assert.equal(badPath.ok, false);
  assert.equal(badPath.error?.code, "BRIDGE_INVALID_MESSAGE");
});

test("a second component module registers under its own path", () => {
  const { runtime } = setup();
  runtime.loadPage(CARD);
  runtime.loadPage(`${CARD}2`);
  const first = mount(runtime, "p1:0", CARD, { title: "a" });
  const second = mount(runtime, "p1:1", `${CARD}2`, { label: "b" });
  assert.equal(first.data?.title, "a");
  assert.equal(second.data?.label, "b");
  assert.equal(second.data?.title, undefined);
});
