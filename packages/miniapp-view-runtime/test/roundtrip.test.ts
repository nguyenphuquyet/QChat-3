import assert from "node:assert/strict";
import { test } from "node:test";
import {
  VIEW_RENDER_EVENT,
  VIEW_THEME_EVENT,
  type BridgeMessage,
  type RenderNode,
  type RuntimeIdentity,
} from "@qchat/miniapp-contracts";
import { createServiceRuntime } from "@qchat/miniapp-service-runtime";
import { createRenderSession, createViewRenderer } from "../src/index.js";
import { FakeDomAdapter } from "./fake-dom.js";

const identity: RuntimeIdentity = {
  appId: "qchat.hello",
  appVersion: "1.0.0",
  sessionId: "s-roundtrip",
  runtimeVersion: "0.1.0",
  baseLibraryVersion: "3.18.1",
};

/**
 * The M1 spike's whole point: the page logic lives in the service, the page is
 * drawn by the view, and the only path between them is the typed bridge. This
 * test wires the two real modules together; the device bridge (M2/M5) carries
 * the same messages.
 */
test("service render -> view paint -> tap -> service handler -> new render", () => {
  const dom = new FakeDomAdapter();
  const view = createViewRenderer(dom, {
    onEvent: (event) => {
      service.dispatchViewEvent(event);
    },
  });
  const session = createRenderSession(view);

  const service = createServiceRuntime({
    identity,
    theme: { app: "auto" },
    hostTheme: "light",
    transport: {
      send(message: BridgeMessage) {
        if (message.kind !== "event") return;
        if (message.event === VIEW_RENDER_EVENT) {
          session.apply(message.payload);
        } else if (message.event === VIEW_THEME_EVENT) {
          const payload = message.payload as { theme: "light" | "dark" };
          view.setTheme(payload.theme);
        }
      },
    },
    pages: {
      "pages/index/index": {
        data: { count: 0 },
        render: (data): RenderNode => ({
          type: "element",
          tag: "wx-view",
          props: { class: "page" },
          children: [
            { type: "element", tag: "wx-text", props: {}, children: [{ type: "text", text: `count:${String(data.count)}` }] },
            {
              type: "element",
              tag: "wx-button",
              props: {},
              dataset: { action: "increment" },
              events: { tap: { handler: "onTap" } },
              children: [{ type: "text", text: "add" }],
            },
          ],
        }),
        handlers: {
          onTap: () => {
            const count = Number((service.pageData() as { count: number }).count);
            service.setData({ count: count + 1 });
          },
        },
      },
    },
  });

  const launched = service.launch("pages/index/index");
  assert.equal(launched.ok, true);
  assert.equal(dom.theme, "light");
  assert.equal(dom.snapshot().children[0].children[0].children[0].text, "count:0");

  const createdBeforeTap = dom.createdTags.length;
  dom.dispatch(dom.handleForTag("wx-button"), "tap");

  assert.equal((service.pageData() as { count: number }).count, 1);
  assert.equal(dom.snapshot().children[0].children[0].children[0].text, "count:1");
  assert.equal(dom.createdTags.length, createdBeforeTap, "the page must not be rebuilt for a data update");
  assert.equal(dom.snapshot().children.length, 1, "the page must not be reloaded");

  service.setHostTheme("dark");
  assert.equal(dom.theme, "dark");
  assert.equal((service.pageData() as { count: number }).count, 1, "a theme change keeps page state");
});
