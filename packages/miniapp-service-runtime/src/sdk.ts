/**
 * The JavaScript SDK bootstrap that runs inside the Service Runtime engine.
 *
 * It is the only code that defines `App`, `Page`, `Component`, `getApp`,
 * `getCurrentPages`, `setData`, `wx.*` and the tracked timers. The host installs
 * one object, `__qchatHost`, with `emit(json)`, `sync(method, json)` and
 * `currentRoute`; nothing else is exposed. The same source runs on Node, QuickJS
 * and JavaScriptCore.
 *
 * `wx.*` calls leave the engine as one of two message shapes:
 * - `bridge.request` for asynchronous APIs; the host answers by id.
 * - `host.sync` for the APIs that must return a value immediately (storage and
 *   system information). The adapter installs `sync` as a synchronous native
 *   function, so no Promise or timer is involved.
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
  var opened = new Set();
  var timers = new Set();
  var calls = Object.create(null);
  var callSeq = 0;
  var nativeSetTimeout = globalThis.setTimeout;
  var nativeClearTimeout = globalThis.clearTimeout;
  var nativeSetInterval = globalThis.setInterval;
  var nativeClearInterval = globalThis.clearInterval;
  var MAX_STACK = Number(host.maxPageStack) || 10;
  var TAB_PAGES = Array.isArray(host.tabPages) ? host.tabPages.slice() : [];
  var FORBIDDEN = Object.create(null);
  FORBIDDEN["__proto__"] = 1;
  FORBIDDEN.prototype = 1;
  FORBIDDEN.constructor = 1;

  function post(kind, payload) { host.emit(JSON.stringify({ kind: kind, payload: payload })); }
  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function isTab(route) { return TAB_PAGES.indexOf(route) !== -1; }

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
    if (opened.has(page.pageId)) {
      post("page.setData", { pageId: page.pageId, patch: clone(patch), data: clone(page.data) });
    }
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

  // The only path from page logic to a host API. The host answers by calling
  // __qchatResponse with the same id; an unknown id is rejected, never guessed.
  globalThis.__qchatCall = function (method, params) {
    return new Promise(function (resolve, reject) {
      callSeq += 1;
      var id = "s" + callSeq;
      calls[id] = { resolve: resolve, reject: reject, method: method };
      post("bridge.request", { id: id, method: method, params: params || {} });
    });
  };
  globalThis.__qchatResponse = function (json) {
    var message = JSON.parse(String(json));
    var entry = message && calls[message.id];
    if (!entry) return { ok: false, code: "BRIDGE_INVALID_MESSAGE" };
    delete calls[message.id];
    if (message.ok) entry.resolve(message.result);
    else entry.reject(message.error || { code: "API_FAILED", message: "The API call failed." });
    return { ok: true };
  };
  globalThis.__qchatRejectCalls = function () {
    for (var id in calls) {
      calls[id].reject({ code: "BRIDGE_PAGE_CLOSED", message: "The page is closed." });
    }
    calls = Object.create(null);
    return { ok: true };
  };

  function findPage(pageId) {
    for (var index = stack.length - 1; index >= 0; index -= 1) {
      if (stack[index].pageId === pageId) return index;
    }
    return -1;
  }

  function pageOptions(page) { return pageDefs[page.route] || {}; }

  function unload(page) {
    var options = pageOptions(page);
    if (typeof options.onHide === "function") options.onHide.call(page);
    if (typeof options.onUnload === "function") options.onUnload.call(page);
    opened.delete(page.pageId);
    post("page.close", { pageId: page.pageId, route: page.route });
  }

  function openPage(route, query, pageId, hidePrevious) {
    var options = pageDefs[route];
    if (!options) return { ok: false, code: "NAVIGATION_INVALID_ROUTE" };
    if (stack.length >= MAX_STACK) return { ok: false, code: "NAVIGATION_STACK_LIMIT" };
    if (hidePrevious !== false) {
      var previous = stack[stack.length - 1];
      if (previous && typeof pageOptions(previous).onHide === "function") pageOptions(previous).onHide.call(previous);
    }
    var page = { pageId: pageId, route: route, data: clone(options.data || {}) };
    page.setData = setData;
    stack.push(page);
    try {
      if (typeof options.onLoad === "function") options.onLoad.call(page, query || {});
      if (typeof options.onShow === "function") options.onShow.call(page);
    } catch (cause) {
      stack.pop();
      throw cause;
    }
    post("page.open", { pageId: pageId, route: route, data: clone(page.data) });
    opened.add(pageId);
    return { ok: true, pageId: pageId, data: clone(page.data) };
  }

  globalThis.__qchatOpenPage = function (route, query, pageId) {
    return openPage(route, query, pageId);
  };

  // One primitive for every navigation API. The host allocates the page id and
  // loads the page module before calling this; the engine owns lifecycle and the
  // stack, and reports each change as a page.* message.
  globalThis.__qchatNavigate = function (kind, route, query, pageId) {
    if (kind === "open") return openPage(route, query, pageId);
    if (!pageDefs[route]) return { ok: false, code: "NAVIGATION_INVALID_ROUTE" };

    if (kind === "redirect") {
      if (stack.length === 0) return { ok: false, code: "NAVIGATION_INVALID_ROUTE" };
      unload(stack.pop());
      return openPage(route, query, pageId, false);
    }

    if (kind === "reLaunch") {
      while (stack.length > 0) unload(stack.pop());
      return openPage(route, query, pageId);
    }

    if (kind === "switchTab") {
      if (!isTab(route)) return { ok: false, code: "NAVIGATION_NO_TAB_BAR" };
      var existing = -1;
      for (var index = 0; index < stack.length; index += 1) if (stack[index].route === route) existing = index;
      if (existing === -1) {
        while (stack.length > 0) unload(stack.pop());
        return openPage(route, {}, pageId);
      }
      var target = stack[existing];
      for (var cursor = stack.length - 1; cursor >= 0; cursor -= 1) {
        if (cursor !== existing) unload(stack[cursor]);
      }
      stack = [target];
      if (typeof pageOptions(target).onShow === "function") pageOptions(target).onShow.call(target);
      post("page.show", { pageId: target.pageId, route: target.route, data: clone(target.data) });
      return { ok: true, pageId: target.pageId, data: clone(target.data) };
    }

    return { ok: false, code: "NAVIGATION_INVALID_ROUTE" };
  };

  globalThis.__qchatBack = function (delta) {
    var count = Math.max(1, Number(delta) || 1);
    if (stack.length <= 1) return { ok: false, code: "NAVIGATION_STACK_LIMIT" };
    for (var step = 0; step < count && stack.length > 1; step += 1) {
      unload(stack.pop());
    }
    var top = stack[stack.length - 1];
    if (!top) return { ok: false, code: "NAVIGATION_STACK_LIMIT" };
    if (typeof pageOptions(top).onShow === "function") pageOptions(top).onShow.call(top);
    post("page.show", { pageId: top.pageId, route: top.route, data: clone(top.data) });
    return { ok: true, pageId: top.pageId };
  };

  globalThis.__qchatClosePage = function (pageId) {
    var index = findPage(pageId);
    if (index === -1) return { ok: false, code: "BRIDGE_PAGE_CLOSED" };
    unload(stack.splice(index, 1)[0]);
    return { ok: true };
  };

  globalThis.__qchatDeliver = function (json) {
    var message = JSON.parse(String(json));
    var page = stack[stack.length - 1];
    if (!page) return { ok: false, code: "BRIDGE_PAGE_CLOSED" };
    var options = pageOptions(page);
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

  // ---------------------------------------------------------------- wx.* ----
  function syncCall(method, params) {
    if (typeof host.sync !== "function") {
      throw { code: "API_UNSUPPORTED", message: "This engine adapter has no synchronous host channel." };
    }
    var raw = host.sync(method, JSON.stringify(params || {}));
    var response = JSON.parse(String(raw));
    if (response && response.ok) return response.result;
    throw (response && response.error) || { code: "API_FAILED", message: "The API call failed." };
  }

  function asyncCall(method, params, options) {
    var opts = options && typeof options === "object" ? options : {};
    var promise = globalThis.__qchatCall(method, params || {});
    if (typeof opts.success === "function" || typeof opts.fail === "function" || typeof opts.complete === "function") {
      promise.then(function (result) {
        if (typeof opts.success === "function") opts.success(result);
        if (typeof opts.complete === "function") opts.complete(result);
      }, function (error) {
        if (typeof opts.fail === "function") opts.fail(error);
        if (typeof opts.complete === "function") opts.complete(error);
      });
    }
    return promise;
  }

  function requiredString(options, name) {
    if (!options || typeof options[name] !== "string" || options[name].length === 0) {
      throw { code: "API_INVALID_ARGUMENT", message: name + " must be a non-empty string." };
    }
    return options[name];
  }

  function storageKey(options) {
    return requiredString(options, "key");
  }

  function pickRequest(options) {
    var opts = options && typeof options === "object" ? options : {};
    var params = { url: requiredString(opts, "url") };
    if (opts.method !== undefined) params.method = opts.method;
    if (opts.data !== undefined) params.data = clone(opts.data);
    if (opts.header !== undefined) params.header = clone(opts.header);
    if (opts.timeout !== undefined) params.timeout = opts.timeout;
    if (opts.responseType !== undefined) params.responseType = opts.responseType;
    if (opts.dataType !== undefined) params.dataType = opts.dataType;
    return params;
  }

  var wx = {};
  wx.navigateTo = function (options) {
    var params = { url: requiredString(options, "url") };
    return asyncCall("wx.navigateTo", params, options);
  };
  wx.redirectTo = function (options) {
    var params = { url: requiredString(options, "url") };
    return asyncCall("wx.redirectTo", params, options);
  };
  wx.switchTab = function (options) {
    var params = { url: requiredString(options, "url") };
    return asyncCall("wx.switchTab", params, options);
  };
  wx.reLaunch = function (options) {
    var params = { url: requiredString(options, "url") };
    return asyncCall("wx.reLaunch", params, options);
  };
  wx.navigateBack = function (options) {
    var opts = options && typeof options === "object" ? options : {};
    var params = {};
    if (opts.delta !== undefined) params.delta = opts.delta;
    return asyncCall("wx.navigateBack", params, opts);
  };

  wx.setStorage = function (options) {
    return asyncCall("wx.setStorage", { key: storageKey(options), data: clone(options.data) }, options);
  };
  wx.getStorage = function (options) {
    return asyncCall("wx.getStorage", { key: storageKey(options) }, options);
  };
  wx.removeStorage = function (options) {
    return asyncCall("wx.removeStorage", { key: storageKey(options) }, options);
  };
  wx.clearStorage = function (options) {
    return asyncCall("wx.clearStorage", {}, options);
  };
  wx.setStorageSync = function (key, data) {
    if (typeof key !== "string" || key.length === 0) throw { code: "API_INVALID_ARGUMENT", message: "key must be a non-empty string." };
    return syncCall("wx.setStorageSync", { key: key, data: clone(data) });
  };
  wx.getStorageSync = function (key) {
    if (typeof key !== "string" || key.length === 0) throw { code: "API_INVALID_ARGUMENT", message: "key must be a non-empty string." };
    return syncCall("wx.getStorageSync", { key: key });
  };
  wx.removeStorageSync = function (key) {
    if (typeof key !== "string" || key.length === 0) throw { code: "API_INVALID_ARGUMENT", message: "key must be a non-empty string." };
    return syncCall("wx.removeStorageSync", { key: key });
  };
  wx.clearStorageSync = function () {
    return syncCall("wx.clearStorageSync", {});
  };

  wx.request = function (options) {
    return asyncCall("wx.request", pickRequest(options), options);
  };

  wx.showToast = function (options) {
    var opts = options && typeof options === "object" ? options : {};
    return asyncCall("wx.showToast", { title: requiredString(opts, "title"), icon: opts.icon, duration: opts.duration }, opts);
  };
  wx.showModal = function (options) {
    var opts = options && typeof options === "object" ? options : {};
    var params = {};
    if (opts.title !== undefined) params.title = opts.title;
    if (opts.content !== undefined) params.content = opts.content;
    if (opts.showCancel !== undefined) params.showCancel = opts.showCancel;
    if (opts.confirmText !== undefined) params.confirmText = opts.confirmText;
    if (opts.cancelText !== undefined) params.cancelText = opts.cancelText;
    return asyncCall("wx.showModal", params, opts);
  };
  wx.showLoading = function (options) {
    var opts = options && typeof options === "object" ? options : {};
    return asyncCall("wx.showLoading", { title: requiredString(opts, "title"), mask: opts.mask }, opts);
  };
  wx.hideLoading = function (options) {
    return asyncCall("wx.hideLoading", {}, options);
  };

  wx.getSystemInfoSync = function () {
    return syncCall("wx.getSystemInfoSync", {});
  };

  globalThis.wx = wx;
})();
`;
