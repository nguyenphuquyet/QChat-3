import assert from "node:assert/strict";
import { test } from "node:test";
import type { BridgeMessage } from "@qchat/miniapp-contracts";
import { createBridgeClient } from "../src/index.js";

const binding = { appId: "qchat.hello", sessionId: "s1", pageId: "p1" };

function setup(allowlist = ["wx.showToast", "wx.request"]) {
  const sent: BridgeMessage[] = [];
  const client = createBridgeClient({
    binding,
    allowlist,
    transport: { send: (message) => sent.push(message) },
  });
  return { client, sent };
}

function response(id: string, result: unknown) {
  return { v: 1, kind: "response", ...binding, id, ok: true, result };
}

test("a request is sent with the binding and resolved by its response", async () => {
  const { client, sent } = setup();
  const promise = client.request("wx.showToast", { title: "hi" });
  assert.equal(sent.length, 1);
  const request = sent[0];
  assert.equal(request.kind, "request");
  if (request.kind === "request") {
    assert.equal(request.method, "wx.showToast");
    assert.equal(request.appId, "qchat.hello");
    assert.equal(request.pageId, "p1");
    assert.equal(client.pendingCount(), 1);
    assert.equal(client.handleMessage(response(request.id, { ok: true })), null);
  }
  assert.deepEqual(await promise, { ok: true });
  assert.equal(client.pendingCount(), 0);
});

test("a method outside the allowlist is rejected before it is sent", async () => {
  const { client, sent } = setup();
  await assert.rejects(client.request("wx.privateApi"), (error: { code: string }) => error.code === "BRIDGE_UNKNOWN_METHOD");
  assert.equal(sent.length, 0);
});

test("a request times out and a late response is ignored", async () => {
  const { client, sent } = setup();
  const promise = client.request("wx.showToast", {}, { timeoutMs: 5 });
  await assert.rejects(promise, (error: { code: string }) => error.code === "BRIDGE_TIMEOUT");
  const request = sent[0];
  if (request.kind === "request") {
    assert.equal(client.handleMessage(response(request.id, { late: true })), null);
  }
  assert.equal(client.pendingCount(), 0);
});

test("a response bound to another page cannot settle a request", async () => {
  const { client, sent } = setup();
  const promise = client.request("wx.showToast", {}, { timeoutMs: 30 });
  const request = sent[0];
  if (request.kind === "request") {
    const error = client.handleMessage({ ...response(request.id, {}), pageId: "p2" });
    assert.equal(error?.code, "BRIDGE_PAGE_MISMATCH");
  }
  await assert.rejects(promise, (error: { code: string }) => error.code === "BRIDGE_TIMEOUT");
});

test("a failed response rejects with its typed error", async () => {
  const { client, sent } = setup();
  const promise = client.request("wx.request", { url: "http://x" });
  const request = sent[0];
  if (request.kind === "request") {
    client.handleMessage({
      v: 1, kind: "response", ...binding, id: request.id, ok: false,
      error: { code: "NETWORK_HTTPS_REQUIRED", message: "https only" },
    });
  }
  await assert.rejects(promise, (error: { code: string }) => error.code === "NETWORK_HTTPS_REQUIRED");
});

test("close rejects every pending request", async () => {
  const { client } = setup();
  const first = client.request("wx.showToast");
  const second = client.request("wx.request");
  client.close();
  await assert.rejects(first, (error: { code: string }) => error.code === "BRIDGE_PAGE_CLOSED");
  await assert.rejects(second, (error: { code: string }) => error.code === "BRIDGE_PAGE_CLOSED");
  await assert.rejects(client.request("wx.showToast"), (error: { code: string }) => error.code === "BRIDGE_PAGE_CLOSED");
  assert.equal(client.closed(), true);
});

test("aborting a request sends a cancel and rejects locally", async () => {
  const { client, sent } = setup();
  const controller = new AbortController();
  const promise = client.request("wx.request", {}, { signal: controller.signal });
  controller.abort();
  await assert.rejects(promise, (error: { code: string }) => error.code === "BRIDGE_CANCELLED");
  assert.ok(sent.some((message) => message.kind === "cancel"));
  assert.equal(client.pendingCount(), 0);
});

test("host events are routed to the handler", () => {
  const events: string[] = [];
  const client = createBridgeClient({
    binding,
    allowlist: ["wx.showToast"],
    transport: { send: () => {} },
    onEvent: (event) => events.push(event.event),
  });
  const result = client.handleMessage({
    v: 1, kind: "event", ...binding, event: "host.themeChange", payload: { theme: "dark" },
  });
  assert.equal(result, null);
  assert.deepEqual(events, ["host.themeChange"]);
});

test("a malformed inbound message is reported, never acted on", () => {
  const { client } = setup();
  assert.equal(client.handleMessage({ nope: true })?.code, "BRIDGE_INVALID_MESSAGE");
  assert.equal(client.handleMessage({ v: 9, kind: "response", ...binding, id: "r0", ok: true })?.code, "BRIDGE_INVALID_MESSAGE");
});
