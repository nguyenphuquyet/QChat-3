import test from "node:test";
import assert from "node:assert/strict";
import { createQChatClient, QChatError } from "../src/index";
import type { BridgeRequest } from "../src/index";

function host() {
  const sent: BridgeRequest[] = [];
  const client = createQChatClient({
    transport: (request) => sent.push(request),
    timeoutMs: 50,
    requestTimeoutMs: 50,
    chooseImageTimeoutMs: 50,
  });
  return { client, sent };
}

test("getAppInfo sends one request and resolves the host result", async () => {
  const { client, sent } = host();
  const pending = client.getAppInfo();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].method, "getAppInfo");
  client.receive({
    id: sent[0].id,
    ok: true,
    result: {
      appId: "mp_0123456789abcdef",
      name: "Demo",
      version: "1.0.0",
      entry: "index.html",
      runtimeVersion: "1.0.0",
      minRuntimeVersion: "1.0.0",
      permissions: ["toast"],
    },
  });
  const info = await pending;
  assert.equal(info.appId, "mp_0123456789abcdef");
  assert.deepEqual(info.permissions, ["toast"]);
});

test("host errors become QChatError with the same code", async () => {
  const { client, sent } = host();
  const pending = client.getUserInfo();
  client.receive({
    id: sent[0].id,
    ok: false,
    error: { code: "PERMISSION_DENIED", message: "user.profile is required" },
  });
  await assert.rejects(pending, (error: unknown) => {
    assert.ok(error instanceof QChatError);
    assert.equal(error.code, "PERMISSION_DENIED");
    assert.equal(error.message, "user.profile is required");
    return true;
  });
});

test("a request that never gets a response times out and is cleaned up", async () => {
  const { client, sent } = host();
  await assert.rejects(client.getSystemInfo(), (error: unknown) => {
    assert.ok(error instanceof QChatError);
    assert.equal(error.code, "TIMEOUT");
    return true;
  });
  const pending = client.showToast("still works");
  assert.equal(sent.length, 2);
  client.receive({ id: sent[1].id, ok: true });
  await pending;
});

test("invalid arguments are rejected before touching the bridge", async () => {
  const { client, sent } = host();
  assert.throws(
    () => client.showToast("   "),
    (error: unknown) =>
      error instanceof QChatError && error.code === "INVALID_ARGUMENT",
  );
  assert.throws(
    () => client.navigateTo("https://example.com"),
    (error: unknown) =>
      error instanceof QChatError && error.code === "INVALID_ARGUMENT",
  );
  assert.throws(
    () => client.request("/admin"),
    (error: unknown) =>
      error instanceof QChatError && error.code === "INVALID_ARGUMENT",
  );
  await assert.rejects(
    client.getStorage("bad key"),
    (error: unknown) =>
      error instanceof QChatError && error.code === "INVALID_ARGUMENT",
  );
  assert.equal(sent.length, 0);
});

test("request accepts only allowlisted paths", async () => {
  const { client, sent } = host();
  const pending = client.request("/friends?limit=10");
  assert.equal(sent[0].method, "request");
  assert.deepEqual(sent[0].params, {
    path: "/friends",
    method: "GET",
  });
  client.receive({ id: sent[0].id, ok: true, result: { items: [] } });
  assert.deepEqual(await pending, { items: [] });
});

test("storage round-trips JSON values through the host", async () => {
  const { client, sent } = host();
  const setting = client.setStorage("counter", { value: 2 });
  assert.deepEqual(sent[0].params, { key: "counter", value: { value: 2 } });
  client.receive({ id: sent[0].id, ok: true });
  await setting;

  const reading = client.getStorage<{ value: number }>("counter");
  assert.equal(sent[1].method, "getStorage");
  client.receive({ id: sent[1].id, ok: true, result: { value: { value: 2 } } });
  assert.deepEqual(await reading, { value: 2 });
});

test("without a bridge calls fail with BRIDGE_UNAVAILABLE", async () => {
  const client = createQChatClient({ timeoutMs: 20 });
  await assert.rejects(
    client.getAppInfo(),
    (error: unknown) =>
      error instanceof QChatError && error.code === "BRIDGE_UNAVAILABLE",
  );
});

test("dispose cancels in-flight calls", async () => {
  const { client } = host();
  const pending = client.chooseImage();
  client.dispose("closed by user");
  await assert.rejects(
    pending,
    (error: unknown) =>
      error instanceof QChatError &&
      error.code === "CANCELLED" &&
      error.message === "closed by user",
  );
  await assert.rejects(
    client.getAppInfo(),
    (error: unknown) =>
      error instanceof QChatError && error.code === "BRIDGE_UNAVAILABLE",
  );
});
