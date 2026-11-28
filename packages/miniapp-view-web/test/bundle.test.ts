import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import type { BridgeEvent } from "@qchat/miniapp-contracts";
import { createFakePage, FakeEvent, type BrowserViewHandle } from "../src/index.js";

const BUNDLE = new URL("../dist/qchat-view.js", import.meta.url);
const binding = { appId: "app1", sessionId: "s1", pageId: "p1" };

interface BundleWindow {
  document: ReturnType<typeof createFakePage>["document"];
  root: ReturnType<typeof createFakePage>["root"];
  sent: BridgeEvent[];
  qchatViewBridge: { postMessage(message: string): void };
  __qchatView?: BrowserViewHandle;
}

function loadBundle(): string {
  try {
    return readFileSync(BUNDLE, "utf8");
  } catch {
    throw new Error("dist/qchat-view.js is missing; run `pnpm --filter @qchat/miniapp-view-web build` first");
  }
}

function evaluate(): BundleWindow {
  const page = createFakePage();
  const sent: BridgeEvent[] = [];
  const win: BundleWindow = {
    document: page.document,
    root: page.root,
    sent,
    qchatViewBridge: {
      postMessage(message: string): void {
        sent.push(JSON.parse(message) as BridgeEvent);
      },
    },
  };
  vm.runInNewContext(loadBundle(), { window: win, TextEncoder, console }, { filename: "qchat-view.js" });
  return win;
}

function treePayload(): Record<string, unknown> {
  return {
    pageId: "p1",
    seq: 1,
    update: {
      kind: "tree",
      theme: "dark",
      tree: {
        type: "element",
        tag: "wx-view",
        props: { class: "page" },
        children: [
          {
            type: "element",
            tag: "wx-button",
            props: {},
            dataset: { id: "1" },
            events: { tap: { handler: "onTap" } },
            children: [{ type: "text", text: "hello" }],
          },
        ],
      },
    },
  };
}

test("the bundle has no runtime dependency, dynamic code or HTML sink", () => {
  const code = loadBundle();
  assert.equal(/^\s*import\s/m.test(code), false, "the bundle must not import");
  assert.equal(/\brequire\s*\(/.test(code), false, "the bundle must not require");
  assert.equal(/\beval\s*\(/.test(code), false, "the bundle must not evaluate strings");
  assert.equal(/\bnew\s+Function\b/.test(code), false, "the bundle must not build functions from strings");
  assert.equal(/\binnerHTML\b/.test(code), false, "the bundle must never write HTML");
  assert.equal(/\bouterHTML\b/.test(code), false);
  assert.equal(/\bdocument\.write\b/.test(code), false);
  assert.equal(/\bfetch\s*\(/.test(code), false, "the view never fetches");
  assert.equal(/\bXMLHttpRequest\b/.test(code), false);
  assert.equal(/\bWebSocket\b/.test(code), false);
});

test("the bundle installs, starts, renders, forwards an event and destroys", () => {
  const win = evaluate();
  const view = win.__qchatView;
  assert.ok(view, "the bundle must install window.__qchatView");

  const started = JSON.parse(view.start(JSON.stringify(binding))) as { ok: boolean; status?: string };
  assert.equal(started.ok, true);
  assert.equal(started.status, "ready");
  assert.equal(win.sent[0].event, "view.ready");

  const rendered = JSON.parse(
    view.receive(
      JSON.stringify({ v: 1, kind: "event", ...binding, event: "view.render", payload: treePayload() }),
    ),
  ) as { ok: boolean; status?: string };
  assert.equal(rendered.ok, true);
  assert.equal(rendered.status, "tree");
  assert.equal(win.root.textContent, "hello");
  assert.equal(win.document.documentElement.getAttribute("data-theme"), "dark");

  const pageView = win.root.children[0] as ReturnType<typeof createFakePage>["root"];
  const button = pageView.children[0] as ReturnType<typeof createFakePage>["root"];
  button.dispatchEvent(new FakeEvent("click"));
  const forwarded = win.sent.find((message) => message.event === "view.event");
  assert.equal(forwarded !== undefined, true);
  assert.equal((forwarded?.payload as { handler: string }).handler, "onTap");

  const destroyed = JSON.parse(view.destroy()) as { ok: boolean; status?: string };
  assert.equal(destroyed.ok, true);
  assert.equal(win.root.children.length, 0);
});
