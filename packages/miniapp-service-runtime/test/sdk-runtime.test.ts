import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createNodeEngine,
  createSdkRuntime,
  resolveModulePath,
  type SdkMessage,
} from "../src/index.js";

const SOURCES: Record<string, string> = {
  "app.js": `
    App({
      onLaunch: function (options) { globalThis.__launchPath = options.path; },
      onHide: function () { globalThis.__appHidden = true; }
    });
  `,
  "utils/count.js": `
    module.exports = { increment: function (n) { return n + 1; } };
  `,
  "pages/index/index.js": `
    var count = require("../../utils/count");
    Page({
      data: { count: 0, title: "Hello" },
      onLoad: function (query) { this.from = query.from || ""; },
      onTap: function () { this.setData({ count: count.increment(this.data.count) }); },
      onAsk: function () {
        var self = this;
        globalThis.__qchatCall("wx.showToast", { title: "hi" }).then(
          function (result) { self.setData({ answer: result.value }); },
          function (error) { self.setData({ failed: error.code }); }
        );
      },
      onAskPrivate: function () {
        var self = this;
        globalThis.__qchatCall("wx.privateApi", {}).then(
          function () { self.setData({ leaked: true }); },
          function (error) { self.setData({ failed: error.code }); }
        );
      },
      onUnload: function () { globalThis.__unloaded = true; }
    });
  `,
  "pages/evil/evil.js": `
    require("../../../../secret");
    Page({ data: {}, render: function () {} });
  `,
};

function setup(allowlist: readonly string[] = ["wx.showToast"]) {
  const engine = createNodeEngine();
  const messages: SdkMessage[] = [];
  const requests: Array<{ id: string; method: string; params: Record<string, unknown> }> = [];
  const runtime = createSdkRuntime({
    engine,
    source: { read: (path) => SOURCES[path] ?? null },
    allowlist,
    onMessage: (message) => messages.push(message),
    onRequest: (request) => requests.push(request),
  });
  return { engine, runtime, messages, requests };
}

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

test("installs the SDK once and loads App", () => {
  const { engine, runtime } = setup();
  assert.equal(runtime.install().ok, true);
  assert.equal(engine.evaluate("typeof App", "check.js").value, "function");
  assert.equal(engine.evaluate("typeof Page", "check.js").value, "function");
  assert.equal(engine.evaluate("typeof getApp", "check.js").value, "function");
  assert.equal(engine.evaluate("typeof getCurrentPages", "check.js").value, "function");
  assert.equal(runtime.loadApp().ok, true);
  assert.equal(runtime.appLaunch({ path: "pages/index/index" }).ok, true);
  assert.equal(engine.evaluate("globalThis.__launchPath", "check.js").value, "pages/index/index");
});

test("loads a page module and its relative dependency", () => {
  const { runtime } = setup();
  const result = runtime.loadPage("pages/index/index");
  assert.equal(result.ok, true, JSON.stringify(result.error));
  assert.deepEqual(runtime.loader.loaded(), ["utils/count.js", "pages/index/index.js"]);
  // A second load is served from the cache.
  assert.equal(runtime.loadPage("pages/index/index").ok, true);
  assert.equal(runtime.loader.loaded().length, 2);
});

test("opens a page, receives setData and closes it", () => {
  const { engine, runtime, messages } = setup();
  runtime.loadApp();
  runtime.loadPage("pages/index/index");
  const opened = runtime.open("pages/index/index", { from: "test" }, "p1");
  assert.equal(opened.ok, true, JSON.stringify(opened.error));
  assert.deepEqual(messages[0].kind, "page.open");
  assert.deepEqual(messages[0].payload, { pageId: "p1", route: "pages/index/index", data: { count: 0, title: "Hello" } });

  const delivered = runtime.deliver({ handler: "onTap", type: "tap", detail: {} });
  assert.equal(delivered.ok, true, JSON.stringify(delivered.error));
  assert.deepEqual(messages[1].kind, "page.setData");
  assert.deepEqual(messages[1].payload, { pageId: "p1", patch: { count: 1 }, data: { count: 1, title: "Hello" } });

  const direct = runtime.setData({ "title": "Changed" });
  assert.equal(direct.ok, true);
  assert.deepEqual(messages[2].payload, { pageId: "p1", patch: { title: "Changed" }, data: { count: 1, title: "Changed" } });

  assert.equal(runtime.closePage("p1").ok, true);
  assert.equal(engine.evaluate("globalThis.__unloaded === true", "check.js").value, true);
  assert.equal(messages[3].kind, "page.close");
});

test("an unknown handler is reported, never ignored", () => {
  const { runtime } = setup();
  runtime.loadApp();
  runtime.loadPage("pages/index/index");
  runtime.open("pages/index/index", {}, "p1");
  const result = runtime.deliver({ handler: "nope" });
  assert.equal(result.ok, true);
  // The SDK returns a structured failure instead of throwing.
  assert.equal((result.value as { ok: boolean }).ok, false);
});

test("a require that escapes the package is rejected", () => {
  const { runtime } = setup();
  const result = runtime.loadPage("pages/evil/evil");
  assert.equal(result.ok, false);
  assert.equal(result.error?.code, "RUNTIME_SCRIPT_ERROR");
});

test("module paths resolve relative to the requiring module", () => {
  assert.equal(resolveModulePath("pages/index/index.js", "../../utils/count"), "utils/count.js");
  assert.equal(resolveModulePath("pages/index/index.js", "./helper"), "pages/index/helper.js");
  assert.equal(resolveModulePath("pages/index/index.js", "../../../escape"), null);
  assert.equal(resolveModulePath("pages/index/index.js", "node_modules/x"), null);
  assert.equal(resolveModulePath("pages/index/index.js", "/abs"), null);
});

test("a page call reaches the host and its response resolves the promise", async () => {
  const { runtime, messages, requests } = setup();
  runtime.loadApp();
  runtime.loadPage("pages/index/index");
  runtime.open("pages/index/index", {}, "p1");
  const delivered = runtime.deliver({ handler: "onAsk" });
  assert.equal(delivered.ok, true, JSON.stringify(delivered.error));
  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, "wx.showToast");
  assert.deepEqual(requests[0].params, { title: "hi" });
  const requestMessage = messages.find((message) => message.kind === "bridge.request");
  assert.ok(requestMessage);
  assert.equal(requestMessage.payload.id, "s1");

  assert.equal(runtime.respond("s1", { ok: true, result: { value: 7 } }).ok, true);
  await tick();
  const update = messages.filter((message) => message.kind === "page.setData").pop();
  assert.deepEqual(update?.payload.patch, { answer: 7 });
});

test("a method outside the allowlist is answered with an error, not sent", async () => {
  const { runtime, messages, requests } = setup();
  runtime.loadApp();
  runtime.loadPage("pages/index/index");
  runtime.open("pages/index/index", {}, "p1");
  runtime.deliver({ handler: "onAskPrivate" });
  assert.equal(requests.length, 0);
  await tick();
  const update = messages.filter((message) => message.kind === "page.setData").pop();
  assert.deepEqual(update?.payload.patch, { failed: "BRIDGE_UNKNOWN_METHOD" });
});

test("closing rejects every pending call", async () => {
  const { runtime, messages } = setup();
  runtime.loadApp();
  runtime.loadPage("pages/index/index");
  runtime.open("pages/index/index", {}, "p1");
  runtime.deliver({ handler: "onAsk" });
  assert.equal(runtime.rejectCalls().ok, true);
  await tick();
  const update = messages.filter((message) => message.kind === "page.setData").pop();
  assert.deepEqual(update?.payload.patch, { failed: "BRIDGE_PAGE_CLOSED" });
});

test("navigateBack closes the top page and shows the previous one", () => {
  const { runtime, messages } = setup();
  runtime.loadApp();
  runtime.loadPage("pages/index/index");
  runtime.open("pages/index/index", {}, "p1");
  runtime.open("pages/index/index", {}, "p2");
  const result = runtime.back(1);
  assert.equal(result.ok, true, JSON.stringify(result.error));
  assert.equal((result.value as { pageId: string }).pageId, "p1");
  assert.equal(messages.filter((message) => message.kind === "page.close").length, 1);
  assert.equal(messages.filter((message) => message.kind === "page.show").length, 1);
});

test("a forbidden setData path throws inside the page handler", () => {
  const { runtime } = setup();
  runtime.loadApp();
  runtime.loadPage("pages/index/index");
  runtime.open("pages/index/index", {}, "p1");
  const result = runtime.setData({ "__proto__.polluted": true });
  assert.equal(result.ok, false);
  assert.equal(result.error?.code, "RUNTIME_SCRIPT_ERROR");
});
