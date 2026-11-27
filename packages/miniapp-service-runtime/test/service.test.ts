import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_PAGE_STACK,
  VIEW_DESTROY_EVENT,
  VIEW_RENDER_EVENT,
  VIEW_THEME_EVENT,
  type BridgeMessage,
  type RenderNode,
  type RuntimeIdentity,
  type ViewEvent,
} from "@qchat/miniapp-contracts";
import { createServiceRuntime, parseDataPath, type PageOptions, type ServiceRuntime } from "../src/index.js";

const identity: RuntimeIdentity = {
  appId: "qchat.hello",
  appVersion: "1.0.0",
  sessionId: "s1",
  runtimeVersion: "0.1.0",
  baseLibraryVersion: "3.18.1",
};

function text(value: string): RenderNode {
  return { type: "text", text: value };
}

function counterPage(getRuntime: () => ServiceRuntime): PageOptions {
  return {
    data: { count: 0, title: "Hello" },
    render: (data): RenderNode => ({
      type: "element",
      tag: "wx-view",
      props: { class: "page" },
      children: [
        { type: "element", tag: "wx-text", props: {}, children: [text(String(data.title))] },
        {
          type: "element",
          tag: "wx-button",
          props: { type: "primary" },
          dataset: { action: "increment" },
          events: { tap: { handler: "onTap" } },
          children: [text(`count:${String(data.count)}`)],
        },
      ],
    }),
    handlers: {
      onTap(event: ViewEvent) {
        const active = getRuntime();
        const current = Number((active.pageData() as { count: number }).count);
        active.setData({ count: current + 1, "meta.lastAction": event.dataset.action });
      },
    },
  };
}

function setup(overrides: Partial<Parameters<typeof createServiceRuntime>[0]> = {}) {
  const sent: BridgeMessage[] = [];
  let runtime: ReturnType<typeof createServiceRuntime>;
  const pages: Record<string, PageOptions> = {
    "pages/index/index": counterPage(() => runtime),
    "pages/second/second": {
      data: { title: "Second" },
      render: (data) => ({ type: "element", tag: "wx-view", props: {}, children: [text(String(data.title))] }),
    },
  };
  runtime = createServiceRuntime({
    identity,
    transport: { send: (message) => sent.push(message) },
    theme: { app: "light" },
    pages,
    ...overrides,
  });
  return { runtime, sent, pages };
}

function renderEvents(sent: BridgeMessage[]) {
  return sent.filter((message) => message.kind === "event" && message.event === VIEW_RENDER_EVENT);
}

test("launch calls onLoad/onShow and sends one render event", () => {
  const lifecycle: string[] = [];
  const { runtime, sent, pages } = setup();
  pages["pages/index/index"].onLoad = () => lifecycle.push("onLoad");
  pages["pages/index/index"].onShow = () => lifecycle.push("onShow");
  const result = runtime.launch("pages/index/index", { from: "test" });
  assert.equal(result.ok, true);
  assert.deepEqual(lifecycle, ["onLoad", "onShow"]);
  const events = renderEvents(sent);
  assert.equal(events.length, 1);
  const event = events[0];
  assert.equal(event.kind, "event");
  if (event.kind === "event") {
    assert.equal(event.appId, "qchat.hello");
    assert.equal(event.sessionId, "s1");
    assert.equal(event.pageId, "p1");
    const tree = event.payload.tree as RenderNode;
    assert.equal(tree.type, "element");
  }
});

test("an unknown route is rejected before any render", () => {
  const { runtime, sent } = setup();
  const result = runtime.launch("pages/missing/missing");
  assert.equal(result.ok, false);
  assert.equal(result.error?.code, "NAVIGATION_INVALID_ROUTE");
  assert.equal(sent.length, 0);
});

test("a tap handler runs in the service and setData renders the new value", () => {
  const { runtime, sent } = setup();
  runtime.launch("pages/index/index");
  const result = runtime.dispatchViewEvent({
    handler: "onTap",
    type: "tap",
    detail: {},
    dataset: { action: "increment" },
    catch: false,
    timeStamp: 1,
  });
  assert.equal(result.ok, true, JSON.stringify(result.error));
  assert.equal((runtime.pageData() as { count: number }).count, 1);
  assert.equal((runtime.pageData() as { meta: { lastAction: string } }).meta.lastAction, "increment");
  const events = renderEvents(sent);
  assert.equal(events.length, 2);
});

test("an unknown handler is reported, never ignored", () => {
  const { runtime } = setup();
  runtime.launch("pages/index/index");
  const result = runtime.dispatchViewEvent({ handler: "nope", type: "tap", detail: {}, dataset: {}, catch: false, timeStamp: 1 });
  assert.equal(result.ok, false);
  assert.equal(result.error?.code, "BRIDGE_UNKNOWN_METHOD");
});

test("setData rejects a prototype path and an invalid key", () => {
  const { runtime } = setup();
  runtime.launch("pages/index/index");
  assert.deepEqual(parseDataPath("a.b[0].c"), ["a", "b", 0, "c"]);
  assert.equal(parseDataPath("__proto__.polluted"), null);
  assert.equal(parseDataPath("a[999999999]"), null);
  const bad = runtime.setData({ "__proto__.x": 1 });
  assert.equal(bad.ok, false);
  assert.equal(bad.error?.code, "API_INVALID_ARGUMENT");
});

test("the page stack pushes, hides and pops", () => {
  const { runtime, sent } = setup();
  runtime.launch("pages/index/index");
  const pushed = runtime.navigateTo("pages/second/second");
  assert.equal(pushed.ok, true);
  assert.equal(runtime.pageStack().length, 2);
  assert.equal(runtime.currentPage()?.route, "pages/second/second");
  const back = runtime.navigateBack();
  assert.equal(back.ok, true);
  assert.equal(runtime.pageStack().length, 1);
  assert.equal(runtime.currentPage()?.route, "pages/index/index");
  assert.ok(sent.some((message) => message.kind === "event" && message.event === VIEW_DESTROY_EVENT));
});

test("the stack limit is enforced", () => {
  const { runtime } = setup();
  runtime.launch("pages/index/index");
  for (let index = 1; index < MAX_PAGE_STACK; index += 1) {
    assert.equal(runtime.navigateTo("pages/second/second").ok, true);
  }
  const overflow = runtime.navigateTo("pages/second/second");
  assert.equal(overflow.ok, false);
  assert.equal(overflow.error?.code, "NAVIGATION_STACK_LIMIT");
});

test("auto theme follows the host and emits a theme event; light does not", () => {
  const { runtime, sent } = setup({ theme: { app: "auto" }, hostTheme: "dark" });
  runtime.launch("pages/index/index");
  assert.equal(runtime.resolvedTheme(), "dark");
  assert.equal(runtime.setHostTheme("light"), null);
  assert.equal(runtime.resolvedTheme(), "light");
  const themeEvents = sent.filter((message) => message.kind === "event" && message.event === VIEW_THEME_EVENT);
  assert.equal(themeEvents.length, 1);

  const fixed = setup({ theme: { app: "light" }, hostTheme: "dark" });
  fixed.runtime.launch("pages/index/index");
  assert.equal(fixed.runtime.resolvedTheme(), "light");
  fixed.runtime.setHostTheme("dark");
  const fixedThemeEvents = fixed.sent.filter((message) => message.kind === "event" && message.event === VIEW_THEME_EVENT);
  assert.equal(fixedThemeEvents.length, 0);
});

test("a page-level qxColorScheme overrides the app declaration", () => {
  const { runtime, pages } = setup({ theme: { app: "light" } });
  pages["pages/second/second"].qxColorScheme = "dark";
  runtime.launch("pages/second/second");
  assert.equal(runtime.resolvedTheme(), "dark");
});

test("handleMessage validates binding and accepts a host theme event for auto", () => {
  const { runtime } = setup({ theme: { app: "auto" }, hostTheme: "light" });
  runtime.launch("pages/index/index");
  const wrong = runtime.handleMessage({
    v: 1, kind: "event", appId: "qchat.hello", sessionId: "s2", pageId: "p1",
    event: "host.themeChange", payload: { theme: "dark" },
  });
  assert.equal(wrong?.code, "BRIDGE_PAGE_MISMATCH");
  const right = runtime.handleMessage({
    v: 1, kind: "event", appId: "qchat.hello", sessionId: "s1", pageId: "p1",
    event: "host.themeChange", payload: { theme: "dark" },
  });
  assert.equal(right, null);
  assert.equal(runtime.resolvedTheme(), "dark");
});

test("close unloads every page and refuses further work", () => {
  const { runtime } = setup();
  runtime.launch("pages/index/index");
  runtime.close();
  assert.equal(runtime.pageStack().length, 0);
  assert.equal(runtime.setData({ count: 1 }).error?.code, "BRIDGE_PAGE_CLOSED");
});
