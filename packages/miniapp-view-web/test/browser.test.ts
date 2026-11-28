import assert from "node:assert/strict";
import { test } from "node:test";
import type { BridgeEvent } from "@qchat/miniapp-contracts";
import {
  createFakePage,
  FakeEvent,
  installBrowserView,
  VIEW_ROOT_ID,
  type BrowserViewHandle,
  type BrowserWindowLike,
  type FakeElement,
} from "../src/index.js";

const binding = { appId: "app1", sessionId: "s1", pageId: "p1" };

interface FakeWindow extends BrowserWindowLike {
  document: ReturnType<typeof createFakePage>["document"];
  root: FakeElement;
  sent: BridgeEvent[];
}

function createWindow(): FakeWindow {
  const page = createFakePage();
  const sent: BridgeEvent[] = [];
  return {
    document: page.document,
    root: page.root,
    sent,
    qchatViewBridge: {
      postMessage(message: string): void {
        sent.push(JSON.parse(message) as BridgeEvent);
      },
    },
  };
}

function parse(result: string): { ok: boolean; status?: string; error?: { code: string; message: string } } {
  return JSON.parse(result) as { ok: boolean; status?: string; error?: { code: string; message: string } };
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
        props: {},
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

function message(event: string, payload: Record<string, unknown>): string {
  return JSON.stringify({ v: 1, kind: "event", ...binding, event, payload });
}

test("installs one handle and starts with the host binding", () => {
  const win = createWindow();
  const handle = installBrowserView(win);
  assert.equal(win.__qchatView, handle);
  assert.equal(installBrowserView(win), handle, "a second install must not replace a live page");

  const result = parse(handle.start(JSON.stringify(binding)));
  assert.equal(result.ok, true);
  assert.equal(result.status, "ready");
  assert.equal(win.sent[0].event, "view.ready");
});

test("a second start is refused", () => {
  const win = createWindow();
  const handle = installBrowserView(win);
  assert.equal(parse(handle.start(JSON.stringify(binding))).ok, true);
  const second = parse(handle.start(JSON.stringify(binding)));
  assert.equal(second.ok, false);
  assert.equal(second.error?.code, "BRIDGE_INVALID_MESSAGE");
});

test("start refuses a missing root, a missing channel and an invalid binding", () => {
  const noRoot = createWindow();
  noRoot.document.unregister(VIEW_ROOT_ID);
  const noRootHandle = installBrowserView(noRoot);
  assert.equal(parse(noRootHandle.start(JSON.stringify(binding))).error?.code, "RUNTIME_CRASH");

  const noChannel = createWindow();
  delete noChannel.qchatViewBridge;
  const noChannelHandle = installBrowserView(noChannel);
  assert.equal(parse(noChannelHandle.start(JSON.stringify(binding))).error?.code, "RUNTIME_CRASH");

  const badBinding = createWindow();
  const badBindingHandle = installBrowserView(badBinding);
  assert.equal(parse(badBindingHandle.start(JSON.stringify({ ...binding, pageId: "page-1" }))).error?.code, "BRIDGE_INVALID_MESSAGE");
});

test("receive before start is refused", () => {
  const win = createWindow();
  const handle = installBrowserView(win);
  const result = parse(handle.receive(message("view.render", treePayload())));
  assert.equal(result.ok, false);
  assert.equal(result.error?.code, "BRIDGE_INVALID_MESSAGE");
});

test("a root-absolute package URL stays inside the installed version", () => {
  const win = createWindow();
  const handle = installBrowserView(win);
  handle.start(JSON.stringify(binding));
  const rendered = parse(handle.receive(message("view.render", {
    pageId: "p1",
    seq: 1,
    update: {
      kind: "tree",
      theme: "light",
      tree: {
        type: "element",
        tag: "wx-view",
        props: {},
        children: [
          { type: "element", tag: "wx-image", props: { src: "/assets/logo.png" }, children: [] },
          { type: "element", tag: "wx-image", props: { src: "//cdn.example/logo.png" }, children: [] },
        ],
      },
    },
  })));
  assert.equal(rendered.ok, true);
  const root = win.root.children[0] as FakeElement;
  assert.equal((root.children[0] as FakeElement).getAttribute("src"), "./assets/logo.png");
  assert.equal((root.children[1] as FakeElement).getAttribute("src"), "//cdn.example/logo.png");
});

test("the installed handle renders a tree, forwards an event and destroys", () => {
  const win = createWindow();
  const handle: BrowserViewHandle = installBrowserView(win);
  handle.start(JSON.stringify(binding));
  const rendered = parse(handle.receive(message("view.render", treePayload())));
  assert.equal(rendered.ok, true);
  assert.equal(rendered.status, "tree");
  assert.equal(win.root.textContent, "hello");
  assert.equal(win.document.documentElement.getAttribute("data-theme"), "dark");

  const view = win.root.children[0] as FakeElement;
  (view.children[0] as FakeElement).dispatchEvent(new FakeEvent("click"));
  const forwarded = win.sent.find((entry) => entry.event === "view.event");
  assert.equal(forwarded !== undefined, true);
  assert.equal((forwarded?.payload as { handler: string }).handler, "onTap");

  const destroyed = parse(handle.destroy());
  assert.equal(destroyed.ok, true);
  assert.equal(win.root.children.length, 0);
  assert.equal(parse(handle.receive(message("view.render", treePayload()))).error?.code, "BRIDGE_PAGE_CLOSED");
});
