import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  RenderNode,
  RuntimeIdentity,
  ViewEvent,
  WxsInvoker,
} from "@qchat/miniapp-contracts";
import { createServiceRuntime, type PageOptions } from "../src/index.js";

const identity: RuntimeIdentity = {
  appId: "qchat.test",
  appVersion: "1.0.0",
  sessionId: "s1",
  runtimeVersion: "0.1.0",
  baseLibraryVersion: "3.18.1",
};

function tree(data: Record<string, unknown>): RenderNode {
  return {
    type: "element",
    tag: "wx-view",
    props: {},
    children: [{ type: "text", text: String(data.count ?? 0) }],
  };
}

function setup(wxs?: WxsInvoker, handlers: PageOptions["handlers"] = {}) {
  const sent: unknown[] = [];
  const page: PageOptions = {
    data: { count: 0 },
    render: tree,
    ...(wxs ? { wxs } : {}),
    handlers,
  };
  const runtime = createServiceRuntime({
    identity,
    transport: { send: (message) => sent.push(message) },
    theme: { app: "light" },
    pages: { "pages/index/index": page },
  });
  runtime.launch("pages/index/index");
  return { runtime, sent };
}

test("a wxs event runs in the page-scoped runtime and can call a page method", () => {
  const calls: string[] = [];
  const events: ViewEvent[] = [];
  const wxs: WxsInvoker = {
    call() {
      throw new Error("call should not be used for an event");
    },
    callEvent(path, _event, context) {
      calls.push(path);
      context?.callMethod?.("onTap", { value: 5 });
    },
  };
  const { runtime } = setup(wxs, {
    onTap(event) {
      events.push(event);
    },
  });

  const result = runtime.dispatchViewEvent({
    handler: "wxs:m.tap",
    type: "tap",
    detail: { ignored: true },
    dataset: { id: "a" },
    catch: false,
    timeStamp: 1,
  });

  assert.equal(result.ok, true, JSON.stringify(result.error));
  assert.deepEqual(calls, ["m.tap"]);
  assert.equal(events.length, 1);
  assert.equal(events[0].handler, "onTap");
  assert.deepEqual(events[0].detail, { value: 5 });
});

test("a wxs event without a runtime is rejected", () => {
  const { runtime } = setup();
  const result = runtime.dispatchViewEvent({
    handler: "wxs:m.tap",
    type: "tap",
    detail: {},
    dataset: {},
    catch: false,
    timeStamp: 1,
  });
  assert.equal(result.ok, false);
  assert.equal(result.error?.code, "WXS_UNSUPPORTED");
});

test("a wxs runtime error keeps its code", () => {
  const wxs: WxsInvoker = {
    call() {
      return undefined;
    },
    callEvent() {
      throw Object.assign(new Error("too many steps"), { code: "WXS_LIMIT_EXCEEDED" });
    },
  };
  const { runtime } = setup(wxs);
  const result = runtime.dispatchViewEvent({
    handler: "wxs:m.tap",
    type: "tap",
    detail: {},
    dataset: {},
    catch: false,
    timeStamp: 1,
  });
  assert.equal(result.ok, false);
  assert.equal(result.error?.code, "WXS_LIMIT_EXCEEDED");
  assert.equal(result.error?.message, "too many steps");
});

test("ownerInstance.callMethod for an unknown page method fails the event", () => {
  const wxs: WxsInvoker = {
    call() {
      return undefined;
    },
    callEvent(_path, _event, context) {
      context?.callMethod?.("missing");
    },
  };
  const { runtime } = setup(wxs);
  const result = runtime.dispatchViewEvent({
    handler: "wxs:m.tap",
    type: "tap",
    detail: {},
    dataset: {},
    catch: false,
    timeStamp: 1,
  });
  assert.equal(result.ok, false);
  assert.equal(result.error?.code, "WXS_RUNTIME_ERROR");
});
