import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BuiltMiniProgram } from "../src/builder.js";
import { bootBuiltApp, buildFixture, cleanupProjects, type BootedApp } from "./helpers.js";

after(cleanupProjects);

const sampleProject = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../miniapp-examples/wechat-demo",
);

function pageData(app: BootedApp): Record<string, unknown> {
  const getCurrentPages = app.window.getCurrentPages as () => Array<{ data: Record<string, unknown> }>;
  const pages = getCurrentPages();
  assert.ok(pages.length > 0, "expected a mounted page");
  return pages[pages.length - 1]!.data;
}

describe("Phase 3 sample: packages/miniapp-examples/wechat-demo", () => {
  it("builds the WeChat-shaped sample into the webapp container", async () => {
    const built: BuiltMiniProgram = await buildFixture(sampleProject);

    assert.equal(built.manifest.name, "QChat WeChat Demo");
    assert.equal(built.manifest.format, "webapp");
    assert.equal(built.manifest.schemaVersion, 3);
    assert.deepEqual(
      built.appConfig.pages.map((page) => page.route),
      ["pages/home/home", "pages/form/form", "pages/about/about"],
    );
    assert.deepEqual(
      built.appConfig.components.map((component) => component.id),
      ["components/section/section"],
    );
    assert.deepEqual(
      [...built.manifest.requestedPermissions].sort(),
      ["storage", "toast"],
    );
    assert.ok(built.files.includes("assets/logo.png"));
  });

  it("walks home -> form -> about -> home in the built bundle", async () => {
    const built = await buildFixture(sampleProject);
    const app = await bootBuiltApp(built);
    const query = (selector: string): Element | null => app.document.querySelector(selector);

    // Home: the custom section, built-ins, image asset and progress render.
    assert.equal(query("wx-section")?.tagName, "WX-SECTION");
    assert.match(query("wx-section")?.textContent ?? "", /QChat WeChat Demo/);
    assert.equal(query("#count")?.tagName, "WX-TEXT");
    assert.equal(query("#count")?.textContent, "0 taps");
    assert.equal(
      query("wx-image img")?.getAttribute("src"),
      "/assets/logo.png",
    );
    assert.match(
      query("wx-progress [class*='qchat-progress__fill']")?.getAttribute("style") ?? "",
      /width:\s*30%/,
    );

    // Tap a built-in button and reach the page handler.
    app.tap(query("#inc button"));
    await app.settle();
    assert.equal(query("#count")?.textContent, "1 taps");
    assert.equal(pageData(app).count, 1);

    // scroll-view lower threshold updates the progress bar.
    const body = query("wx-scroll-view [class*='qchat-scroll-view__body']") as HTMLElement;
    assert.ok(body);
    Object.defineProperty(body, "scrollHeight", { configurable: true, value: 400 });
    Object.defineProperty(body, "clientHeight", { configurable: true, value: 200 });
    body.scrollTop = 200;
    body.dispatchEvent(new app.window.Event("scroll", { bubbles: false }));
    await app.settle();
    assert.equal(pageData(app).progress, 100);
    assert.match(
      query("wx-progress [class*='qchat-progress__fill']")?.getAttribute("style") ?? "",
      /width:\s*100%/,
    );

    // Navigate to the form page through the built-in navigator.
    app.tap(query("#to-form > span"));
    await app.settle(20);
    assert.equal(app.window.location.pathname, "/token/pages/form/form");
    assert.equal(query("#name")?.tagName, "WX-INPUT");
    assert.equal((app.window.getCurrentPages as () => unknown[])().length, 2);

    // Drive every form control and submit.
    app.input(query("#name input") as HTMLInputElement, "Ada");
    app.input(query("#note textarea") as HTMLTextAreaElement, "hello from WXML");
    await app.settle();
    assert.equal(pageData(app).name, "Ada");
    assert.equal(pageData(app).note, "hello from WXML");

    app.tap(query("#subscribe > span"));
    await app.settle();
    assert.equal(pageData(app).subscribe, false);

    const checkboxes = app.document.querySelectorAll("#topics wx-checkbox");
    assert.equal(checkboxes.length, 3);
    app.tap(checkboxes[1]?.querySelector("span") ?? null);
    await app.settle();
    assert.deepEqual(
      JSON.parse(JSON.stringify(pageData(app).topics)),
      ["wxml", "wxss"],
    );

    const radios = app.document.querySelectorAll("#plan wx-radio");
    assert.equal(radios.length, 2);
    app.tap(radios[1]?.querySelector("span") ?? null);
    await app.settle();
    assert.equal(pageData(app).plan, "pro");

    const track = query("#volume [class*='qchat-slider__track']") as HTMLElement;
    assert.ok(track);
    Object.defineProperty(track, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 0, width: 100, top: 0, height: 10, right: 100, bottom: 10, x: 0, y: 0 }),
    });
    track.dispatchEvent(new app.window.MouseEvent("mousedown", { bubbles: true, clientX: 70, clientY: 5 }));
    app.document.dispatchEvent(new app.window.MouseEvent("mouseup", { bubbles: true, clientX: 70, clientY: 5 }));
    await app.settle();
    assert.equal(pageData(app).volume, 70);

    app.tap(query("#submit button"));
    await app.settle();
    const result = query("#result")?.textContent ?? "";
    assert.match(result, /name=Ada/);
    assert.match(result, /note=hello from WXML/);
    assert.match(result, /subscribe=false/);
    assert.match(result, /topics=wxml,wxss/);
    assert.match(result, /plan=pro/);
    assert.match(result, /volume=70/);

    // Next -> About shows the submitted state and the page stack size.
    app.tap(query("#to-about > span"));
    await app.settle(20);
    assert.equal(app.window.location.pathname, "/token/pages/about/about");
    assert.equal((app.window.getCurrentPages as () => unknown[])().length, 3);
    assert.match(query("#submitted")?.textContent ?? "", /name=Ada/);
    assert.match(query("#submitted")?.textContent ?? "", /volume=70/);

    // wx.navigateBack({delta:2}) unwinds both pushed pages.
    app.tap(query("#back button"));
    await app.settle(30);
    assert.equal(app.window.location.pathname, "/token/index.html");
    assert.equal((app.window.getCurrentPages as () => unknown[])().length, 1);
    assert.equal(query("#count")?.textContent, "1 taps");

    await app.dispose();
  });
});
