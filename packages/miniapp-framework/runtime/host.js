/// QChat's Mini Program host runtime.
///
/// The official `glass-easel-miniprogram-webpack-plugin` normally emits a
/// bootstrap that attaches one `glass-easel-root` to `document.body`. QChat is a
/// host: it owns the backend, the `page` root tag and the page stack, and it
/// supplies the Mini Program globals (`App`, `getApp`, `wx`,
/// `getCurrentPages`).
///
/// The plugin is configured with `customBootstrap: true`, so this module is the
/// webpack entry and `src/index.js` (the plugin's generated module) is required
/// from it *after* the globals exist. `app.js` runs during that require and may
/// call `App(...)` or `wx.*` at module scope.

/* eslint-disable no-console */

const adapter = require("glass-easel-miniprogram-adapter");

const config = window.__QCHAT_APP_CONFIG__ || { pages: [] };
const pageConfigs = Array.isArray(config.pages) ? config.pages : [];
const pageRoutes = pageConfigs.map((page) => page.route).filter(Boolean);
const firstRoute = pageRoutes[0] || config.entry || "pages/index/index";

const runtime = window.__QCHAT_RUNTIME__ || (window.__QCHAT_RUNTIME__ = {});
const appId = typeof config.appId === "string" && config.appId ? config.appId : "local";
const storagePrefix = `qchat:storage:${appId}:`;

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

let appDefinition = null;
let appInstance = null;

function App(definition) {
  appDefinition = definition || {};
  appInstance = Object.create(appDefinition);
  appInstance.globalData = appDefinition.globalData || {};
  safeCall(appInstance, "onLaunch", {});
  safeCall(appInstance, "onShow", {});
}

function getApp() {
  if (!appInstance) App({});
  return appInstance;
}

function safeCall(target, name, ...args) {
  const fn = target && target[name];
  if (typeof fn !== "function") return undefined;
  try {
    return fn.apply(target, args);
  } catch (error) {
    console.error(`[qchat] ${name} threw`, error);
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Host bridge helpers
// ---------------------------------------------------------------------------

function hostBridge() {
  return window.qchat && typeof window.qchat.call === "function" ? window.qchat : null;
}

function hostError(message, code) {
  const error = new Error(message);
  error.code = code || "NOT_SUPPORTED";
  return error;
}

/// Runs a bridge call and settles a WeChat-style `{success,fail,complete}`
/// options object. With no callbacks the promise is returned, which is the
/// modern WeChat API shape.
function bridgeCall(method, params, options) {
  const bridge = hostBridge();
  const promise = bridge
    ? Promise.resolve(bridge.call(method, params || {}))
    : Promise.reject(hostError("QChat host is unavailable", "HOST_UNAVAILABLE"));
  if (!options || typeof options !== "object") return promise;
  const { success, fail, complete } = options;
  const done = promise.then(
    (result) => {
      if (typeof success === "function") success(result);
      if (typeof complete === "function") complete(result);
      return result;
    },
    (error) => {
      if (typeof fail === "function") fail(error);
      else console.warn(`[qchat] ${method} failed: ${error && error.message ? error.message : error}`);
      if (typeof complete === "function") complete(error);
      return undefined;
    },
  );
  return done;
}

function unsupported(method, options) {
  const error = hostError(`${method} is not supported by the QChat host`, "NOT_SUPPORTED");
  if (options && typeof options.fail === "function") options.fail(error);
  else console.warn(`[qchat] ${method} is not supported by the QChat host`);
  if (options && typeof options.complete === "function") options.complete(error);
  return Promise.resolve(undefined);
}

function readLocal(key) {
  try {
    const raw = window.localStorage.getItem(storagePrefix + key);
    return raw == null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function writeLocal(key, value) {
  try {
    window.localStorage.setItem(storagePrefix + key, JSON.stringify(value));
  } catch {
    /* storage may be disabled */
  }
}

function removeLocal(key) {
  try {
    window.localStorage.removeItem(storagePrefix + key);
  } catch {
    /* ignore */
  }
}

function clearLocal() {
  try {
    const keys = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key && key.startsWith(storagePrefix)) keys.push(key);
    }
    for (const key of keys) window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

function splitRoute(value) {
  const raw = String(value || "").trim();
  const withoutBase = raw.replace(/^https?:\/\/[^/]+/i, "");
  const trimmed = withoutBase.replace(/^\/+/, "").replace(/^index\.html(?=$|[?#])/, "");
  const hashIndex = trimmed.indexOf("#");
  const withoutHash = hashIndex >= 0 ? trimmed.slice(0, hashIndex) : trimmed;
  const queryIndex = withoutHash.indexOf("?");
  const route = (queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash).replace(/\/+$/, "");
  const query = queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : "";
  return { route, query };
}

function parseQuery(query) {
  const result = {};
  if (!query) return result;
  for (const pair of query.split("&")) {
    if (!pair) continue;
    const index = pair.indexOf("=");
    const key = decodeURIComponent(index >= 0 ? pair.slice(0, index) : pair);
    const value = index >= 0 ? decodeURIComponent(pair.slice(index + 1)) : "";
    result[key] = value;
  }
  return result;
}

/// The Flutter server serves the package under `/<launch-token>/`, so the first
/// path segment belongs to the host and must be preserved by `pushState`.
function basePath() {
  const segments = window.location.pathname.split("/").filter(Boolean);
  return segments.length > 0 ? `/${segments[0]}/` : "/";
}

function routeFromLocation() {
  const segments = window.location.pathname.split("/").filter(Boolean);
  const rest = segments.slice(1).join("/");
  if (!rest || rest === "index.html") return { route: firstRoute, query: "" };
  const parsed = splitRoute(rest);
  if (!parsed.route) return { route: firstRoute, query: parsed.query };
  return parsed;
}

function routeExists(route) {
  return pageRoutes.includes(route);
}

function pageUrl(route, query) {
  return `${basePath()}${route}${query ? `?${query}` : ""}`;
}

function applyUrl(route, query, mode) {
  const url = pageUrl(route, query);
  try {
    if (mode === "replace") window.history.replaceState({}, "", url);
    else window.history.pushState({}, "", url);
  } catch (error) {
    console.warn("[qchat] history update failed", error);
  }
}

// ---------------------------------------------------------------------------
// Page stack
// ---------------------------------------------------------------------------

const stack = [];
let backend = null;
let associated = null;
let codeSpace = null;

function createBackend() {
  backend = new adapter.glassEasel.CurrentWindowBackendContext();
  return backend;
}

function pageCaller(entry) {
  return entry.caller;
}

function mountPage(route, query) {
  if (!codeSpace || !associated) return null;
  const root = associated.createRoot("page", codeSpace, route);
  const placeholder = window.document.createElement("span");
  window.document.body.appendChild(placeholder);
  root.attach(window.document.body, placeholder);
  const host = root.getComponent().getBackendElement();
  const entry = {
    route,
    query,
    root,
    host,
    caller: root.get(),
    params: parseQuery(query),
    hidden: false,
  };
  stack.push(entry);
  safeCall(entry.caller, "onLoad", entry.params);
  safeCall(entry.caller, "onShow");
  // glass-easel does not trigger the `ready` lifetime itself; the host owns
  // that step, exactly like WeChat does after the first render.
  triggerReady(host);
  safeCall(entry.caller, "onReady");
  runtime.currentPages = stack.map((item) => item.caller);
  return entry;
}

/// Walks the rendered page and fires `ready` once for every component. Native
/// rendering keeps the whole component tree in the DOM, and every component
/// host carries its glass-easel component in `__wxElement`.
function triggerReady(element) {
  if (!element) return;
  const component = element.__wxElement;
  if (component && typeof component.triggerLifetime === "function" && !component.__qchatReady) {
    component.__qchatReady = true;
    try {
      component.triggerLifetime("ready", []);
    } catch (error) {
      console.error("[qchat] ready lifetime threw", error);
    }
  }
  const children = element.children;
  if (!children) return;
  for (let index = 0; index < children.length; index += 1) triggerReady(children[index]);
}

function hidePage(entry) {
  if (!entry || entry.hidden) return;
  entry.hidden = true;
  if (entry.host && entry.host.style) entry.host.style.display = "none";
  safeCall(entry.caller, "onHide");
}

function showPage(entry) {
  if (!entry) return;
  if (entry.hidden) {
    entry.hidden = false;
    if (entry.host && entry.host.style) entry.host.style.display = "";
  }
  safeCall(entry.caller, "onShow");
}

function unmountPage(entry) {
  if (!entry) return;
  safeCall(entry.caller, "onUnload");
  try {
    entry.root.release();
  } catch (error) {
    console.warn("[qchat] page release failed", error);
  }
  if (entry.host && entry.host.parentNode) entry.host.parentNode.removeChild(entry.host);
}

function topPage() {
  return stack.length > 0 ? stack[stack.length - 1] : null;
}

function syncToLocation() {
  const { route, query } = routeFromLocation();
  const top = topPage();
  if (top && top.route === route && top.query === query) return;
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    if (stack[index].route === route && stack[index].query === query) {
      while (stack.length - 1 > index) unmountPage(stack.pop());
      showPage(topPage());
      runtime.currentPages = stack.map((item) => item.caller);
      return;
    }
  }
  while (stack.length > 0) unmountPage(stack.pop());
  mountPage(route, query);
}

function navigate(url, mode) {
  const { route, query } = splitRoute(url);
  if (!routeExists(route)) {
    console.warn(`[qchat] unknown page route: ${route}`);
    return false;
  }
  if (mode === "replace") {
    while (stack.length > 0) unmountPage(stack.pop());
    applyUrl(route, query, "replace");
    mountPage(route, query);
    return true;
  }
  hidePage(topPage());
  applyUrl(route, query, "push");
  mountPage(route, query);
  return true;
}

function navigateBack(delta) {
  const steps = Math.max(1, Number(delta) || 1);
  if (stack.length <= 1) return;
  try {
    window.history.go(-steps);
  } catch {
    syncToLocation();
  }
}

// ---------------------------------------------------------------------------
// wx API
// ---------------------------------------------------------------------------

const systemInfoCache = {
  value: null,
};

function fallbackSystemInfo() {
  const width = window.innerWidth || 375;
  const height = window.innerHeight || 667;
  return {
    platform: "webview",
    system: "QChat WebView",
    brand: "qchat",
    model: "QChat",
    pixelRatio: window.devicePixelRatio || 2,
    screenWidth: width,
    screenHeight: height,
    windowWidth: width,
    windowHeight: height,
    statusBarHeight: 0,
    language: (navigator.language || "en").split("-")[0],
    version: "0.0.0",
    SDKVersion: config.sdkVersion || "3.0.0",
    safeArea: { left: 0, right: width, top: 0, bottom: height, width, height },
  };
}

function getSystemInfoSync() {
  return systemInfoCache.value || fallbackSystemInfo();
}

function refreshSystemInfo() {
  bridgeCall("getSystemInfo", {}, {}).then(
    (result) => {
      if (result && typeof result === "object") {
        systemInfoCache.value = Object.assign(getSystemInfoSync(), result);
      }
    },
    () => {},
  );
}

const wx = {
  env: { USER_DATA_PATH: "qchat://user" },

  canIUse() {
    return false;
  },

  nextTick(callback) {
    if (typeof callback === "function") Promise.resolve().then(callback);
  },

  getSystemInfo(options) {
    return bridgeCall("getSystemInfo", {}, options);
  },
  getSystemInfoSync,
  getWindowInfo() {
    const info = getSystemInfoSync();
    return {
      pixelRatio: info.pixelRatio,
      screenWidth: info.screenWidth,
      screenHeight: info.screenHeight,
      windowWidth: info.windowWidth,
      windowHeight: info.windowHeight,
      statusBarHeight: info.statusBarHeight,
      safeArea: info.safeArea,
    };
  },
  getDeviceInfo() {
    const info = getSystemInfoSync();
    return {
      brand: info.brand,
      model: info.model,
      system: info.system,
      platform: info.platform,
    };
  },
  getAppBaseInfo() {
    const info = getSystemInfoSync();
    return { SDKVersion: info.SDKVersion, language: info.language, version: info.version };
  },

  getAppInfo(options) {
    return bridgeCall("getAppInfo", {}, options);
  },
  getUserInfo(options) {
    return bridgeCall("getUserInfo", {}, options);
  },
  getUserProfile(options) {
    return bridgeCall("getUserInfo", {}, options);
  },

  showToast(options) {
    const value = options || {};
    return bridgeCall(
      "showToast",
      { message: String(value.title || value.message || ""), icon: value.icon || "none" },
      value,
    );
  },
  hideToast() {
    return Promise.resolve(undefined);
  },
  showLoading(options) {
    const value = options || {};
    return bridgeCall("showToast", { message: String(value.title || ""), icon: "loading" }, value);
  },
  hideLoading() {
    return Promise.resolve(undefined);
  },
  showModal(options) {
    return unsupported("wx.showModal", options);
  },
  showActionSheet(options) {
    return unsupported("wx.showActionSheet", options);
  },
  setNavigationBarTitle(options) {
    const value = options || {};
    runtime.title = String(value.title || "");
    if (typeof runtime.onTitleChange === "function") runtime.onTitleChange(runtime.title);
    if (value.success) value.success({});
    if (value.complete) value.complete({});
    return Promise.resolve({});
  },
  setNavigationBarColor(options) {
    if (options && options.success) options.success({});
    if (options && options.complete) options.complete({});
    return Promise.resolve({});
  },
  showNavigationBarLoading() {
    return Promise.resolve(undefined);
  },
  hideNavigationBarLoading() {
    return Promise.resolve(undefined);
  },
  pageScrollTo(options) {
    const value = options || {};
    try {
      window.scrollTo({ top: Number(value.scrollTop) || 0, behavior: value.duration ? "smooth" : "auto" });
    } catch {
      window.scrollTo(0, Number(value.scrollTop) || 0);
    }
    if (value.success) value.success({});
    if (value.complete) value.complete({});
    return Promise.resolve({});
  },

  navigateTo(options) {
    const value = options || {};
    const ok = navigate(value.url, "push");
    if (ok) {
      if (value.success) value.success({});
      if (value.complete) value.complete({});
      return Promise.resolve({});
    }
    const error = hostError(`unknown page route: ${value.url}`, "PAGE_NOT_FOUND");
    if (value.fail) value.fail(error);
    if (value.complete) value.complete(error);
    return Promise.resolve(error);
  },
  redirectTo(options) {
    const value = options || {};
    const ok = navigate(value.url, "replace");
    if (ok) {
      if (value.success) value.success({});
      if (value.complete) value.complete({});
      return Promise.resolve({});
    }
    const error = hostError(`unknown page route: ${value.url}`, "PAGE_NOT_FOUND");
    if (value.fail) value.fail(error);
    if (value.complete) value.complete(error);
    return Promise.resolve(error);
  },
  reLaunch(options) {
    const value = options || {};
    const ok = navigate(value.url, "replace");
    if (ok) {
      if (value.success) value.success({});
      if (value.complete) value.complete({});
      return Promise.resolve({});
    }
    const error = hostError(`unknown page route: ${value.url}`, "PAGE_NOT_FOUND");
    if (value.fail) value.fail(error);
    if (value.complete) value.complete(error);
    return Promise.resolve(error);
  },
  switchTab(options) {
    return wx.reLaunch(options);
  },
  navigateBack(options) {
    const value = options || {};
    navigateBack(value.delta);
    if (value.success) value.success({});
    if (value.complete) value.complete({});
    return Promise.resolve({});
  },
  getCurrentPages() {
    return stack.map((entry) => entry.caller);
  },

  getStorage(options) {
    const value = options || {};
    return bridgeCall("getStorage", { key: value.key }, {
      success: (result) => {
        const data = result == null ? undefined : result.value;
        writeLocal(value.key, data);
        if (value.success) value.success({ data });
      },
      fail: (error) => {
        const data = readLocal(value.key);
        if (data !== undefined && value.success) value.success({ data });
        else if (value.fail) value.fail(error);
      },
      complete: value.complete,
    });
  },
  getStorageSync(key) {
    const value = readLocal(key);
    return value === undefined ? "" : value;
  },
  setStorage(options) {
    const value = options || {};
    writeLocal(value.key, value.data);
    return bridgeCall("setStorage", { key: value.key, value: value.data }, value);
  },
  setStorageSync(key, data) {
    writeLocal(key, data);
    bridgeCall("setStorage", { key, value: data }, {}).catch(() => {});
  },
  removeStorage(options) {
    const value = options || {};
    removeLocal(value.key);
    return bridgeCall("removeStorage", { key: value.key }, value);
  },
  removeStorageSync(key) {
    removeLocal(key);
    bridgeCall("removeStorage", { key }, {}).catch(() => {});
  },
  clearStorage(options) {
    clearLocal();
    const value = options || {};
    if (value.success) value.success({});
    if (value.complete) value.complete({});
    return Promise.resolve({});
  },
  clearStorageSync() {
    clearLocal();
  },

  request(options) {
    const value = options || {};
    const url = String(value.url || "");
    const method = String(value.method || "GET").toUpperCase();
    const params = {
      method,
      data: value.data,
      header: value.header,
    };
    if (/^https?:\/\//i.test(url)) params.url = url;
    else params.path = url;
    const call = /^https?:\/\//i.test(url) ? "fetch" : "request";
    return bridgeCall(call, params, value);
  },
  fetch(options) {
    return wx.request(options);
  },

  chooseImage(options) {
    return bridgeCall("chooseImage", options || {}, options);
  },
  chooseMedia(options) {
    return bridgeCall("chooseImage", options || {}, options);
  },
  previewImage(options) {
    return unsupported("wx.previewImage", options);
  },

  share(options) {
    return bridgeCall("share", options || {}, options);
  },
  showShareMenu(options) {
    if (options && options.success) options.success({});
    if (options && options.complete) options.complete({});
    return Promise.resolve({});
  },
  hideShareMenu(options) {
    if (options && options.success) options.success({});
    if (options && options.complete) options.complete({});
    return Promise.resolve({});
  },
  onShareAppMessage(callback) {
    runtime.onShareAppMessage = callback;
    return callback;
  },
  offShareAppMessage() {
    runtime.onShareAppMessage = null;
  },

  getMenuButtonBoundingClientRect() {
    const info = getSystemInfoSync();
    return { width: 87, height: 32, top: info.statusBarHeight + 4, right: info.windowWidth - 7, bottom: info.statusBarHeight + 36, left: info.windowWidth - 94 };
  },

  getSetting(options) {
    return unsupported("wx.getSetting", options);
  },
  authorize(options) {
    return unsupported("wx.authorize", options);
  },
  setClipboardData(options) {
    return unsupported("wx.setClipboardData", options);
  },
  getClipboardData(options) {
    return unsupported("wx.getClipboardData", options);
  },
  vibrateShort(options) {
    if (options && options.success) options.success({});
    if (options && options.complete) options.complete({});
    return Promise.resolve({});
  },
  vibrateLong(options) {
    return wx.vibrateShort(options);
  },
  login(options) {
    return unsupported("wx.login", options);
  },
  checkSession(options) {
    return unsupported("wx.checkSession", options);
  },

  createSelectorQuery() {
    const entry = topPage();
    if (entry && entry.caller && typeof entry.caller.createSelectorQuery === "function") {
      return entry.caller.createSelectorQuery();
    }
    return undefined;
  },
};

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

window.App = App;
window.getApp = getApp;
window.wx = wx;
window.getCurrentPages = wx.getCurrentPages;

// `index.js` is generated by the official plugin. Requiring it evaluates
// `app.js` and every page/component module, so the globals above must already
// be installed.
const index = require("../index.js");

runtime.index = index;
runtime.wx = wx;
runtime.config = config;

createBackend();
index.registerGlobalEventListener(backend);
associated = index.initWithBackend(backend);
codeSpace = index.codeSpace;
runtime.backend = associated;

refreshSystemInfo();

window.addEventListener("popstate", () => {
  syncToLocation();
});

const initial = routeFromLocation();
mountPage(routeExists(initial.route) ? initial.route : firstRoute, initial.query);

runtime.navigate = navigate;
runtime.navigateBack = navigateBack;
