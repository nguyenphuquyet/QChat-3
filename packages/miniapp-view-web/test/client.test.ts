import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_BRIDGE_MESSAGE_BYTES,
  type BridgeEvent,
  type ElementNode,
} from "@qchat/miniapp-contracts";
import {
  createFakePage,
  createViewClient,
  FakeElement,
  FakeEvent,
  type ViewClient,
  type ViewClientResult,
} from "../src/index.js";

const binding = { appId: "app1", sessionId: "s1", pageId: "p1" };

function ok(result: ViewClientResult): Extract<ViewClientResult, { ok: true }> {
  if (!result.ok) throw new Error(`expected success, got ${result.error.code}: ${result.error.message}`);
  return result;
}

function rejected(result: ViewClientResult): Extract<ViewClientResult, { ok: false }> {
  if (result.ok) throw new Error(`expected a rejection, got ${result.status}`);
  return result;
}

function event(event: string, payload: Record<string, unknown>, overrides: Partial<BridgeEvent> = {}): BridgeEvent {
  return { v: 1, kind: "event", ...binding, event, payload, ...overrides };
}

function tree(seq: number, text: string, theme: "light" | "dark" = "light", pageId = binding.pageId): Record<string, unknown> {
  return {
    pageId,
    seq,
    update: {
      kind: "tree",
      theme,
      tree: {
        type: "element",
        tag: "wx-view",
        props: { class: "page" },
        children: [{ type: "element", tag: "wx-text", props: {}, children: [{ type: "text", text }] }],
      },
    },
  };
}

function interactiveTree(parentCatch: boolean | null = false, childCatch = false): Record<string, unknown> {
  const parent: ElementNode = {
    type: "element",
    tag: "wx-view",
    props: {},
    ...(parentCatch === null ? {} : { events: { tap: { handler: "parent", catch: parentCatch } } }),
    children: [
      {
        type: "element",
        tag: "wx-button",
        props: { type: "primary" },
        dataset: { action: "increment" },
        events: { tap: { handler: "child", catch: childCatch } },
        children: [{ type: "text", text: "add" }],
      },
    ],
  };
  return { pageId: binding.pageId, seq: 1, update: { kind: "tree", theme: "light", tree: parent } };
}

interface Setup {
  document: ReturnType<typeof createFakePage>["document"];
  root: FakeElement;
  sent: BridgeEvent[];
  client: ViewClient;
}

function setup(send?: (message: BridgeEvent) => void): Setup {
  const page = createFakePage();
  const sent: BridgeEvent[] = [];
  const client = createViewClient({
    document: page.document,
    root: page.root,
    binding,
    send: send ?? ((message) => sent.push(message)),
    now: () => 42,
  });
  return { document: page.document, root: page.root, sent, client };
}

function viewEvents(sent: BridgeEvent[]): BridgeEvent[] {
  return sent.filter((message) => message.event === "view.event");
}

test("ready announces the binding the host issued", () => {
  const { sent, client } = setup();
  assert.deepEqual(ok(client.ready()), { ok: true, status: "ready" });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].event, "view.ready");
  assert.equal(sent[0].kind, "event");
  assert.equal(sent[0].appId, binding.appId);
  assert.equal(sent[0].sessionId, binding.sessionId);
  assert.equal(sent[0].pageId, binding.pageId);
});

test("a full tree renders text, attributes and the page-root theme", () => {
  const { document, root, client } = setup();
  assert.deepEqual(ok(client.receive(event("view.render", tree(1, "hello", "dark")))), { ok: true, status: "tree" });
  assert.equal(root.children.length, 1);
  const view = root.children[0] as FakeElement;
  assert.equal(view.tag, "wx-view");
  assert.equal(view.getAttribute("class"), "page");
  assert.equal(view.textContent, "hello");
  assert.equal(document.documentElement.getAttribute("data-theme"), "dark");
  assert.equal(document.documentElement.style.properties.get("color-scheme"), "dark");
  assert.equal(client.seq(), 1);
  assert.equal(client.pageId(), "p1");
});

test("later ops update the same DOM nodes", () => {
  const { document, root, client } = setup();
  ok(client.receive(event("view.render", tree(1, "one"))));
  const view = root.children[0] as FakeElement;
  const text = view.children[0] as FakeElement;

  const payload: Record<string, unknown> = {
    pageId: "p1",
    seq: 2,
    update: { kind: "ops", theme: "dark", ops: [{ op: "setText", path: [0, 0], text: "two" }] },
  };
  assert.deepEqual(ok(client.receive(event("view.render", payload))), { ok: true, status: "ops" });
  assert.equal(root.children[0], view);
  assert.equal(view.children[0], text);
  assert.equal(view.textContent, "two");
  assert.equal(document.documentElement.getAttribute("data-theme"), "dark");
});

test("a stale or duplicate sequence is ignored, never replayed", () => {
  const { root, client } = setup();
  ok(client.receive(event("view.render", tree(2, "first"))));
  assert.deepEqual(ok(client.receive(event("view.render", tree(2, "second")))), { ok: true, status: "ignored" });
  assert.equal(root.textContent, "first");
  assert.deepEqual(
    ok(
      client.receive(
        event("view.render", {
          pageId: "p1",
          seq: 1,
          update: { kind: "ops", theme: "light", ops: [{ op: "setText", path: [0, 0], text: "third" }] },
        }),
      ),
    ),
    { ok: true, status: "ignored" },
  );
  assert.equal(root.textContent, "first");
});

test("ops before a tree are rejected and reported to the host", () => {
  const { root, sent, client } = setup();
  const result = rejected(
    client.receive(
      event("view.render", {
        pageId: "p1",
        seq: 1,
        update: { kind: "ops", theme: "light", ops: [{ op: "setText", path: [0], text: "x" }] },
      }),
    ),
  );
  assert.equal(result.error.code, "BRIDGE_INVALID_MESSAGE");
  assert.equal(root.children.length, 0);
  assert.equal(sent.some((message) => message.event === "view.error"), true);
  assert.equal(client.seq(), 0);
});

test("a render payload for another page is rejected", () => {
  const { root, client } = setup();
  const result = rejected(client.receive(event("view.render", tree(1, "x", "light", "p2"))));
  assert.equal(result.error.code, "BRIDGE_PAGE_MISMATCH");
  assert.equal(root.children.length, 0);
});

test("an envelope bound to another page is rejected before its payload", () => {
  const { client } = setup();
  const result = rejected(client.receive(event("view.render", tree(1, "x"), { pageId: "p2" })));
  assert.equal(result.error.code, "BRIDGE_PAGE_MISMATCH");
});

test("a tap returns to the host with handler, dataset, detail and timestamp", () => {
  const { root, sent, client } = setup();
  ok(client.receive(event("view.render", interactiveTree(null))));
  const view = root.children[0] as FakeElement;
  const button = view.children[0] as FakeElement;
  button.dispatchEvent(new FakeEvent("click", { clientX: 12, clientY: 34 }));

  const events = viewEvents(sent);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0].payload, {
    handler: "child",
    type: "tap",
    detail: { x: 12, y: 34 },
    dataset: { action: "increment" },
    catch: false,
    timeStamp: 42,
  });
});

test("catch stops propagation at the element; bind lets the event bubble", () => {
  const caught = setup();
  ok(caught.client.receive(event("view.render", interactiveTree(false, true))));
  const caughtView = caught.root.children[0] as FakeElement;
  (caughtView.children[0] as FakeElement).dispatchEvent(new FakeEvent("click"));
  assert.deepEqual(
    viewEvents(caught.sent).map((message) => (message.payload as { handler: string }).handler),
    ["child"],
  );

  const bubbled = setup();
  ok(bubbled.client.receive(event("view.render", interactiveTree(false, false))));
  const bubbledView = bubbled.root.children[0] as FakeElement;
  (bubbledView.children[0] as FakeElement).dispatchEvent(new FakeEvent("click"));
  assert.deepEqual(
    viewEvents(bubbled.sent).map((message) => (message.payload as { handler: string }).handler),
    ["child", "parent"],
  );
});

test("an input event reads the component value", () => {
  const { root, sent, client } = setup();
  const payload: Record<string, unknown> = {
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
          {
            type: "element",
            tag: "wx-input",
            props: {},
            events: { input: { handler: "onInput" } },
            children: [],
          },
        ],
      },
    },
  };
  ok(client.receive(event("view.render", payload)));
  const input = (root.children[0] as FakeElement).children[0] as FakeElement;
  input.value = "hello";
  input.dispatchEvent(new FakeEvent("input"));
  const events = viewEvents(sent);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0].payload, {
    handler: "onInput",
    type: "input",
    detail: { value: "hello" },
    dataset: {},
    catch: false,
    timeStamp: 42,
  });
});

test("a theme event changes the root only and never reloads the tree", () => {
  const { document, root, client } = setup();
  ok(client.receive(event("view.render", tree(1, "hello", "dark"))));
  const view = root.children[0];
  assert.deepEqual(ok(client.receive(event("view.theme", { theme: "light" }))), { ok: true, status: "theme" });
  assert.equal(document.documentElement.getAttribute("data-theme"), "light");
  assert.equal(document.documentElement.style.properties.get("color-scheme"), "light");
  assert.equal(root.children[0], view);
  assert.equal(client.seq(), 1);
});

test("an invalid theme is rejected without touching the root", () => {
  const { document, client } = setup();
  ok(client.receive(event("view.render", tree(1, "hello", "dark"))));
  const result = rejected(client.receive(event("view.theme", { theme: "auto" })));
  assert.equal(result.error.code, "BRIDGE_INVALID_MESSAGE");
  assert.equal(document.documentElement.getAttribute("data-theme"), "dark");
});

test("destroy removes the tree and closes the page", () => {
  const { root, client } = setup();
  ok(client.receive(event("view.render", tree(1, "hello"))));
  assert.deepEqual(ok(client.receive(event("view.destroy", {}))), { ok: true, status: "destroyed" });
  assert.equal(root.children.length, 0);
  assert.equal(rejected(client.receive(event("view.render", tree(2, "again")))).error.code, "BRIDGE_PAGE_CLOSED");
});

test("an unsafe tree is rejected before it reaches the DOM", () => {
  const { root, sent, client } = setup();
  const result = rejected(
    client.receive(
      event("view.render", {
        pageId: "p1",
        seq: 1,
        update: {
          kind: "tree",
          theme: "light",
          tree: { type: "element", tag: "script", props: {}, children: [] },
        },
      }),
    ),
  );
  assert.equal(result.error.code, "BRIDGE_INVALID_MESSAGE");
  assert.equal(root.children.length, 0);
  assert.equal(sent.some((message) => message.event === "view.error"), true);
});

test("a JSON string and an object are both accepted", () => {
  const { client } = setup();
  assert.deepEqual(ok(client.receive(JSON.stringify(event("view.render", tree(1, "json"))))), {
    ok: true,
    status: "tree",
  });
});

test("an oversized message is rejected before JSON parsing", () => {
  const { client } = setup();
  const result = rejected(client.receive("x".repeat(MAX_BRIDGE_MESSAGE_BYTES + 1)));
  assert.equal(result.error.code, "BRIDGE_TOO_LARGE");
});

test("a lost host channel closes the page instead of throwing", () => {
  let calls = 0;
  const { client } = setup(() => {
    calls += 1;
    throw new Error("the WebView is gone");
  });
  assert.equal(rejected(client.ready()).error.code, "BRIDGE_PAGE_CLOSED");
  assert.equal(rejected(client.receive(event("view.render", tree(1, "x")))).error.code, "BRIDGE_PAGE_CLOSED");
  assert.equal(calls, 1);
});

test("the binding is validated before a client exists", () => {
  const page = createFakePage();
  assert.throws(
    () =>
      createViewClient({
        document: page.document,
        root: page.root,
        binding: { appId: "app1", sessionId: "s1", pageId: "page-1" },
        send: () => undefined,
      }),
    /invalid view binding/,
  );
});
