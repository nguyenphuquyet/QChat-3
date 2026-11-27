/**
 * The JavaScript SDK bootstrap that runs inside the Service Runtime engine.
 *
 * It is the only code that defines `App`, `Page`, `Component`, `getApp`,
 * `getCurrentPages`, `setData` and the tracked timers. The host installs one
 * object, `__qchatHost`, with `emit(json)` and `currentRoute`; nothing else is
 * exposed. The same source runs on Node, QuickJS and JavaScriptCore.
 */
export const SDK_SOURCE = String.raw`
(function () {
  "use strict";
  var host = globalThis.__qchatHost;
  if (!host || typeof host.emit !== "function") throw new Error("__qchatHost is missing");
  var app = null;
  var pageDefs = Object.create(null);
  var componentDefs = Object.create(null);
  var stack = [];
  var timers = new Set();
  var nativeSetTimeout = globalThis.setTimeout;
  var nativeClearTimeout = globalThis.clearTimeout;
  var nativeSetInterval = globalThis.setInterval;
  var nativeClearInterval = globalThis.clearInterval;
  var FORBIDDEN = Object.create(null);
  FORBIDDEN["__proto__"] = 1;
  FORBIDDEN.prototype = 1;
  FORBIDDEN.constructor = 1;

  function post(kind, payload) { host.emit(JSON.stringify({ kind: kind, payload: payload })); }
  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }

  function applyPath(target, key, value) {
    var parts = String(key).split(".");
    var cursor = target;
    for (var index = 0; index < parts.length - 1; index += 1) {
      var part = parts[index];
      if (FORBIDDEN[part]) throw new Error("forbidden setData path");
      if (!cursor[part] || typeof cursor[part] !== "object") cursor[part] = {};
      cursor = cursor[part];
    }
    var last = parts[parts.length - 1];
    if (FORBIDDEN[last]) throw new Error("forbidden setData path");
    cursor[last] = value;
  }

  function setData(patch) {
    var page = stack[stack.length - 1];
    if (!page) throw new Error("setData without a page");
    if (!patch || typeof patch !== "object") throw new Error("setData needs an object");
    for (var key in patch) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) applyPath(page.data, key, clone(patch[key]));
    }
    post("page.setData", { pageId: page.pageId, patch: clone(patch), data: clone(page.data) });
    return { ok: true };
  }

  globalThis.App = function (options) { app = options || {}; };
  globalThis.getApp = function () { return app; };
  globalThis.Page = function (options) {
    if (typeof host.currentRoute !== "string" || host.currentRoute.length === 0) throw new Error("Page() outside a page module");
    pageDefs[host.currentRoute] = options || {};
  };
  globalThis.Component = function (options) {
    if (typeof host.currentRoute !== "string" || host.currentRoute.length === 0) throw new Error("Component() outside a module");
    componentDefs[host.currentRoute] = options || {};
  };
  globalThis.getCurrentPages = function () { return stack.slice(); };
  globalThis.__qchatSetData = setData;

  globalThis.__qchatOpenPage = function (route, query, pageId) {
    var options = pageDefs[route];
    if (!options) return { ok: false, code: "NAVIGATION_INVALID_ROUTE" };
    var previous = stack.length > 0 ? stack[stack.length - 1] : null;
    if (previous && pageDefs[previous.route] && typeof pageDefs[previous.route].onHide === "function") {
      pageDefs[previous.route].onHide.call(previous);
    }
    var page = { pageId: pageId, route: route, data: clone(options.data || {}) };
    page.setData = setData;
    stack.push(page);
    if (typeof options.onLoad === "function") options.onLoad.call(page, query || {});
    if (typeof options.onShow === "function") options.onShow.call(page);
    post("page.open", { pageId: pageId, route: route, data: clone(page.data) });
    return { ok: true, pageId: pageId, data: clone(page.data) };
  };

  globalThis.__qchatClosePage = function (pageId) {
    var index = -1;
    for (var cursor = 0; cursor < stack.length; cursor += 1) if (stack[cursor].pageId === pageId) index = cursor;
    if (index === -1) return { ok: false, code: "BRIDGE_PAGE_CLOSED" };
    var page = stack.splice(index, 1)[0];
    var options = pageDefs[page.route] || {};
    if (typeof options.onHide === "function") options.onHide.call(page);
    if (typeof options.onUnload === "function") options.onUnload.call(page);
    post("page.close", { pageId: pageId, route: page.route });
    return { ok: true };
  };

  globalThis.__qchatDeliver = function (json) {
    var message = JSON.parse(String(json));
    var page = stack[stack.length - 1];
    if (!page) return { ok: false, code: "BRIDGE_PAGE_CLOSED" };
    var options = pageDefs[page.route] || {};
    var handler = message && message.handler;
    if (typeof handler !== "string" || typeof options[handler] !== "function") return { ok: false, code: "BRIDGE_UNKNOWN_METHOD" };
    options[handler].call(page, message.event || message);
    return { ok: true };
  };

  globalThis.__qchatAppLaunch = function (options) {
    if (app && typeof app.onLaunch === "function") app.onLaunch.call(app, options || {});
    if (app && typeof app.onShow === "function") app.onShow.call(app, options || {});
    return { ok: true };
  };
  globalThis.__qchatAppHide = function () {
    if (app && typeof app.onHide === "function") app.onHide.call(app);
    return { ok: true };
  };
  globalThis.__qchatClearTimers = function () {
    timers.forEach(function (id) { nativeClearTimeout(id); nativeClearInterval(id); });
    timers.clear();
    return { ok: true };
  };

  globalThis.setTimeout = function (handler, ms) {
    var id = nativeSetTimeout(handler, Math.min(Number(ms) || 0, 60000));
    timers.add(id);
    return id;
  };
  globalThis.clearTimeout = function (id) { timers.delete(id); nativeClearTimeout(id); };
  globalThis.setInterval = function (handler, ms) {
    var id = nativeSetInterval(handler, Math.max(1, Math.min(Number(ms) || 0, 60000)));
    timers.add(id);
    return id;
  };
  globalThis.clearInterval = function (id) { timers.delete(id); nativeClearInterval(id); };
})();
`;
