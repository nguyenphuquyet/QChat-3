import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BRIDGE_VERSION,
  MAX_BRIDGE_MESSAGE_BYTES,
  parseBridgeMessage,
  makeRequestId,
  isOk,
  errorFor,
  miniAppError,
  type BridgeBinding,
} from "../src/index.js";

const binding: BridgeBinding = { appId: "qchat.hello", sessionId: "s1", pageId: "p1" };
const base = { v: BRIDGE_VERSION, appId: "qchat.hello", sessionId: "s1", pageId: "p1" };

test("accepts a well-formed request", () => {
  const result = parseBridgeMessage({ ...base, kind: "request", id: "r1", method: "wx.showToast", params: { title: "hi" } }, binding);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.message.kind, "request");
    assert.deepEqual(result.message.kind === "request" ? result.message.params : null, { title: "hi" });
  }
});

test("rejects a message bound to another page", () => {
  const result = parseBridgeMessage({ ...base, pageId: "p2", kind: "request", id: "r1", method: "wx.showToast", params: {} }, binding);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "BRIDGE_PAGE_MISMATCH");
});

test("rejects a message bound to another session", () => {
  const result = parseBridgeMessage({ ...base, sessionId: "s2", kind: "event", event: "host.themeChange", payload: { theme: "dark" } }, binding);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "BRIDGE_PAGE_MISMATCH");
});

test("rejects an unknown message kind", () => {
  const result = parseBridgeMessage({ ...base, kind: "invoke", id: "r1" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "BRIDGE_INVALID_MESSAGE");
});

test("rejects a smuggled key", () => {
  const result = parseBridgeMessage({ ...base, kind: "request", id: "r1", method: "wx.showToast", params: {}, extra: true });
  assert.equal(result.ok, false);
});

test("rejects an invalid method name", () => {
  const result = parseBridgeMessage({ ...base, kind: "request", id: "r1", method: "constructor", params: {} });
  assert.equal(result.ok, false);
});

test("rejects a response that is both ok and failed", () => {
  const result = parseBridgeMessage({ ...base, kind: "response", id: "r1", ok: true, error: miniAppError("API_FAILED") });
  assert.equal(result.ok, false);
});

test("rejects an unknown error code", () => {
  const result = parseBridgeMessage({ ...base, kind: "response", id: "r1", ok: false, error: { code: "NOT_A_CODE", message: "x" } });
  assert.equal(result.ok, false);
});

test("rejects a message above the size limit", () => {
  const huge = "x".repeat(MAX_BRIDGE_MESSAGE_BYTES + 1);
  const result = parseBridgeMessage({ ...base, kind: "request", id: "r1", method: "wx.request", params: { url: huge } });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "BRIDGE_TOO_LARGE");
});

test("accepts a failed response and exposes its error", () => {
  const result = parseBridgeMessage({ ...base, kind: "response", id: "r1", ok: false, error: { code: "API_PERMISSION_DENIED", message: "no" } });
  assert.equal(result.ok, true);
  if (result.ok && result.message.kind === "response") {
    assert.equal(isOk(result.message), false);
    assert.equal(errorFor(result.message).code, "API_PERMISSION_DENIED");
  }
});

test("accepts a cancel message", () => {
  const result = parseBridgeMessage({ ...base, kind: "cancel", id: "r1" }, binding);
  assert.equal(result.ok, true);
});

test("request ids are deterministic and validated", () => {
  assert.equal(makeRequestId(0), "r0");
  assert.equal(makeRequestId(35), "rz");
  assert.throws(() => makeRequestId(-1));
  assert.throws(() => makeRequestId(1.5));
});
