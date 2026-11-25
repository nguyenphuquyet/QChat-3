import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BuiltMiniProgram } from "../src/builder.js";
import {
  bootBuiltApp,
  buildFixture,
  byClass,
  cleanupProjects,
  makeProject,
  type BootedApp,
} from "./helpers.js";

after(cleanupProjects);

const builtinRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../builtin",
);

/// Values created inside jsdom carry jsdom's prototypes, so `deepStrictEqual`
/// rejects them even when the data is identical. Compare plain copies instead.
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type LoggedEvent = { name: string; detail: Record<string, unknown> | null };

/// A WeChat-shaped project that exercises every Phase 2 built-in in one page.
function builtinsProject(): Record<string, string | Buffer> {
  return {
    "app.json": JSON.stringify({
      pages: ["pages/index/index", "pages/detail/detail"],
      window: { navigationBarTitleText: "Built-ins" },
    }),
    "app.js": `App({
  globalData: { events: [] },
  onLaunch() { this.globalData.events.push({ name: "app:onLaunch", detail: {} }); },
  onShow() { this.globalData.events.push({ name: "app:onShow", detail: {} }); },
});\n`,
    "app.wxss": "page { background-color: rgb(12, 34, 56); }\nview { color: rgb(1, 2, 3); }\n",
    "manifest.json": JSON.stringify({ name: "Built-ins", version: "1.0.0" }),
    "pages/index/index.js": `function log(name, detail) {
  getApp().globalData.events.push({ name, detail: detail === undefined ? null : detail });
}
Page({
  data: { text: "", note: "", on: false, count: 0, slider: 20, picked: [] },
  onLoad(query) { log("index:onLoad", query); },
  onShow() { log("index:onShow", {}); },
  onHide() { log("index:onHide", {}); },
  onReady() { log("index:onReady", {}); },
  onUnload() { log("index:onUnload", {}); },
  tap() {
    log("tap", {});
    this.setData({ count: this.data.count + 1 });
  },
  onInput(event) {
    log("input", event.detail);
    this.setData({ text: event.detail.value });
  },
  onNote(event) {
    log("textarea", event.detail);
    this.setData({ note: event.detail.value });
  },
  onSwitch(event) {
    log("switch", event.detail);
    this.setData({ on: event.detail.value });
  },
  onCheckbox(event) {
    log("checkbox", event.detail);
    this.setData({ picked: event.detail.value });
  },
  onRadio(event) {
    log("radio", event.detail);
  },
  onSlider(event) {
    log("slider:" + event.type, event.detail);
    this.setData({ slider: event.detail.value });
  },
  onScroll(event) { log("scroll", event.detail); },
  onLower(event) { log("scrolltolower", event.detail); },
  onUpper(event) { log("scrolltoupper", event.detail); },
});\n`,
    "pages/index/index.json": JSON.stringify({}),
    "pages/index/index.wxml": `<view id="root">
  <text id="txt">hello</text>
  <button id="btn" type="primary" bindtap="tap">tap</button>
  <button id="dis" disabled bindtap="tap">disabled</button>
  <image id="img" src="images/pic.png" mode="aspectFill" />
  <scroll-view id="sv" scroll-y lower-threshold="10" bindscroll="onScroll" bindscrolltolower="onLower" bindscrolltoupper="onUpper">
    <view id="inner" style="height: 300px">body</view>
  </scroll-view>
  <input id="inp" value="{{text}}" bindinput="onInput" />
  <input id="model" model:value="{{text}}" />
  <textarea id="ta" value="{{note}}" bindinput="onNote" />
  <switch id="sw" checked="{{on}}" bindchange="onSwitch" />
  <checkbox-group id="cg" bindchange="onCheckbox">
    <checkbox value="a" checked>A</checkbox>
    <checkbox value="b">B</checkbox>
  </checkbox-group>
  <radio-group id="rg" bindchange="onRadio">
    <radio value="x">X</radio>
    <radio value="y">Y</radio>
  </radio-group>
  <slider id="sl" value="{{slider}}" step="10" bindchanging="onSlider" bindchange="onSlider" />
  <navigator id="nav" url="/pages/detail/detail?id=1" open-type="navigate">go</navigator>
  <progress id="pr" percent="40" />
</view>\n`,
    "pages/index/index.wxss": ".page { padding: 20px; }\n",
    "pages/index/images/pic.png": Buffer.from("89504e470d0a1a0a", "hex"),
    "pages/detail/detail.js": `function log(name, detail) {
  getApp().globalData.events.push({ name, detail: detail === undefined ? null : detail });
}
Page({
  data: { id: "" },
  onLoad(query) {
    log("detail:onLoad", query);
    this.setData({ id: query.id || "" });
  },
  onShow() { log("detail:onShow", {}); },
  onReady() { log("detail:onReady", {}); },
  onUnload() { log("detail:onUnload", {}); },
});\n`,
    "pages/detail/detail.json": JSON.stringify({}),
    "pages/detail/detail.wxml": '<view id="detail">detail {{id}}</view>\n',
  };
}

async function bootBuiltins(): Promise<{ app: BootedApp; built: BuiltMiniProgram }> {
  const built = await buildFixture(await makeProject(builtinsProject()));
  const app = await bootBuiltApp(built);
  return { app, built };
}

function events(app: BootedApp): LoggedEvent[] {
  const instance = app.window.getApp as () => { globalData: { events: LoggedEvent[] } };
  return instance().globalData.events;
}

function find(app: BootedApp, name: string): LoggedEvent[] {
  return events(app).filter((event) => event.name === name);
}

function last(app: BootedApp, name: string): LoggedEvent {
  const matching = find(app, name);
  assert.ok(matching.length > 0, `expected a ${name} event, saw ${events(app).map((event) => event.name).join(", ")}`);
  return matching[matching.length - 1]!;
}

function pageData(app: BootedApp): Record<string, unknown> {
  const getCurrentPages = app.window.getCurrentPages as () => Array<{ data: Record<string, unknown> }>;
  const pages = getCurrentPages();
  assert.ok(pages.length > 0, "expected a mounted page");
  return pages[pages.length - 1]!.data;
}

describe("Phase 2 built-in components", () => {
  it("renders every built-in as a wx host with native internals", async () => {
    const { app } = await bootBuiltins();
    const query = (selector: string): Element | null => app.document.querySelector(selector);

    assert.equal(query("#root")?.tagName, "WX-VIEW");
    assert.equal(query("#txt")?.tagName, "WX-TEXT");
    assert.equal(query("#txt")?.textContent, "hello");
    assert.equal(query("#btn")?.tagName, "WX-BUTTON");
    assert.ok(query("#btn button"), "button renders a native button");
    assert.match(query("#btn")?.getAttribute("class") ?? "", /qchat-button--primary/);
    assert.match(query("#dis")?.getAttribute("class") ?? "", /qchat-button--disabled/);

    const image = query("#img img");
    assert.ok(image, "image renders a native img");
    assert.equal(image?.getAttribute("src"), "/assets/pages/index/images/pic.png");

    assert.ok(query("#sv [class*='qchat-scroll-view__body']"), "scroll-view renders a scroll body");
    assert.ok(query("#inp input"), "input renders a native input");
    assert.ok(query("#model input"), "model input renders a native input");
    assert.ok(query("#ta textarea"), "textarea renders a native textarea");
    assert.ok(query("#sw > span"), "switch renders a native track");
    assert.equal(query("#cg wx-checkbox")?.tagName, "WX-CHECKBOX");
    assert.equal(query("#rg wx-radio")?.tagName, "WX-RADIO");
    assert.ok(query("#sl [class*='qchat-slider__track']"), "slider renders a native track");
    assert.ok(query("#nav > span"), "navigator renders a native anchor");
    assert.equal(query("#pr")?.tagName, "WX-PROGRESS");
    assert.match(
      query("#pr [class*='qchat-progress__fill']")?.getAttribute("style") ?? "",
      /width:\s*40%/,
    );

    // Built-in internals never reference another Mini Program-only tag. The
    // native `input`, `textarea` and `button` tags are the editing/control
    // primitives, so they are not in the forbidden list.
    const forbidden = /<(view|text|image|scroll-view|switch|checkbox|checkbox-group|radio|radio-group|slider|navigator|progress)(?=[\s/>])/;
    for (const name of ["view", "text", "button", "image", "scroll-view", "input", "textarea", "switch", "checkbox", "checkbox-group", "radio", "radio-group", "slider", "navigator", "progress"]) {
      const template = await readFile(path.join(builtinRoot, name, `${name}.wxml`), "utf8");
      assert.doesNotMatch(
        template,
        forbidden,
        `built-in ${name}.wxml must not reference another Mini Program tag`,
      );
    }

    await app.dispose();
  });

  it("emits WeChat-shaped input, change, slider and scroll events", async () => {
    const { app } = await bootBuiltins();
    const query = (selector: string): Element | null => app.document.querySelector(selector);

    // Page lifecycle: load, show, ready in order.
    assert.deepEqual(
      Array.from(events(app), (event) => event.name),
      ["app:onLaunch", "app:onShow", "index:onLoad", "index:onShow", "index:onReady"],
    );

    // input: detail carries the value and cursor, and the page receives it.
    app.input(query("#inp input") as HTMLInputElement, "hello");
    await app.settle();
    assert.deepEqual(plain(last(app, "input").detail), { value: "hello", cursor: 5, keyCode: 0 });
    assert.equal(pageData(app).text, "hello");

    // model:value writes the edit back into page data.
    app.input(query("#model input") as HTMLInputElement, "hey");
    await app.settle();
    assert.equal(pageData(app).text, "hey");
    assert.equal((query("#inp input") as HTMLInputElement).value, "hey");

    // textarea re-emits the same shape.
    app.input(query("#ta textarea") as HTMLTextAreaElement, "note!");
    await app.settle();
    assert.equal(last(app, "textarea").detail?.value, "note!");
    assert.equal(pageData(app).note, "note!");

    // switch toggles and reports {value}.
    app.tap(query("#sw > span"));
    await app.settle();
    assert.deepEqual(plain(last(app, "switch").detail), { value: true });
    assert.equal(pageData(app).on, true);

    // checkbox-group aggregates the checked children.
    const checkboxes = app.document.querySelectorAll("#cg wx-checkbox");
    assert.equal(checkboxes.length, 2);
    app.tap(checkboxes[1]?.querySelector("span") ?? null);
    await app.settle();
    assert.deepEqual(plain(last(app, "checkbox").detail), { value: ["a", "b"] });
    assert.deepEqual(plain(pageData(app).picked), ["a", "b"]);

    // radio-group reports the newly selected value.
    const radios = app.document.querySelectorAll("#rg wx-radio");
    assert.equal(radios.length, 2);
    app.tap(radios[1]?.querySelector("span") ?? null);
    await app.settle();
    assert.deepEqual(plain(last(app, "radio").detail), { value: "y" });

    // slider emits changing while dragging and change on release.
    const track = query("#sl [class*='qchat-slider__track']") as HTMLElement;
    assert.ok(track);
    Object.defineProperty(track, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 0, width: 100, top: 0, height: 10, right: 100, bottom: 10, x: 0, y: 0 }),
    });
    track.dispatchEvent(new app.window.MouseEvent("mousedown", { bubbles: true, clientX: 75, clientY: 5 }));
    app.document.dispatchEvent(new app.window.MouseEvent("mouseup", { bubbles: true, clientX: 75, clientY: 5 }));
    await app.settle();
    assert.deepEqual(plain(last(app, "slider:changing").detail), { value: 80 });
    assert.deepEqual(plain(last(app, "slider:change").detail), { value: 80 });
    assert.equal(pageData(app).slider, 80);

    // scroll-view re-emits scroll with the WeChat detail and the lower latch.
    const body = query("#sv [class*='qchat-scroll-view__body']") as HTMLElement;
    assert.ok(body);
    Object.defineProperty(body, "scrollHeight", { configurable: true, value: 200 });
    Object.defineProperty(body, "clientHeight", { configurable: true, value: 100 });
    body.scrollTop = 100;
    body.dispatchEvent(new app.window.Event("scroll", { bubbles: false }));
    await app.settle();
    assert.deepEqual(plain(last(app, "scroll").detail), {
      scrollTop: 100,
      scrollLeft: 0,
      scrollHeight: 200,
      scrollWidth: 0,
      deltaX: 0,
      deltaY: -100,
    });
    assert.deepEqual(plain(last(app, "scrolltolower").detail), { direction: "bottom" });

    // button: a tap reaches the author handler, a disabled one does not.
    app.tap(query("#btn button"));
    await app.settle();
    assert.equal(find(app, "tap").length, 1);
    assert.equal(pageData(app).count, 1);
    app.tap(query("#dis button"));
    await app.settle();
    assert.equal(find(app, "tap").length, 1);
    assert.equal(pageData(app).count, 1);

    await app.dispose();
  });

  it("navigates with navigator and unwinds the stack with wx.navigateBack", async () => {
    const { app } = await bootBuiltins();
    const query = (selector: string): Element | null => app.document.querySelector(selector);

    assert.equal((app.window.getCurrentPages as () => unknown[])().length, 1);
    app.tap(query("#nav > span"));
    await app.settle(20);

    assert.equal(app.window.location.pathname, "/token/pages/detail/detail");
    assert.equal(app.window.location.search, "?id=1");
    assert.equal(query("#detail")?.tagName, "WX-VIEW");
    assert.equal(query("#detail")?.textContent, "detail 1");
    assert.equal((app.window.getCurrentPages as () => unknown[])().length, 2);
    assert.deepEqual(plain(last(app, "detail:onLoad").detail), { id: "1" });
    assert.equal(find(app, "index:onHide").length, 1);
    // The first page is hidden, not unmounted.
    const firstPage = query("#root")?.closest("wx-page");
    assert.match(firstPage?.getAttribute("style") ?? "", /display:\s*none/);

    (app.window.wx as { navigateBack: (options: { delta: number }) => void }).navigateBack({ delta: 1 });
    await app.settle(30);

    assert.equal(app.window.location.pathname, "/token/index.html");
    assert.equal(query("#detail"), null);
    assert.equal(find(app, "detail:onUnload").length, 1);
    assert.equal(find(app, "index:onShow").length, 2);
    assert.equal((app.window.getCurrentPages as () => unknown[])().length, 1);

    await app.dispose();
  });

  it("applies page and view CSS to the wx hosts", async () => {
    const built = await buildFixture(await makeProject(builtinsProject()));
    const css = built.appWxss.toString("utf8");
    assert.match(css, /wx-page\{/);
    assert.match(css, /wx-view\{/);

    const app = await bootBuiltApp(built, { styles: css });
    const page = app.document.querySelector("wx-page");
    assert.ok(page);
    const pageStyle = app.window.getComputedStyle(page);
    assert.equal(pageStyle.display, "block");
    assert.equal(pageStyle.backgroundColor, "rgb(12, 34, 56)");

    const root = app.document.querySelector("#root");
    assert.ok(root);
    assert.equal(app.window.getComputedStyle(root).color, "rgb(1, 2, 3)");

    // Component styles stay class-scoped: the rendered switch class carries a
    // style-scope prefix, so author CSS cannot accidentally match it by name.
    const switchRoot = byClass(app.document, "qchat-switch");
    assert.ok(switchRoot);
    assert.match(switchRoot?.getAttribute("class") ?? "", /\b[A-Z]--qchat-switch\b/);

    await app.dispose();
  });
});
