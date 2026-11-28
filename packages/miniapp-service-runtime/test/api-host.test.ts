import assert from "node:assert/strict";
import { test } from "node:test";
import type { RuntimeIdentity } from "@qchat/miniapp-contracts";
import {
  HOST_LOADING_EVENT,
  HOST_MODAL_EVENT,
  HOST_MODAL_RESULT_EVENT,
  HOST_TOAST_EVENT,
  MemoryStorageAdapter,
  createApiHost,
  type ApiHost,
  type NetworkAdapter,
  type NetworkRequest,
  type NetworkResponse,
  type NavigationController,
  type NavigationResult,
  type SyncApiResult,
} from "../src/index.js";

const identity: RuntimeIdentity = {
  appId: "qchat.test",
  appVersion: "1.0.0",
  sessionId: "s-api",
  runtimeVersion: "0.1.0",
  baseLibraryVersion: "3.18.1",
};

const ROUTES = ["pages/index/index", "pages/about/about", "pages/tab/home", "pages/tab/settings"];
const TABS = ["pages/tab/home", "pages/tab/settings"];

interface RecordedCall {
  kind: string;
  route: string;
  query: Record<string, string>;
  delta?: number;
}

interface Harness {
  host: ApiHost;
  calls: RecordedCall[];
  events: Array<{ event: string; payload: Record<string, unknown> }>;
  requests: NetworkRequest[];
  storage: MemoryStorageAdapter;
  call(method: string, params?: Record<string, unknown>): Promise<SyncApiResult>;
  sync(method: string, params?: Record<string, unknown>): SyncApiResult;
}

function createHarness(options: {
  storage?: MemoryStorageAdapter | null;
  networkResponse?: Partial<NetworkResponse> | (() => Promise<NetworkResponse>);
  domains?: string[];
  quota?: number;
  maxResponse?: number;
  requestTimeout?: number;
  systemInfo?: Record<string, unknown>;
} = {}): Harness {
  const calls: RecordedCall[] = [];
  const events: Array<{ event: string; payload: Record<string, unknown> }> = [];
  const requests: NetworkRequest[] = [];
  const responses: Array<{ id: string; response: SyncApiResult }> = [];
  const waiters = new Map<string, (response: SyncApiResult) => void>();
  let seq = 0;

  const navigation: NavigationController = {
    to(kind, route, query = {}): NavigationResult {
      calls.push({ kind, route, query });
      return { ok: true, pageId: "p2" };
    },
    back(delta = 1): NavigationResult {
      calls.push({ kind: "back", route: "", query: {}, delta });
      return { ok: true, pageId: "p1" };
    },
  };

  const storage = options.storage === null ? undefined : options.storage ?? new MemoryStorageAdapter();

  const network: NetworkAdapter = {
    async request(request) {
      requests.push(request);
      if (typeof options.networkResponse === "function") return options.networkResponse();
      if (options.networkResponse) {
        return {
          statusCode: options.networkResponse.statusCode ?? 200,
          header: options.networkResponse.header ?? { "content-type": "application/json" },
          body: options.networkResponse.body ?? "{}",
        };
      }
      return { statusCode: 200, header: { "content-type": "application/json" }, body: '{"ok":true}' };
    },
  };

  const host = createApiHost({
    identity,
    navigation,
    routes: ROUTES,
    tabPages: TABS,
    respond(id, response) {
      responses.push({ id, response });
      waiters.get(id)?.(response);
      waiters.delete(id);
    },
    storage,
    network,
    domains: options.domains ?? ["api.example.com", "*.cdn.example.com"],
    storageQuotaBytes: options.quota,
    maxResponseBytes: options.maxResponse,
    requestTimeoutMs: options.requestTimeout ?? 1000,
    systemInfo: options.systemInfo ?? { platform: "android", windowWidth: 390 },
    theme: () => "light",
    emit(event, payload) {
      events.push({ event, payload });
    },
  });

  function call(method: string, params: Record<string, unknown> = {}): Promise<SyncApiResult> {
    seq += 1;
    const id = `s${seq}`;
    host.handle({ id, method, params });
    const settled = responses.find((entry) => entry.id === id);
    if (settled) return Promise.resolve(settled.response);
    return new Promise((resolve) => waiters.set(id, resolve));
  }

  return {
    host,
    calls,
    events,
    requests,
    storage: storage as MemoryStorageAdapter,
    call,
    sync(method, params = {}) {
      return host.handleSync(method, params);
    },
  };
}

test("navigation: declared routes, query, tab rules and back", async () => {
  const h = createHarness();

  const opened = await h.call("wx.navigateTo", { url: "/pages/about/about?from=home&n=2" });
  assert.equal(opened.ok, true);
  assert.deepEqual(h.calls[0], { kind: "open", route: "pages/about/about", query: { from: "home", n: "2" } });
  assert.equal((opened.ok && (opened.result as { errMsg: string }).errMsg), "wx.navigateTo:ok");

  await h.call("wx.redirectTo", { url: "pages/about/about" });
  assert.equal(h.calls[1].kind, "redirect");
  assert.deepEqual(h.calls[1].query, {});

  await h.call("wx.reLaunch", { url: "/pages/index/index" });
  assert.equal(h.calls[2].kind, "reLaunch");

  const tab = await h.call("wx.switchTab", { url: "/pages/tab/home" });
  assert.equal(tab.ok, true);
  assert.equal(h.calls[3].kind, "switchTab");

  const withQuery = await h.call("wx.switchTab", { url: "/pages/tab/home?x=1" });
  assert.equal(withQuery.ok, false);
  assert.equal(!withQuery.ok && withQuery.error.code, "NAVIGATION_INVALID_ROUTE");

  const notTab = await h.call("wx.switchTab", { url: "/pages/about/about" });
  assert.equal(!notTab.ok && notTab.error.code, "NAVIGATION_NO_TAB_BAR");

  const back = await h.call("wx.navigateBack", { delta: 2 });
  assert.equal(back.ok, true);
  assert.equal(h.calls.at(-1)?.delta, 2);

  const badBack = await h.call("wx.navigateBack", { delta: 0 });
  assert.equal(!badBack.ok && badBack.error.code, "API_INVALID_ARGUMENT");
});

test("navigation: a scheme, a fragment, `..` and an undeclared route are rejected", async () => {
  const h = createHarness();
  for (const url of [
    "https://evil.example/pages/about/about",
    "/pages/about/about#x",
    "/pages/../about/about",
    "/pages/unknown/unknown",
    "pages\\about\\about",
    "",
  ]) {
    const result = await h.call("wx.navigateTo", { url });
    assert.equal(result.ok, false, url);
    assert.equal(!result.ok && result.error.code, "NAVIGATION_INVALID_ROUTE", url);
  }
  assert.equal(h.calls.length, 0);
});

test("storage: synchronous round trip, missing key, remove and clear", () => {
  const h = createHarness();

  assert.deepEqual(h.sync("wx.setStorageSync", { key: "profile", data: { name: "Ada", tags: ["a"] } }), { ok: true, result: {} });
  assert.deepEqual(h.sync("wx.getStorageSync", { key: "profile" }), { ok: true, result: { name: "Ada", tags: ["a"] } });
  assert.deepEqual(h.sync("wx.getStorageSync", { key: "missing" }), { ok: true, result: "" });
  assert.deepEqual(h.sync("wx.removeStorageSync", { key: "profile" }), { ok: true, result: {} });
  assert.equal(h.sync("wx.getStorageSync", { key: "profile" }).ok, true);
  assert.deepEqual(h.sync("wx.setStorageSync", { key: "a", data: 1 }), { ok: true, result: {} });
  assert.deepEqual(h.sync("wx.clearStorageSync"), { ok: true, result: {} });
  assert.equal(h.storage.entries().length, 0);
});

test("storage: key rules, quota and corrupt data", () => {
  const h = createHarness({ quota: 32 });

  const badKey = h.sync("wx.setStorageSync", { key: "", data: 1 });
  assert.equal(!badKey.ok && badKey.error.code, "STORAGE_KEY_INVALID");
  const control = h.sync("wx.setStorageSync", { key: "a\u0000b", data: 1 });
  assert.equal(!control.ok && control.error.code, "STORAGE_KEY_INVALID");

  const tooBig = h.sync("wx.setStorageSync", { key: "k", data: "x".repeat(40) });
  assert.equal(!tooBig.ok && tooBig.error.code, "STORAGE_QUOTA_EXCEEDED");

  h.storage.write("broken", "{not json");
  const corrupt = h.sync("wx.getStorageSync", { key: "broken" });
  assert.equal(!corrupt.ok && corrupt.error.code, "STORAGE_CORRUPT");
});

test("storage: asynchronous API returns data and fails for a missing key", async () => {
  const h = createHarness();

  const set = await h.call("wx.setStorage", { key: "k", data: [1, 2] });
  assert.equal(set.ok, true);
  const get = await h.call("wx.getStorage", { key: "k" });
  assert.deepEqual(get, { ok: true, result: { data: [1, 2], errMsg: "wx.getStorage:ok" } });

  const missing = await h.call("wx.getStorage", { key: "none" });
  assert.equal(!missing.ok && missing.error.code, "API_FAILED");

  await h.call("wx.removeStorage", { key: "k" });
  await h.call("wx.clearStorage");
});

test("storage: no adapter is API_UNSUPPORTED, never an in-memory fallback", async () => {
  const h = createHarness({ storage: null });
  const sync = h.sync("wx.setStorageSync", { key: "k", data: 1 });
  assert.equal(!sync.ok && sync.error.code, "API_UNSUPPORTED");
  const asyncResult = await h.call("wx.setStorage", { key: "k", data: 1 });
  assert.equal(!asyncResult.ok && asyncResult.error.code, "API_UNSUPPORTED");
});

test("request: HTTPS, domain allowlist, methods, headers and body", async () => {
  const h = createHarness();

  const plain = await h.call("wx.request", { url: "http://api.example.com/x" });
  assert.equal(!plain.ok && plain.error.code, "NETWORK_HTTPS_REQUIRED");

  const foreign = await h.call("wx.request", { url: "https://evil.example/x" });
  assert.equal(!foreign.ok && foreign.error.code, "NETWORK_DOMAIN_REJECTED");

  const credentials = await h.call("wx.request", { url: "https://user:pw@api.example.com/x" });
  assert.equal(!credentials.ok && credentials.error.code, "NETWORK_DOMAIN_REJECTED");

  const badMethod = await h.call("wx.request", { url: "https://api.example.com/x", method: "TRACE" });
  assert.equal(!badMethod.ok && badMethod.error.code, "API_INVALID_ARGUMENT");

  const cookie = await h.call("wx.request", { url: "https://api.example.com/x", header: { Cookie: "a=1" } });
  assert.equal(!cookie.ok && cookie.error.code, "API_INVALID_ARGUMENT");

  const get = await h.call("wx.request", { url: "https://api.example.com/list", data: { page: 2, tags: ["a"] } });
  assert.equal(get.ok, true);
  const getRequest = h.requests.at(-1);
  assert.equal(getRequest?.method, "GET");
  assert.match(getRequest?.url ?? "", /page=2/);
  assert.match(getRequest?.url ?? "", /tags=%5B%22a%22%5D/);
  assert.equal(getRequest?.body, undefined);

  const post = await h.call("wx.request", { url: "https://api.example.com/save", method: "post", data: { ok: true } });
  assert.equal(post.ok, true);
  const postRequest = h.requests.at(-1);
  assert.equal(postRequest?.method, "POST");
  assert.equal(postRequest?.body, '{"ok":true}');
  assert.equal(postRequest?.header["content-type"], "application/json");

  const subdomain = await h.call("wx.request", { url: "https://img.cdn.example.com/a.png" });
  assert.equal(subdomain.ok, true);
});

test("request: timeout, size limit and JSON parsing", async () => {
  const slow = createHarness({ requestTimeout: 20, networkResponse: () => new Promise(() => {}) });
  const timedOut = await slow.call("wx.request", { url: "https://api.example.com/slow" });
  assert.equal(!timedOut.ok && timedOut.error.code, "NETWORK_TIMEOUT");

  const small = createHarness({ maxResponse: 8, networkResponse: { body: "0123456789" } });
  const tooLarge = await small.call("wx.request", { url: "https://api.example.com/big" });
  assert.equal(!tooLarge.ok && tooLarge.error.code, "NETWORK_RESPONSE_TOO_LARGE");

  const json = createHarness({ networkResponse: { body: '{"value":7}', header: { "content-type": "application/json; charset=utf-8" } } });
  const parsed = await json.call("wx.request", { url: "https://api.example.com/json" });
  assert.deepEqual(parsed.ok && (parsed.result as { data: unknown }).data, { value: 7 });

  const text = createHarness({ networkResponse: { body: "plain", header: { "content-type": "text/plain" } } });
  const raw = await text.call("wx.request", { url: "https://api.example.com/text" });
  assert.equal(raw.ok && (raw.result as { data: unknown }).data, "plain");
});

test("request: no adapter is API_UNSUPPORTED", () => {
  const captured: { value: SyncApiResult | null } = { value: null };
  const host = createApiHost({
    identity,
    navigation: { to: () => ({ ok: true }), back: () => ({ ok: true }) },
    routes: ROUTES,
    respond: (_id, response) => {
      captured.value = response;
    },
    storage: new MemoryStorageAdapter(),
    domains: ["api.example.com"],
    theme: () => "light",
  });
  host.handle({ id: "s1", method: "wx.request", params: { url: "https://api.example.com/x" } });
  const response = captured.value as SyncApiResult;
  assert.equal(response.ok, false);
  assert.equal(!response.ok && response.error.code, "API_UNSUPPORTED");
});

test("UI: toast, loading and modal events", async () => {
  const h = createHarness();

  const toast = await h.call("wx.showToast", { title: "Saved", icon: "success", duration: 2000 });
  assert.equal(toast.ok, true);
  assert.deepEqual(h.events.at(-1), { event: HOST_TOAST_EVENT, payload: { title: "Saved", icon: "success", duration: 2000 } });

  await h.call("wx.showLoading", { title: "Loading", mask: true });
  assert.deepEqual(h.events.at(-1), { event: HOST_LOADING_EVENT, payload: { visible: true, title: "Loading", mask: true } });
  await h.call("wx.hideLoading");
  assert.deepEqual(h.events.at(-1), { event: HOST_LOADING_EVENT, payload: { visible: false } });

  const modalPromise = h.call("wx.showModal", { title: "Delete?", content: "This cannot be undone.", showCancel: true });
  assert.equal(h.host.pending(), 1);
  const modal = h.events.at(-1);
  assert.equal(modal?.event, HOST_MODAL_EVENT);
  const modalId = modal?.payload.id as string;

  assert.equal(h.host.handleHostEvent({ event: HOST_MODAL_RESULT_EVENT, payload: { id: "m999", confirm: true } })?.code, "BRIDGE_INVALID_MESSAGE");
  assert.equal(h.host.handleHostEvent({ event: HOST_MODAL_RESULT_EVENT, payload: { id: modalId, confirm: true } }), null);

  const result = await modalPromise;
  assert.equal(result.ok, true);
  assert.deepEqual(result.ok && (result.result as Record<string, unknown>), {
    confirm: true,
    cancel: false,
    errMsg: "wx.showModal:ok",
  });
  assert.equal(h.host.pending(), 0);
});

test("UI: closing the host fails a waiting modal", async () => {
  const h = createHarness();
  const modalPromise = h.call("wx.showModal", { title: "Wait" });
  assert.equal(h.host.pending(), 1);
  h.host.close();
  const result = await modalPromise;
  assert.equal(!result.ok && result.error.code, "BRIDGE_PAGE_CLOSED");
});

test("system info: host fields plus the resolved theme and SDK version", () => {
  const h = createHarness({ systemInfo: { platform: "android", windowWidth: 390, theme: "dark", secret: "no" } });
  const result = h.sync("wx.getSystemInfoSync");
  assert.equal(result.ok, true);
  const info = result.ok ? (result.result as Record<string, unknown>) : {};
  assert.equal(info.platform, "android");
  assert.equal(info.windowWidth, 390);
  assert.equal(info.theme, "light", "the resolved theme always wins");
  assert.equal(info.SDKVersion, "3.18.1");
  assert.equal("secret" in info, false, "only documented fields are returned");
});

test("dispatch: an unregistered method is rejected; a registered M7 method is unsupported", async () => {
  const h = createHarness();

  const unknown = await h.call("wx.notReal", {});
  assert.equal(!unknown.ok && unknown.error.code, "BRIDGE_UNKNOWN_METHOD");

  const later = await h.call("wx.onThemeChange", {});
  assert.equal(!later.ok && later.error.code, "API_UNSUPPORTED");
});
