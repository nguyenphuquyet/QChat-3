import assert from "node:assert/strict";
import { test } from "node:test";
import { createNodeEngine, SDK_SOURCE } from "../src/index.js";

interface SdkMessage {
  kind: string;
  payload: Record<string, unknown>;
}

interface Harness {
  engine: ReturnType<typeof createNodeEngine>;
  messages: SdkMessage[];
  store: Map<string, string>;
  host: Record<string, unknown>;
  evaluate(source: string): void;
  read<T>(expression: string): T;
  respond(id: string, response: Record<string, unknown>): void;
}

function createHarness(): Harness {
  const engine = createNodeEngine();
  const messages: SdkMessage[] = [];
  const store = new Map<string, string>();
  const host: Record<string, unknown> = {
    currentRoute: "",
    maxPageStack: 3,
    tabPages: ["pages/tab/a", "pages/tab/b"],
    emit(json: string) {
      messages.push(JSON.parse(String(json)) as SdkMessage);
    },
    sync(method: string, paramsJson: string) {
      const params = JSON.parse(String(paramsJson)) as Record<string, unknown>;
      if (method === "wx.setStorageSync") {
        store.set(String(params.key), JSON.stringify(params.data));
        return JSON.stringify({ ok: true, result: {} });
      }
      if (method === "wx.getStorageSync") {
        const raw = store.get(String(params.key));
        return JSON.stringify({ ok: true, result: raw === undefined ? "" : (JSON.parse(raw) as unknown) });
      }
      if (method === "wx.getSystemInfoSync") {
        return JSON.stringify({ ok: true, result: { theme: "dark", SDKVersion: "3.18.1", windowWidth: 390 } });
      }
      return JSON.stringify({ ok: false, error: { code: "API_UNSUPPORTED", message: "no" } });
    },
  };
  engine.defineGlobal("__qchatHost", host);
  const installed = engine.evaluate(SDK_SOURCE, "qchat-sdk.js");
  assert.equal(installed.ok, true, installed.error?.message);

  function evaluate(source: string): void {
    const result = engine.evaluate(source, "test.js");
    assert.equal(result.ok, true, result.error?.message);
  }

  return {
    engine,
    messages,
    store,
    host,
    evaluate,
    read<T>(expression: string): T {
      const result = engine.evaluate(expression, "read.js");
      assert.equal(result.ok, true, result.error?.message);
      return result.value as T;
    },
    respond(id, response) {
      const result = engine.call("__qchatResponse", [JSON.stringify({ id, ...response })]);
      assert.equal(result.ok, true, result.error?.message);
    },
  };
}

function definePage(h: Harness, route: string, body: string): void {
  h.host.currentRoute = route;
  h.evaluate(`Page(${body});`);
  h.host.currentRoute = "";
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/** Values from the engine belong to another realm; compare their data only. */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

test("wx exists and the synchronous APIs answer inside the engine", () => {
  const h = createHarness();

  assert.equal(h.read<boolean>("typeof wx === 'object' && typeof wx.navigateTo === 'function'"), true);
  h.evaluate(`wx.setStorageSync("profile", { name: "Ada", n: 2 });`);
  assert.deepEqual(h.store.get("profile"), '{"name":"Ada","n":2}');
  assert.deepEqual(plain(h.read(`wx.getStorageSync("profile")`)), { name: "Ada", n: 2 });
  assert.equal(h.read(`wx.getStorageSync("missing")`), "");

  const info = h.read<Record<string, unknown>>("wx.getSystemInfoSync()");
  assert.equal(info.theme, "dark");
  assert.equal(info.SDKVersion, "3.18.1");
  assert.equal(info.windowWidth, 390);
});

test("wx.navigateTo posts a typed request and resolves through success and Promise", async () => {
  const h = createHarness();

  h.evaluate(`
    globalThis.__out = "pending";
    globalThis.__success = null;
    wx.navigateTo({
      url: "/pages/about/about?x=1",
      success: function (result) { globalThis.__success = result; },
    }).then(function (result) { globalThis.__out = { ok: true, result: result }; }, function (error) {
      globalThis.__out = { ok: false, error: error };
    });
  `);

  const request = h.messages.at(-1);
  assert.equal(request?.kind, "bridge.request");
  assert.equal(request?.payload.method, "wx.navigateTo");
  assert.deepEqual(request?.payload.params, { url: "/pages/about/about?x=1" });

  h.respond(String(request?.payload.id), { ok: true, result: { errMsg: "wx.navigateTo:ok" } });
  await settle();

  assert.deepEqual(plain(h.read(`globalThis.__out`)), { ok: true, result: { errMsg: "wx.navigateTo:ok" } });
  assert.deepEqual(plain(h.read(`globalThis.__success`)), { errMsg: "wx.navigateTo:ok" });
});

test("wx.navigateTo rejects the Promise and calls fail", async () => {
  const h = createHarness();

  h.evaluate(`
    globalThis.__out = "pending";
    globalThis.__fail = null;
    wx.navigateTo({ url: "/pages/missing/missing", fail: function (error) { globalThis.__fail = error; } })
      .then(function () { globalThis.__out = "resolved"; }, function (error) { globalThis.__out = { ok: false, error: error }; });
  `);

  const request = h.messages.at(-1);
  h.respond(String(request?.payload.id), { ok: false, error: { code: "NAVIGATION_INVALID_ROUTE", message: "No such route." } });
  await settle();

  assert.deepEqual(plain(h.read(`globalThis.__out`)), {
    ok: false,
    error: { code: "NAVIGATION_INVALID_ROUTE", message: "No such route." },
  });
  assert.deepEqual(plain(h.read(`globalThis.__fail`)), { code: "NAVIGATION_INVALID_ROUTE", message: "No such route." });
});

test("wx.navigateBack defaults delta and sends the given value", () => {
  const h = createHarness();

  h.evaluate(`wx.navigateBack();`);
  assert.deepEqual(h.messages.at(-1)?.payload.params, {});
  h.evaluate(`wx.navigateBack({ delta: 2 });`);
  assert.deepEqual(h.messages.at(-1)?.payload.params, { delta: 2 });
});

test("wx.request sends method, data and headers", () => {
  const h = createHarness();

  h.evaluate(`
    wx.request({ url: "https://api.example.com/x", method: "POST", data: { a: 1 }, header: { "x-token": "t" }, timeout: 500 });
  `);
  const request = h.messages.at(-1);
  assert.equal(request?.payload.method, "wx.request");
  assert.deepEqual(request?.payload.params, {
    url: "https://api.example.com/x",
    method: "POST",
    data: { a: 1 },
    header: { "x-token": "t" },
    timeout: 500,
  });
});

test("wx.showToast and wx.showModal carry their options", () => {
  const h = createHarness();

  h.evaluate(`wx.showToast({ title: "Saved", icon: "success" });`);
  assert.deepEqual(h.messages.at(-1)?.payload.params, { title: "Saved", icon: "success" });

  h.evaluate(`wx.showModal({ title: "Delete?", content: "Sure?", showCancel: false });`);
  assert.deepEqual(h.messages.at(-1)?.payload.params, { title: "Delete?", content: "Sure?", showCancel: false });
});

test("navigation primitive: open, redirect, reLaunch and switchTab with lifecycle", () => {
  const h = createHarness();
  h.evaluate(`globalThis.__log = [];`);
  definePage(h, "pages/a/a", `{ onLoad: function (q) { __log.push("load a:" + (q.x || "")); }, onShow: function () { __log.push("show a"); }, onHide: function () { __log.push("hide a"); }, onUnload: function () { __log.push("unload a"); } }`);
  definePage(h, "pages/b/b", `{ onLoad: function () { __log.push("load b"); }, onHide: function () { __log.push("hide b"); }, onUnload: function () { __log.push("unload b"); } }`);
  definePage(h, "pages/c/c", `{ onLoad: function () { __log.push("load c"); }, onUnload: function () { __log.push("unload c"); } }`);
  definePage(h, "pages/tab/a", `{ onLoad: function () { __log.push("load tab"); }, onShow: function () { __log.push("show tab"); }, onUnload: function () { __log.push("unload tab"); } }`);

  const open = h.engine.call("__qchatOpenPage", ["pages/a/a", { x: "1" }, "p1"]);
  assert.equal(open.ok, true);
  assert.deepEqual(plain(h.read("__log")), ["load a:1", "show a"]);
  assert.equal(h.messages.at(-1)?.kind, "page.open");

  const redirect = h.engine.call("__qchatNavigate", ["redirect", "pages/b/b", {}, "p2"]);
  assert.equal(redirect.ok, true);
  assert.deepEqual(plain(h.read("__log")), ["load a:1", "show a", "hide a", "unload a", "load b"]);
  assert.deepEqual(h.messages.slice(-2).map((m) => m.kind), ["page.close", "page.open"]);

  const relaunch = h.engine.call("__qchatNavigate", ["reLaunch", "pages/c/c", {}, "p3"]);
  assert.equal(relaunch.ok, true);
  assert.deepEqual(plain(h.read<string[]>("__log").slice(-3)), ["hide b", "unload b", "load c"]);

  const tab = h.engine.call("__qchatNavigate", ["switchTab", "pages/tab/a", {}, "p4"]);
  assert.equal(tab.ok, true);
  assert.equal((tab.value as { pageId: string }).pageId, "p4");
  assert.equal(h.messages.at(-1)?.kind, "page.open");

  const backToTab = h.engine.call("__qchatNavigate", ["switchTab", "pages/tab/a", {}, "p5"]);
  assert.equal(backToTab.ok, true);
  assert.equal((backToTab.value as { pageId: string }).pageId, "p4", "the tab page is reused");
  assert.equal(h.messages.at(-1)?.kind, "page.show");

  const pages = h.read<Array<{ route: string }>>("getCurrentPages().map(function (p) { return { route: p.route }; })");
  assert.deepEqual(plain(pages), [{ route: "pages/tab/a" }]);
});

test("navigation primitive: stack limit and unknown routes", () => {
  const h = createHarness();
  definePage(h, "pages/a/a", `{}`);
  definePage(h, "pages/b/b", `{}`);

  assert.equal(h.engine.call("__qchatOpenPage", ["pages/a/a", {}, "p1"]).ok, true);
  assert.equal(h.engine.call("__qchatNavigate", ["open", "pages/b/b", {}, "p2"]).ok, true);
  assert.equal(h.engine.call("__qchatNavigate", ["open", "pages/a/a", {}, "p3"]).ok, true);
  const fourth = h.engine.call("__qchatNavigate", ["open", "pages/b/b", {}, "p4"]);
  assert.equal(fourth.ok, true);
  assert.equal((fourth.value as { ok: boolean; code?: string }).ok, false);
  assert.equal((fourth.value as { code?: string }).code, "NAVIGATION_STACK_LIMIT");

  const unknown = h.engine.call("__qchatNavigate", ["open", "pages/none/none", {}, "p5"]);
  assert.equal((unknown.value as { code?: string }).code, "NAVIGATION_INVALID_ROUTE");

  const notTab = h.engine.call("__qchatNavigate", ["switchTab", "pages/a/a", {}, "p6"]);
  assert.equal((notTab.value as { code?: string }).code, "NAVIGATION_NO_TAB_BAR");
});

test("back: unloads the top page and shows the previous one", () => {
  const h = createHarness();
  h.evaluate(`globalThis.__log = [];`);
  definePage(h, "pages/a/a", `{ onShow: function () { __log.push("show a"); } }`);
  definePage(h, "pages/b/b", `{ onUnload: function () { __log.push("unload b"); } }`);

  h.engine.call("__qchatOpenPage", ["pages/a/a", {}, "p1"]);
  h.engine.call("__qchatNavigate", ["open", "pages/b/b", {}, "p2"]);
  const back = h.engine.call("__qchatBack", [1]);
  assert.equal(back.ok, true);
  assert.deepEqual(plain(h.read("__log")), ["show a", "unload b", "show a"]);
  assert.deepEqual(h.messages.slice(-2).map((m) => m.kind), ["page.close", "page.show"]);
  assert.equal(h.messages.at(-1)?.payload.pageId, "p1");

  const tooFar = h.engine.call("__qchatBack", [1]);
  assert.equal((tooFar.value as { code?: string }).code, "NAVIGATION_STACK_LIMIT");
});
