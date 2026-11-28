import assert from "node:assert/strict";
import { test } from "node:test";
import {
  validateRenderNode,
  countNodes,
  VIEW_RENDER_EVENT,
  APP_LIFECYCLE,
  PAGE_LIFECYCLE,
  COMPONENT_LIFECYCLE,
  isLifecycleName,
  canTransitionApp,
  canTransitionPage,
  isPermission,
  validateDeclaredPermissions,
  SYSTEM_PERMISSION_FOR,
  IMPLICIT_PERMISSIONS,
  COMPONENT_REGISTRY,
  componentsForPriority,
  componentByName,
  API_REGISTRY,
  apiByName,
  bridgeMethodAllowlist,
  isErrorCode,
  ERROR_CODES,
  miniAppError,
  isSafePackagePath,
  isSafeRoute,
  isSemver,
  isSha256,
  METRICS,
  median,
  judgeMetric,
  formatMetricResult,
} from "../src/index.js";

test("lifecycle names are recognised and not treated as wx APIs", () => {
  for (const name of [...APP_LIFECYCLE, ...PAGE_LIFECYCLE, ...COMPONENT_LIFECYCLE]) {
    assert.equal(isLifecycleName(name), true, name);
  }
  assert.equal(isLifecycleName("showToast"), false);
});

test("app and page state machines reject invalid transitions", () => {
  assert.equal(canTransitionApp("created", "launching"), true);
  assert.equal(canTransitionApp("closed", "running"), false);
  assert.equal(canTransitionPage("ready", "hidden"), true);
  assert.equal(canTransitionPage("unloaded", "ready"), false);
});

test("permissions: known names, unknown rejected, duplicates removed", () => {
  assert.equal(isPermission("camera"), true);
  assert.equal(isPermission("telepathy"), false);
  assert.deepEqual(validateDeclaredPermissions(["storage", "storage", "network"]), {
    ok: true,
    permissions: ["storage", "network"],
  });
  const bad = validateDeclaredPermissions(["storage", "telepathy"]);
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.deepEqual(bad.unknown, ["telepathy"]);
});

test("implicit permissions need no prompt", () => {
  assert.deepEqual([...IMPLICIT_PERMISSIONS].sort(), ["network", "storage"]);
  assert.equal(SYSTEM_PERMISSION_FOR.camera, "android.permission.CAMERA");
  assert.equal(SYSTEM_PERMISSION_FOR.storage, undefined);
});

test("component registry has the P0 set from the specification", () => {
  const p0 = componentsForPriority("P0").map((component) => component.name);
  assert.deepEqual(p0.sort(), ["button", "image", "input", "scroll-view", "text", "view"]);
  assert.equal(componentByName("navigationBar"), undefined);
  assert.equal(COMPONENT_REGISTRY.every((component) => component.inPage), true);
});

test("API registry entries are complete and unique", () => {
  const names = API_REGISTRY.map((api) => api.name);
  assert.equal(new Set(names).size, names.length);
  for (const api of API_REGISTRY) {
    assert.match(api.name, /^wx\.[a-zA-Z]+$/);
    assert.ok(api.summary.length > 0);
    assert.ok(api.platforms.length > 0);
    if (api.permission) assert.equal(isPermission(api.permission), true);
    for (const code of api.errors) assert.equal(isErrorCode(code), true, `${api.name}: ${code}`);
  }
});

test("the bridge allowlist is derived from the registry", () => {
  const allowlist = bridgeMethodAllowlist();
  assert.ok(allowlist.includes("wx.navigateTo"));
  assert.ok(allowlist.includes("wx.request"));
  assert.equal(allowlist.includes("wx.notAnApi"), false);
  assert.equal(apiByName("wx.showToast")?.milestone, "M4");
  assert.equal(apiByName("wx.onThemeChange")?.milestone, "M7");
});

test("MVP APIs cover navigation, storage, network, UI and system info", () => {
  const mvp = API_REGISTRY.filter((api) => api.milestone === "M4").map((api) => api.name);
  for (const required of [
    "wx.navigateTo", "wx.redirectTo", "wx.switchTab", "wx.navigateBack", "wx.reLaunch",
    "wx.setStorage", "wx.getStorage", "wx.removeStorage", "wx.clearStorage",
    "wx.setStorageSync", "wx.getStorageSync", "wx.removeStorageSync", "wx.clearStorageSync",
    "wx.request", "wx.showToast", "wx.showModal", "wx.showLoading", "wx.hideLoading",
    "wx.getSystemInfoSync",
  ]) {
    assert.ok(mvp.includes(required), required);
  }
});

test("error codes are unique, documented and typed", () => {
  assert.equal(isErrorCode("API_FAILED"), true);
  assert.equal(isErrorCode("api_failed"), false);
  for (const [code, entry] of Object.entries(ERROR_CODES)) {
    assert.match(code, /^[A-Z][A-Z0-9_]+$/);
    assert.equal(typeof entry.retryable, "boolean");
    assert.ok(entry.message.length > 0);
  }
  const error = miniAppError("API_FAILED");
  assert.equal(error.message, ERROR_CODES.API_FAILED.message);
});

test("path, route, semver and hash validators", () => {
  assert.equal(isSafePackagePath("pages/index/index.js"), true);
  assert.equal(isSafePackagePath("../escape.js"), false);
  assert.equal(isSafePackagePath("/abs.js"), false);
  assert.equal(isSafePackagePath("C:/x.js"), false);
  assert.equal(isSafePackagePath("a\\b.js"), false);
  assert.equal(isSafePackagePath("a//b.js"), false);
  assert.equal(isSafeRoute("pages/index/index"), true);
  assert.equal(isSafeRoute("pages/index/index.json"), false);
  assert.equal(isSafeRoute("pages/index/index?x=1"), false);
  assert.equal(isSemver("1.2.3"), true);
  assert.equal(isSemver("1.2"), false);
  assert.equal(isSha256("a".repeat(64)), true);
  assert.equal(isSha256("A".repeat(64)), false);
});

test("render trees accept only QChat web components", () => {
  assert.equal(validateRenderNode({ type: "element", tag: "wx-view", props: {}, children: [] }), true);
  assert.equal(validateRenderNode({ type: "element", tag: "script", props: {}, children: [] }), false);
  assert.equal(validateRenderNode({ type: "element", tag: "iframe", props: {}, children: [] }), false);
  assert.equal(validateRenderNode({ type: "element", tag: "wx-view", props: { onclick: "x" }, children: [] }), true);
  assert.equal(validateRenderNode({ type: "element", tag: "wx-view", props: { "a b": "x" }, children: [] }), false);
  assert.equal(validateRenderNode({ type: "text", text: "ok" }), true);
  assert.equal(VIEW_RENDER_EVENT, "view.render");
  assert.equal(countNodes({ type: "element", tag: "wx-view", props: {}, children: [{ type: "text", text: "a" }] }), 2);
});

test("performance contract: medians, targets and the two-attempt rule", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.throws(() => median([]));

  const sample = {
    metric: "setDataToPaint" as const,
    samples: [80, 90, 120],
    median: 90,
    device: { device: "unverified", os: "android", webview: "unverified", runtime: "0.1.0", packageVersion: "1.0.0" },
    measuredAt: "2026-11-27T00:00:00Z",
  };
  const pass = judgeMetric(sample, []);
  assert.equal(pass.pass, true);
  assert.match(formatMetricResult(pass), /PASS/);

  const miss = { ...sample, samples: [200, 250, 300], median: 250 };
  assert.throws(() => judgeMetric(miss, ["one attempt"]), /two documented optimization attempts/);
  const recorded = judgeMetric(miss, ["one", "two"], "still above target");
  assert.equal(recorded.pass, false);
  assert.equal(recorded.knownLimitation, "still above target");

  assert.equal(METRICS.length, 6);
  assert.equal(METRICS.find((metric) => metric.id === "scroll500")?.comparison, "min");
});
