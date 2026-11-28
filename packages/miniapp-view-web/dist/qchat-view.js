"use strict";
var QChatView = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/browser.ts
  var browser_exports = {};

  // ../miniapp-contracts/src/version.ts
  var BRIDGE_VERSION = 1;
  var MAX_BRIDGE_MESSAGE_BYTES = 1024 * 1024;

  // ../miniapp-contracts/src/errors.ts
  var ERROR_CODES = {
    BRIDGE_INVALID_MESSAGE: { retryable: false, message: "The bridge message is malformed." },
    BRIDGE_UNKNOWN_METHOD: { retryable: false, message: "The bridge method is not allowlisted." },
    BRIDGE_ORIGIN_REJECTED: { retryable: false, message: "The message did not come from the app origin." },
    BRIDGE_PAGE_MISMATCH: { retryable: false, message: "The message is bound to another app, session or page." },
    BRIDGE_TIMEOUT: { retryable: true, message: "The request timed out." },
    BRIDGE_CANCELLED: { retryable: false, message: "The request was cancelled." },
    BRIDGE_PAGE_CLOSED: { retryable: false, message: "The page is closed." },
    BRIDGE_TOO_LARGE: { retryable: false, message: "The bridge message is too large." },
    API_UNSUPPORTED: { retryable: false, message: "This API is not supported by this runtime." },
    API_PERMISSION_DENIED: { retryable: false, message: "The Mini App has not been granted this permission." },
    API_INVALID_ARGUMENT: { retryable: false, message: "An API argument is invalid." },
    API_FAILED: { retryable: true, message: "The API call failed." },
    API_CANCELLED: { retryable: false, message: "The API call was cancelled." },
    NAVIGATION_INVALID_ROUTE: { retryable: false, message: "The route is not declared by the package." },
    NAVIGATION_STACK_LIMIT: { retryable: false, message: "The page stack limit was reached." },
    NAVIGATION_NO_TAB_BAR: { retryable: false, message: "The package has no tab bar." },
    STORAGE_KEY_INVALID: { retryable: false, message: "The storage key is invalid." },
    STORAGE_QUOTA_EXCEEDED: { retryable: false, message: "The Mini App storage quota is exhausted." },
    STORAGE_CORRUPT: { retryable: false, message: "The stored value cannot be decoded." },
    NETWORK_DOMAIN_REJECTED: { retryable: false, message: "The host is not on the Mini App domain allowlist." },
    NETWORK_HTTPS_REQUIRED: { retryable: false, message: "Only HTTPS requests are allowed." },
    NETWORK_TIMEOUT: { retryable: true, message: "The network request timed out." },
    NETWORK_RESPONSE_TOO_LARGE: { retryable: false, message: "The response exceeds the size limit." },
    THEME_INVALID_VALUE: { retryable: false, message: "qxColorScheme must be light, dark or auto." },
    THEME_EVENT_FORBIDDEN: { retryable: false, message: "A fixed-theme page must not receive a host theme event." },
    MANIFEST_INVALID: { retryable: false, message: "The package manifest is invalid." },
    MANIFEST_VERSION_UNSUPPORTED: { retryable: false, message: "The package format version is not supported." },
    PACKAGE_SIGNATURE_INVALID: { retryable: false, message: "The package signature is not valid." },
    PACKAGE_HASH_MISMATCH: { retryable: false, message: "A package file does not match its hash." },
    PACKAGE_UNSAFE_PATH: { retryable: false, message: "The package contains an unsafe path." },
    PACKAGE_TOO_LARGE: { retryable: false, message: "The package exceeds the size limit." },
    PACKAGE_FORMAT_UNSUPPORTED: { retryable: false, message: "The package format is not supported." },
    PACKAGE_REVOKED: { retryable: false, message: "This version has been revoked." },
    PACKAGE_DOWNGRADE_BLOCKED: { retryable: false, message: "This downgrade is not allowed." },
    PACKAGE_INSTALL_FAILED: { retryable: true, message: "The package could not be installed." },
    MINIAPP_WEBVIEW_UNSUPPORTED: { retryable: false, message: "The system WebView does not provide the required feature." },
    RUNTIME_CRASH: { retryable: true, message: "The Mini App runtime stopped unexpectedly." },
    RUNTIME_SCRIPT_ERROR: { retryable: false, message: "The Mini App script threw an error." },
    WXML_PARSE_ERROR: { retryable: false, message: "The WXML document is malformed." },
    WXML_INVALID_TAG: { retryable: false, message: "The WXML tag name is invalid." },
    WXML_INVALID_ATTRIBUTE: { retryable: false, message: "The WXML attribute is invalid." },
    WXML_UNCLOSED_TAG: { retryable: false, message: "A WXML element is not closed." },
    WXML_UNEXPECTED_CLOSE_TAG: { retryable: false, message: "A WXML close tag does not match the open element." },
    WXML_UNTERMINATED_COMMENT: { retryable: false, message: "A WXML comment is not terminated." },
    WXML_INVALID_DIRECTIVE: { retryable: false, message: "A WXML directive is misplaced or duplicated." },
    WXML_INVALID_EVENT: { retryable: false, message: "The WXML event binding is invalid." },
    WXML_INVALID_EXPRESSION: { retryable: false, message: "The WXML data expression is invalid." },
    WXML_UNKNOWN_COMPONENT: { retryable: false, message: "The WXML component is not in the component registry." },
    WXML_RENDER_WARNING: { retryable: false, message: "A WXML value could not be rendered as declared." },
    WXSS_PARSE_ERROR: { retryable: false, message: "The WXSS stylesheet is malformed." },
    WXSS_UNSUPPORTED_FEATURE: { retryable: false, message: "This WXSS feature is not supported." },
    COMPILER_UNSUPPORTED_SYNTAX: { retryable: false, message: "The build tool does not support this syntax." },
    COMPILER_UNSUPPORTED_DIRECTIVE: { retryable: false, message: "The build tool does not support this WXML directive." },
    COMPILER_UNSUPPORTED_CONFIG: { retryable: false, message: "The build tool does not support this configuration key." },
    COMPILER_DIAGNOSTIC: { retryable: false, message: "The build failed with a diagnostic." },
    WXS_UNSUPPORTED: { retryable: false, message: "WXS is not implemented in this runtime version." },
    COMPONENT_UNSUPPORTED: { retryable: false, message: "This component is not implemented in this runtime version." }
  };
  function isErrorCode(value) {
    return typeof value === "string" && Object.prototype.hasOwnProperty.call(ERROR_CODES, value);
  }
  function miniAppError(code, message, details) {
    const error = { code, message: message != null ? message : ERROR_CODES[code].message };
    if (details) error.details = details;
    return error;
  }

  // ../miniapp-contracts/src/validate.ts
  function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  function isNonEmptyString(value, max = 4096) {
    return typeof value === "string" && value.length > 0 && value.length <= max;
  }
  function hasOnlyKeys(value, allowed) {
    return Object.keys(value).every((key) => allowed.includes(key));
  }
  function utf8Length(value) {
    return new TextEncoder().encode(value).byteLength;
  }

  // ../miniapp-contracts/src/bridge.ts
  var BASE_KEYS = ["v", "kind", "appId", "sessionId", "pageId"];
  var METHOD = /^[a-z][A-Za-z0-9]*(\.[a-z][A-Za-z0-9]*)+$/;
  var EVENT = /^[a-z][A-Za-z0-9]*(\.[a-z][A-Za-z0-9]*)*$/;
  var ID = /^[A-Za-z0-9_-]{1,64}$/;
  function fail(code, message) {
    return { ok: false, error: miniAppError(code, message) };
  }
  function bindingMatches(value, binding) {
    if (!binding) return true;
    return value.appId === binding.appId && value.sessionId === binding.sessionId && value.pageId === binding.pageId;
  }
  function parseBridgeMessage(value, binding, maxBytes = MAX_BRIDGE_MESSAGE_BYTES) {
    var _a, _b;
    if (!isRecord(value)) return fail("BRIDGE_INVALID_MESSAGE", "A message must be an object.");
    if (value.v !== BRIDGE_VERSION) return fail("BRIDGE_INVALID_MESSAGE", "Unsupported bridge version.");
    if (!isNonEmptyString(value.appId, 128) || !isNonEmptyString(value.sessionId, 128) || !isNonEmptyString(value.pageId, 128)) {
      return fail("BRIDGE_INVALID_MESSAGE", "appId, sessionId and pageId are required.");
    }
    if (!bindingMatches(value, binding)) return fail("BRIDGE_PAGE_MISMATCH");
    const kind = value.kind;
    if (kind === "request") {
      if (!hasOnlyKeys(value, [...BASE_KEYS, "id", "method", "params"])) {
        return fail("BRIDGE_INVALID_MESSAGE", "Unexpected request key.");
      }
      if (!isNonEmptyString(value.id, 64) || !ID.test(value.id)) return fail("BRIDGE_INVALID_MESSAGE", "Invalid request id.");
      if (typeof value.method !== "string" || !METHOD.test(value.method)) {
        return fail("BRIDGE_INVALID_MESSAGE", "Invalid method name.");
      }
      if (value.params !== void 0 && !isRecord(value.params)) {
        return fail("BRIDGE_INVALID_MESSAGE", "params must be an object.");
      }
      const message = {
        v: BRIDGE_VERSION,
        kind,
        appId: value.appId,
        sessionId: value.sessionId,
        pageId: value.pageId,
        id: value.id,
        method: value.method,
        params: (_a = value.params) != null ? _a : {}
      };
      return checkSize(message, maxBytes);
    }
    if (kind === "response") {
      if (!hasOnlyKeys(value, [...BASE_KEYS, "id", "ok", "result", "error"])) {
        return fail("BRIDGE_INVALID_MESSAGE", "Unexpected response key.");
      }
      if (!isNonEmptyString(value.id, 64) || !ID.test(value.id)) return fail("BRIDGE_INVALID_MESSAGE", "Invalid request id.");
      if (typeof value.ok !== "boolean") return fail("BRIDGE_INVALID_MESSAGE", "ok must be a boolean.");
      if (value.ok && value.error !== void 0) return fail("BRIDGE_INVALID_MESSAGE", "A successful response cannot carry an error.");
      if (!value.ok) {
        if (!isRecord(value.error)) return fail("BRIDGE_INVALID_MESSAGE", "A failed response needs an error.");
        if (!isErrorCode(value.error.code)) return fail("BRIDGE_INVALID_MESSAGE", "Unknown error code.");
        if (!isNonEmptyString(value.error.message, 2048)) return fail("BRIDGE_INVALID_MESSAGE", "Invalid error message.");
        if (value.error.details !== void 0 && !isRecord(value.error.details)) {
          return fail("BRIDGE_INVALID_MESSAGE", "error.details must be an object.");
        }
      }
      const message = {
        v: BRIDGE_VERSION,
        kind,
        appId: value.appId,
        sessionId: value.sessionId,
        pageId: value.pageId,
        id: value.id,
        ok: value.ok,
        result: value.result,
        error: value.error
      };
      return checkSize(message, maxBytes);
    }
    if (kind === "event") {
      if (!hasOnlyKeys(value, [...BASE_KEYS, "event", "payload"])) {
        return fail("BRIDGE_INVALID_MESSAGE", "Unexpected event key.");
      }
      if (typeof value.event !== "string" || !EVENT.test(value.event) || value.event.length > 64) {
        return fail("BRIDGE_INVALID_MESSAGE", "Invalid event name.");
      }
      if (value.payload !== void 0 && !isRecord(value.payload)) {
        return fail("BRIDGE_INVALID_MESSAGE", "payload must be an object.");
      }
      const message = {
        v: BRIDGE_VERSION,
        kind,
        appId: value.appId,
        sessionId: value.sessionId,
        pageId: value.pageId,
        event: value.event,
        payload: (_b = value.payload) != null ? _b : {}
      };
      return checkSize(message, maxBytes);
    }
    if (kind === "cancel") {
      if (!hasOnlyKeys(value, [...BASE_KEYS, "id"])) {
        return fail("BRIDGE_INVALID_MESSAGE", "Unexpected cancel key.");
      }
      if (!isNonEmptyString(value.id, 64) || !ID.test(value.id)) return fail("BRIDGE_INVALID_MESSAGE", "Invalid request id.");
      const message = {
        v: BRIDGE_VERSION,
        kind,
        appId: value.appId,
        sessionId: value.sessionId,
        pageId: value.pageId,
        id: value.id
      };
      return checkSize(message, maxBytes);
    }
    return fail("BRIDGE_INVALID_MESSAGE", "Unknown message kind.");
  }
  function checkSize(message, maxBytes) {
    if (utf8Length(JSON.stringify(message)) > maxBytes) return fail("BRIDGE_TOO_LARGE");
    return { ok: true, message };
  }

  // ../miniapp-contracts/src/permissions.ts
  var PERMISSIONS = [
    "camera",
    "photoLibrary",
    "microphone",
    "location",
    "clipboardRead",
    "clipboardWrite",
    "scanCode",
    "fileRead",
    "fileWrite",
    "network",
    "storage"
  ];
  var IMPLICIT_PERMISSIONS = ["network", "storage"];
  var PROMPTED_PERMISSIONS = PERMISSIONS.filter(
    (permission) => !IMPLICIT_PERMISSIONS.includes(permission)
  );

  // ../miniapp-contracts/src/apis.ts
  var p = (name, type, required, description) => ({ name, type, required, description });
  var API_REGISTRY = [
    {
      name: "wx.navigateTo",
      summary: "Open a new page on top of the stack.",
      params: [p("url", "string", true, "Declared page route, optionally with a query."), p("events", "object", false, "Page-to-page event handlers.")],
      result: "void",
      calling: "callback",
      promise: true,
      permission: null,
      platforms: ["android", "ios"],
      errors: ["NAVIGATION_INVALID_ROUTE", "NAVIGATION_STACK_LIMIT", "BRIDGE_TIMEOUT"],
      status: "Not started",
      milestone: "M4"
    },
    {
      name: "wx.redirectTo",
      summary: "Replace the current page.",
      params: [p("url", "string", true, "Declared page route.")],
      result: "void",
      calling: "callback",
      promise: true,
      permission: null,
      platforms: ["android", "ios"],
      errors: ["NAVIGATION_INVALID_ROUTE", "BRIDGE_TIMEOUT"],
      status: "Not started",
      milestone: "M4"
    },
    {
      name: "wx.switchTab",
      summary: "Switch to a tab bar page.",
      params: [p("url", "string", true, "Declared tab page route.")],
      result: "void",
      calling: "callback",
      promise: true,
      permission: null,
      platforms: ["android", "ios"],
      errors: ["NAVIGATION_INVALID_ROUTE", "NAVIGATION_NO_TAB_BAR", "BRIDGE_TIMEOUT"],
      status: "Not started",
      milestone: "M4"
    },
    {
      name: "wx.navigateBack",
      summary: "Close pages and return to a lower page.",
      params: [p("delta", "number", false, "Number of pages to close; default 1.")],
      result: "void",
      calling: "callback",
      promise: true,
      permission: null,
      platforms: ["android", "ios"],
      errors: ["NAVIGATION_STACK_LIMIT", "BRIDGE_TIMEOUT"],
      status: "Not started",
      milestone: "M4"
    },
    {
      name: "wx.reLaunch",
      summary: "Close every page and open a route.",
      params: [p("url", "string", true, "Declared page route.")],
      result: "void",
      calling: "callback",
      promise: true,
      permission: null,
      platforms: ["android", "ios"],
      errors: ["NAVIGATION_INVALID_ROUTE", "BRIDGE_TIMEOUT"],
      status: "Not started",
      milestone: "M4"
    },
    {
      name: "wx.setStorage",
      summary: "Store a value asynchronously in the Mini App sandbox.",
      params: [p("key", "string", true, "Key, 1-256 characters."), p("data", "any", true, "JSON-serialisable value.")],
      result: "void",
      calling: "callback",
      promise: true,
      permission: "storage",
      platforms: ["android", "ios"],
      errors: ["STORAGE_KEY_INVALID", "STORAGE_QUOTA_EXCEEDED", "BRIDGE_TIMEOUT"],
      status: "Not started",
      milestone: "M4"
    },
    {
      name: "wx.setStorageSync",
      summary: "Store a value synchronously.",
      params: [p("key", "string", true, "Key, 1-256 characters."), p("data", "any", true, "JSON-serialisable value.")],
      result: "void",
      calling: "sync",
      promise: false,
      permission: "storage",
      platforms: ["android", "ios"],
      errors: ["STORAGE_KEY_INVALID", "STORAGE_QUOTA_EXCEEDED"],
      status: "Not started",
      milestone: "M4"
    },
    {
      name: "wx.getStorage",
      summary: "Read a value asynchronously.",
      params: [p("key", "string", true, "Key.")],
      result: "any",
      calling: "callback",
      promise: true,
      permission: "storage",
      platforms: ["android", "ios"],
      errors: ["STORAGE_KEY_INVALID", "STORAGE_CORRUPT", "BRIDGE_TIMEOUT"],
      status: "Not started",
      milestone: "M4"
    },
    {
      name: "wx.getStorageSync",
      summary: "Read a value synchronously.",
      params: [p("key", "string", true, "Key.")],
      result: "any",
      calling: "sync",
      promise: false,
      permission: "storage",
      platforms: ["android", "ios"],
      errors: ["STORAGE_KEY_INVALID", "STORAGE_CORRUPT"],
      status: "Not started",
      milestone: "M4"
    },
    {
      name: "wx.removeStorage",
      summary: "Remove one key asynchronously.",
      params: [p("key", "string", true, "Key.")],
      result: "void",
      calling: "callback",
      promise: true,
      permission: "storage",
      platforms: ["android", "ios"],
      errors: ["STORAGE_KEY_INVALID", "BRIDGE_TIMEOUT"],
      status: "Not started",
      milestone: "M4"
    },
    {
      name: "wx.removeStorageSync",
      summary: "Remove one key synchronously.",
      params: [p("key", "string", true, "Key.")],
      result: "void",
      calling: "sync",
      promise: false,
      permission: "storage",
      platforms: ["android", "ios"],
      errors: ["STORAGE_KEY_INVALID"],
      status: "Not started",
      milestone: "M4"
    },
    {
      name: "wx.clearStorage",
      summary: "Remove every key of this Mini App asynchronously.",
      params: [],
      result: "void",
      calling: "callback",
      promise: true,
      permission: "storage",
      platforms: ["android", "ios"],
      errors: ["BRIDGE_TIMEOUT"],
      status: "Not started",
      milestone: "M4"
    },
    {
      name: "wx.clearStorageSync",
      summary: "Remove every key of this Mini App synchronously.",
      params: [],
      result: "void",
      calling: "sync",
      promise: false,
      permission: "storage",
      platforms: ["android", "ios"],
      errors: [],
      status: "Not started",
      milestone: "M4"
    },
    {
      name: "wx.request",
      summary: "HTTPS request to an allowlisted domain.",
      params: [
        p("url", "string", true, "HTTPS URL on the Mini App domain allowlist."),
        p("method", "string", false, "HTTP method; default GET."),
        p("data", "any", false, "Request body or query data."),
        p("header", "object", false, "Request headers."),
        p("timeout", "number", false, "Timeout in milliseconds.")
      ],
      result: "object",
      calling: "callback",
      promise: true,
      permission: "network",
      platforms: ["android", "ios"],
      errors: ["NETWORK_DOMAIN_REJECTED", "NETWORK_HTTPS_REQUIRED", "NETWORK_TIMEOUT", "NETWORK_RESPONSE_TOO_LARGE", "BRIDGE_TIMEOUT"],
      status: "Not started",
      milestone: "M4"
    },
    {
      name: "wx.showToast",
      summary: "Show a short host-drawn toast.",
      params: [p("title", "string", true, "Text."), p("icon", "string", false, "success, error, loading or none."), p("duration", "number", false, "Milliseconds.")],
      result: "void",
      calling: "callback",
      promise: true,
      permission: null,
      platforms: ["android", "ios"],
      errors: ["BRIDGE_TIMEOUT"],
      status: "Not started",
      milestone: "M4"
    },
    {
      name: "wx.showModal",
      summary: "Show a host-drawn modal with confirm and cancel.",
      params: [p("title", "string", false, "Title."), p("content", "string", false, "Body."), p("showCancel", "boolean", false, "Show cancel; default true.")],
      result: "object",
      calling: "callback",
      promise: true,
      permission: null,
      platforms: ["android", "ios"],
      errors: ["BRIDGE_TIMEOUT", "BRIDGE_CANCELLED"],
      status: "Not started",
      milestone: "M4"
    },
    {
      name: "wx.showLoading",
      summary: "Show a host-drawn loading overlay.",
      params: [p("title", "string", true, "Text."), p("mask", "boolean", false, "Block taps.")],
      result: "void",
      calling: "callback",
      promise: true,
      permission: null,
      platforms: ["android", "ios"],
      errors: ["BRIDGE_TIMEOUT"],
      status: "Not started",
      milestone: "M4"
    },
    {
      name: "wx.hideLoading",
      summary: "Hide the loading overlay.",
      params: [],
      result: "void",
      calling: "callback",
      promise: true,
      permission: null,
      platforms: ["android", "ios"],
      errors: ["BRIDGE_TIMEOUT"],
      status: "Not started",
      milestone: "M4"
    },
    {
      name: "wx.getSystemInfoSync",
      summary: "Read the documented system information fields, including the resolved theme.",
      params: [],
      result: "object",
      calling: "sync",
      promise: false,
      permission: null,
      platforms: ["android", "ios"],
      errors: [],
      status: "Not started",
      milestone: "M4"
    },
    {
      name: "wx.onThemeChange",
      summary: "Listen for a change of the resolved theme.",
      params: [p("callback", "function", true, "Called with the resolved theme.")],
      result: "void",
      calling: "sync",
      promise: false,
      permission: null,
      platforms: ["android", "ios"],
      errors: [],
      status: "Not started",
      milestone: "M7"
    },
    {
      name: "wx.offThemeChange",
      summary: "Remove a resolved-theme listener.",
      params: [p("callback", "function", false, "Listener to remove; all when omitted.")],
      result: "void",
      calling: "sync",
      promise: false,
      permission: null,
      platforms: ["android", "ios"],
      errors: [],
      status: "Not started",
      milestone: "M7"
    }
  ];
  var API_ERROR_CODES = Object.keys(ERROR_CODES).filter(
    (code) => code.startsWith("API_") || code.startsWith("NAVIGATION_") || code.startsWith("STORAGE_") || code.startsWith("NETWORK_")
  );

  // ../miniapp-contracts/src/theme.ts
  function isResolvedTheme(value) {
    return value === "light" || value === "dark";
  }

  // ../miniapp-contracts/src/manifest.ts
  var MAX_PACKAGE_BYTES = 32 * 1024 * 1024;

  // ../miniapp-contracts/src/renderer.ts
  var VIEW_RENDER_EVENT = "view.render";
  var VIEW_THEME_EVENT = "view.theme";
  var VIEW_DESTROY_EVENT = "view.destroy";
  var VIEW_INPUT_EVENT = "view.event";
  var VIEW_READY_EVENT = "view.ready";
  var VIEW_ERROR_EVENT = "view.error";
  function validateRenderNode(value, depth = 0) {
    if (depth > 64) return false;
    if (typeof value !== "object" || value === null) return false;
    const node = value;
    if (node.type === "text") return typeof node.text === "string" && node.text.length <= 1e5;
    if (node.type !== "element") return false;
    if (typeof node.tag !== "string" || !/^wx-[a-z][a-z0-9-]{0,61}$/.test(node.tag)) return false;
    if (typeof node.props !== "object" || node.props === null || Array.isArray(node.props)) return false;
    for (const [name, prop] of Object.entries(node.props)) {
      if (!/^[a-zA-Z][a-zA-Z0-9:_-]{0,63}$/.test(name)) return false;
      if (!["string", "number", "boolean"].includes(typeof prop)) return false;
      if (typeof prop === "string" && prop.length > 1e5) return false;
    }
    if (node.dataset !== void 0 && !validateDataset(node.dataset)) return false;
    if (node.events !== void 0 && !validateEvents(node.events)) return false;
    if (!Array.isArray(node.children)) return false;
    return node.children.every((child) => validateRenderNode(child, depth + 1));
  }
  var PROP_NAME = /^[a-zA-Z][a-zA-Z0-9:_-]{0,63}$/;
  var EVENT_TYPE = /^[a-z][a-zA-Z0-9:_-]{0,31}$/;
  var DATASET_NAME = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
  var MAX_PATH_DEPTH = 64;
  function isRenderPropValue(value) {
    if (typeof value === "string") return value.length <= 1e5;
    if (typeof value === "number") return Number.isFinite(value);
    return typeof value === "boolean";
  }
  function validateDataset(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    for (const [name, entry] of Object.entries(value)) {
      if (!DATASET_NAME.test(name) || typeof entry !== "string" || entry.length > 4096) return false;
    }
    return true;
  }
  function validateEvents(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    for (const [type, binding] of Object.entries(value)) {
      if (!EVENT_TYPE.test(type)) return false;
      if (typeof binding !== "object" || binding === null) return false;
      const entry = binding;
      if (typeof entry.handler !== "string" || entry.handler.length === 0 || entry.handler.length > 128) return false;
      if (entry.catch !== void 0 && typeof entry.catch !== "boolean") return false;
    }
    return true;
  }
  function validatePath(value) {
    return Array.isArray(value) && value.length <= MAX_PATH_DEPTH && value.every((index) => typeof index === "number" && Number.isSafeInteger(index) && index >= 0 && index <= 1e6);
  }
  function validateRenderOp(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const op = value;
    if (!validatePath(op.path)) return false;
    switch (op.op) {
      case "replace":
        return validateRenderNode(op.node);
      case "setText":
        return typeof op.text === "string" && op.text.length <= 1e5;
      case "setProp":
        return typeof op.name === "string" && PROP_NAME.test(op.name) && isRenderPropValue(op.value);
      case "removeProp":
        return typeof op.name === "string" && PROP_NAME.test(op.name);
      case "setDataset":
        return validateDataset(op.dataset);
      case "setEvents":
        return validateEvents(op.events);
      case "insert":
        return typeof op.index === "number" && Number.isSafeInteger(op.index) && op.index >= 0 && validateRenderNode(op.node);
      case "remove":
        return typeof op.index === "number" && Number.isSafeInteger(op.index) && op.index >= 0;
      default:
        return false;
    }
  }
  function validateRenderOps(value) {
    return Array.isArray(value) && value.length <= 1e4 && value.every((entry) => validateRenderOp(entry));
  }
  function validateRenderPayload(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const payload = value;
    if (typeof payload.pageId !== "string" || !/^p[0-9]{1,9}$/.test(payload.pageId)) return false;
    if (typeof payload.seq !== "number" || !Number.isSafeInteger(payload.seq) || payload.seq < 1) return false;
    const update = payload.update;
    if (typeof update !== "object" || update === null || Array.isArray(update)) return false;
    const entry = update;
    if (!isResolvedTheme(entry.theme)) return false;
    if (entry.kind === "tree") return validateRenderNode(entry.tree);
    if (entry.kind === "ops") return validateRenderOps(entry.ops);
    return false;
  }
  function countNodes(node) {
    if (node.type === "text") return 1;
    return 1 + node.children.reduce((total, child) => total + countNodes(child), 0);
  }

  // ../miniapp-view-runtime/src/session.ts
  function createRenderSession(renderer) {
    let lastSeq = 0;
    let currentPage = null;
    let hasTree = false;
    let appliedTheme = null;
    return {
      apply(payload) {
        if (!validateRenderPayload(payload)) throw new Error("invalid render payload");
        const message = payload;
        if (message.seq <= lastSeq) return "ignored";
        const update = message.update;
        if (update.kind === "ops") {
          if (!hasTree) throw new Error("render ops before a page tree");
          if (currentPage !== message.pageId) {
            throw new Error("render ops for ".concat(message.pageId, " but the current tree is ").concat(currentPage != null ? currentPage : "none"));
          }
          renderer.patch(update.ops);
        } else {
          renderer.render(update.tree);
          hasTree = true;
          currentPage = message.pageId;
        }
        if (appliedTheme !== update.theme) {
          renderer.setTheme(update.theme);
          appliedTheme = update.theme;
        }
        lastSeq = message.seq;
        return update.kind;
      },
      seq() {
        return lastSeq;
      },
      pageId() {
        return currentPage;
      }
    };
  }

  // ../miniapp-view-runtime/src/index.ts
  var DEFAULT_MAX_NODES = 2e4;
  function attributeValue(value) {
    if (value === false) return null;
    return value === true ? "" : String(value);
  }
  function canReuse(previous, next) {
    if (previous.node.type !== next.type) return false;
    if (next.type === "text") return true;
    return previous.node.tag === next.tag && previous.node.key === next.key;
  }
  function createViewRenderer(adapter, options = {}) {
    var _a, _b;
    const maxNodes = (_a = options.maxNodes) != null ? _a : DEFAULT_MAX_NODES;
    const now = (_b = options.now) != null ? _b : (() => Date.now());
    let mounted = [];
    let tree = null;
    let currentTheme = null;
    let destroyed = false;
    function emitEvent(binding, dataset, event) {
      var _a2, _b2, _c;
      (_c = options.onEvent) == null ? void 0 : _c.call(options, {
        handler: binding.handler,
        type: event.type,
        detail: (_a2 = event.detail) != null ? _a2 : {},
        dataset,
        catch: (_b2 = binding.catch) != null ? _b2 : false,
        timeStamp: now()
      });
    }
    function create(node) {
      var _a2, _b2, _c;
      if (node.type === "text") {
        return {
          node,
          handle: adapter.createText(node.text),
          dataset: {},
          listeners: /* @__PURE__ */ new Map(),
          children: []
        };
      }
      const handle = adapter.createElement(node.tag);
      for (const [name, value] of Object.entries(node.props)) {
        const serialized = attributeValue(value);
        if (serialized !== null) adapter.setAttribute(handle, name, serialized);
      }
      const record = {
        node,
        handle,
        dataset: { ...(_a2 = node.dataset) != null ? _a2 : {} },
        listeners: /* @__PURE__ */ new Map(),
        children: []
      };
      for (const [type, binding] of Object.entries((_b2 = node.events) != null ? _b2 : {})) {
        const listener = {
          binding,
          handle: (event) => emitEvent(binding, record.dataset, event)
        };
        adapter.addEventListener(handle, type, listener.handle, { stopPropagation: (_c = binding.catch) != null ? _c : false });
        record.listeners.set(type, listener);
      }
      record.children = node.children.map((child) => create(child));
      for (const child of record.children) adapter.appendChild(handle, child.handle);
      return record;
    }
    function update(record, next) {
      var _a2, _b2, _c, _d, _e;
      if (next.type === "text") {
        if (record.node.text !== next.text) adapter.setText(record.handle, next.text);
        record.node = next;
        return;
      }
      const previous = record.node;
      const element = next;
      for (const name of Object.keys(previous.props)) {
        if (!(name in element.props) || attributeValue(element.props[name]) === null) {
          adapter.removeAttribute(record.handle, name);
        }
      }
      for (const [name, value] of Object.entries(element.props)) {
        const serialized = attributeValue(value);
        if (serialized === null) {
          adapter.removeAttribute(record.handle, name);
        } else if (attributeValue(previous.props[name]) !== serialized) {
          adapter.setAttribute(record.handle, name, serialized);
        }
      }
      record.dataset = { ...(_a2 = element.dataset) != null ? _a2 : {} };
      const nextEvents = (_b2 = element.events) != null ? _b2 : {};
      for (const [type, listener] of record.listeners) {
        if (!(type in nextEvents)) {
          adapter.removeEventListener(record.handle, type, listener.handle);
          record.listeners.delete(type);
        }
      }
      for (const [type, binding] of Object.entries(nextEvents)) {
        const existing = record.listeners.get(type);
        if (existing && existing.binding.handler === binding.handler && ((_c = existing.binding.catch) != null ? _c : false) === ((_d = binding.catch) != null ? _d : false)) {
          existing.binding = binding;
          continue;
        }
        if (existing) adapter.removeEventListener(record.handle, type, existing.handle);
        const listener = {
          binding,
          handle: (event) => emitEvent(binding, record.dataset, event)
        };
        adapter.addEventListener(record.handle, type, listener.handle, { stopPropagation: (_e = binding.catch) != null ? _e : false });
        record.listeners.set(type, listener);
      }
      reconcile(record, element.children);
      record.node = next;
    }
    function reconcile(parent, nextChildren) {
      const current = parent.children;
      for (let index = 0; index < nextChildren.length; index += 1) {
        const next = nextChildren[index];
        const previous = current[index];
        if (previous && canReuse(previous, next)) {
          update(previous, next);
          continue;
        }
        const created = create(next);
        if (previous) {
          destroyRecord(previous);
          adapter.removeChild(parent.handle, previous.handle);
          adapter.insertBefore(parent.handle, created.handle, index);
          current[index] = created;
        } else {
          adapter.insertBefore(parent.handle, created.handle, index);
          current.push(created);
        }
      }
      while (current.length > nextChildren.length) {
        const removed = current.pop();
        if (!removed) break;
        destroyRecord(removed);
        adapter.removeChild(parent.handle, removed.handle);
      }
    }
    function destroyRecord(record) {
      for (const [type, listener] of record.listeners) {
        adapter.removeEventListener(record.handle, type, listener.handle);
      }
      record.listeners.clear();
      for (const child of record.children) destroyRecord(child);
      record.children = [];
    }
    function render(next) {
      if (destroyed) throw new Error("the view renderer is destroyed");
      if (!validateRenderNode(next)) throw new Error("invalid render tree");
      if (countNodes(next) > maxNodes) throw new Error("render tree exceeds ".concat(maxNodes, " nodes"));
      if (mounted.length === 0) {
        const record = create(next);
        adapter.insertBefore(adapter.root, record.handle, 0);
        mounted = [record];
      } else if (canReuse(mounted[0], next)) {
        update(mounted[0], next);
      } else {
        destroyRecord(mounted[0]);
        adapter.removeChild(adapter.root, mounted[0].handle);
        const record = create(next);
        adapter.insertBefore(adapter.root, record.handle, 0);
        mounted = [record];
      }
      tree = next;
    }
    function patch(ops) {
      if (!tree) throw new Error("patch before render");
      if (ops.length === 1 && ops[0].op === "replace" && ops[0].path.length === 0) {
        render(ops[0].node);
        return;
      }
      const next = cloneRenderNode(tree);
      for (const operation of ops) {
        applyOp(next, operation);
      }
      render(next);
    }
    function applyOp(root, operation) {
      if (operation.op === "insert" || operation.op === "remove") {
        const parent2 = operation.path.length === 0 ? root : nodeAt(root, operation.path);
        if (!parent2 || parent2.type !== "element") throw new Error("insert/remove needs an element path");
        const children2 = parent2.children;
        if (operation.op === "insert") {
          if (!Number.isInteger(operation.index) || operation.index < 0 || operation.index > children2.length) {
            throw new Error("insert index is out of range");
          }
          children2.splice(operation.index, 0, operation.node);
        } else {
          if (!Number.isInteger(operation.index) || operation.index < 0 || operation.index >= children2.length) {
            throw new Error("remove index is out of range");
          }
          children2.splice(operation.index, 1);
        }
        return;
      }
      if (operation.path.length === 0) throw new Error("the root cannot be replaced by an operation");
      const parentPath = operation.path.slice(0, -1);
      const index = operation.path[operation.path.length - 1];
      const parent = parentPath.length === 0 ? root : nodeAt(root, parentPath);
      if (!parent || parent.type !== "element") throw new Error("operation path does not resolve to an element");
      const children = parent.children;
      if (!Number.isInteger(index) || index < 0 || index >= children.length) throw new Error("operation index is out of range");
      if (operation.op === "replace") {
        children[index] = operation.node;
      } else if (operation.op === "setText") {
        const target = children[index];
        if (target.type !== "text") throw new Error("setText needs a text node");
        target.text = operation.text;
      } else if (operation.op === "setProp") {
        const target = children[index];
        if (target.type !== "element") throw new Error("setProp needs an element");
        target.props[operation.name] = operation.value;
      } else if (operation.op === "setDataset") {
        const target = children[index];
        if (target.type !== "element") throw new Error("setDataset needs an element");
        target.dataset = { ...operation.dataset };
      } else if (operation.op === "setEvents") {
        const target = children[index];
        if (target.type !== "element") throw new Error("setEvents needs an element");
        target.events = { ...operation.events };
      } else {
        const target = children[index];
        if (target.type !== "element") throw new Error("removeProp needs an element");
        delete target.props[operation.name];
      }
    }
    function nodeAt(root, path) {
      let node = root;
      for (const index of path) {
        if (!node || node.type !== "element") return null;
        node = node.children[index];
        if (!node) return null;
      }
      return node != null ? node : null;
    }
    return {
      render,
      patch,
      setTheme(theme) {
        if (destroyed) throw new Error("the view renderer is destroyed");
        currentTheme = theme;
        adapter.setRootTheme(theme);
      },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        for (const record of mounted) {
          destroyRecord(record);
          adapter.removeChild(adapter.root, record.handle);
        }
        mounted = [];
        tree = null;
      },
      currentTree() {
        return tree;
      },
      theme() {
        return currentTheme;
      }
    };
  }
  function cloneRenderNode(node) {
    if (node.type === "text") return { type: "text", text: node.text };
    const copy = {
      type: "element",
      tag: node.tag,
      props: { ...node.props },
      children: node.children.map(cloneRenderNode)
    };
    if (node.key !== void 0) copy.key = node.key;
    if (node.dataset) copy.dataset = { ...node.dataset };
    if (node.events) {
      copy.events = {};
      for (const [type, binding] of Object.entries(node.events)) {
        copy.events[type] = { handler: binding.handler, ...binding.catch ? { catch: true } : {} };
      }
    }
    return copy;
  }

  // src/dom.ts
  var VIEW_ROOT_ID = "qchat-root";
  var WXML_TO_DOM_EVENT = { tap: "click" };
  var TAG = /^wx-[a-z][a-z0-9-]{0,61}$/;
  function safeDetail(value) {
    if (!isRecord(value)) return {};
    try {
      const parsed = JSON.parse(JSON.stringify(value));
      return isRecord(parsed) ? parsed : {};
    } catch (e) {
      return {};
    }
  }
  function toDomEvent(type, native) {
    const detail = safeDetail(native.detail);
    if ((type === "input" || type === "change") && detail.value === void 0) {
      const target = native.target;
      if (target && typeof target.value === "string") detail.value = target.value;
    }
    if (type === "tap") {
      if (detail.x === void 0) detail.x = typeof native.clientX === "number" ? native.clientX : 0;
      if (detail.y === void 0) detail.y = typeof native.clientY === "number" ? native.clientY : 0;
    }
    return { type, detail, dataset: {} };
  }
  function createBrowserDomAdapter(document, root) {
    const handles = /* @__PURE__ */ new Map();
    const listeners = /* @__PURE__ */ new Map();
    let next = 0;
    handles.set("root", { node: root, kind: "element" });
    function handle(value) {
      const entry = handles.get(value);
      if (!entry) throw new Error("unknown DOM handle ".concat(value));
      return entry;
    }
    function element(value) {
      const entry = handle(value);
      if (entry.kind !== "element") throw new Error("the handle is not an element");
      return entry.node;
    }
    function text(value) {
      const entry = handle(value);
      if (entry.kind !== "text") throw new Error("the handle is not a text node");
      return entry.node;
    }
    function add(node, kind) {
      next += 1;
      const id = "d".concat(next);
      handles.set(id, { node, kind });
      return id;
    }
    return {
      root: "root",
      createElement(tag) {
        if (!TAG.test(tag)) throw new Error("the tag ".concat(JSON.stringify(tag), " is not a QChat web component"));
        return add(document.createElement(tag), "element");
      },
      createText(value) {
        return add(document.createTextNode(value), "text");
      },
      setAttribute(value, name, attribute) {
        element(value).setAttribute(name, attribute);
      },
      removeAttribute(value, name) {
        element(value).removeAttribute(name);
      },
      setText(value, content) {
        text(value).data = content;
      },
      appendChild(parent, child) {
        element(parent).appendChild(handle(child).node);
      },
      insertBefore(parent, child, index) {
        var _a;
        const parentElement = element(parent);
        const reference = (_a = parentElement.childNodes[index]) != null ? _a : null;
        parentElement.insertBefore(handle(child).node, reference);
      },
      removeChild(parent, child) {
        element(parent).removeChild(handle(child).node);
      },
      addEventListener(value, type, listener, options) {
        var _a, _b;
        const target = element(value);
        const domType = (_a = WXML_TO_DOM_EVENT[type]) != null ? _a : type;
        const wrapped = (event) => {
          if (options == null ? void 0 : options.stopPropagation) event.stopPropagation();
          listener(toDomEvent(type, event));
        };
        target.addEventListener(domType, wrapped);
        const records = (_b = listeners.get(value)) != null ? _b : [];
        records.push({ type, handler: listener, wrapped });
        listeners.set(value, records);
      },
      removeEventListener(value, type, listener) {
        var _a;
        const records = listeners.get(value);
        if (!records) return;
        const index = records.findIndex((record2) => record2.type === type && record2.handler === listener);
        if (index === -1) return;
        const [record] = records.splice(index, 1);
        element(value).removeEventListener((_a = WXML_TO_DOM_EVENT[type]) != null ? _a : type, record.wrapped);
        if (records.length === 0) listeners.delete(value);
      },
      setRootTheme(theme) {
        const page = document.documentElement;
        page.setAttribute("data-theme", theme);
        if (!page.style) throw new Error("the page root has no style");
        page.style.setProperty("color-scheme", theme);
      },
      dispose() {
        var _a;
        for (const [value, records] of listeners) {
          const entry = handles.get(value);
          if (!entry || entry.kind !== "element") continue;
          const target = entry.node;
          for (const record of records) {
            target.removeEventListener((_a = WXML_TO_DOM_EVENT[record.type]) != null ? _a : record.type, record.wrapped);
          }
        }
        listeners.clear();
        handles.clear();
      }
    };
  }

  // src/client.ts
  var PAGE_ID = /^p[0-9]{1,9}$/;
  var BINDING_KEYS = ["appId", "sessionId", "pageId"];
  function isViewBinding(value) {
    if (!isRecord(value)) return false;
    if (!hasOnlyKeys(value, BINDING_KEYS)) return false;
    return isNonEmptyString(value.appId, 128) && isNonEmptyString(value.sessionId, 128) && isNonEmptyString(value.pageId, 128) && PAGE_ID.test(value.pageId);
  }
  function createViewClient(options) {
    if (!isViewBinding(options.binding)) throw new Error("invalid view binding");
    const binding = {
      appId: options.binding.appId,
      sessionId: options.binding.sessionId,
      pageId: options.binding.pageId
    };
    const adapter = createBrowserDomAdapter(options.document, options.root);
    let destroyed = false;
    let transportLost = false;
    function send(message) {
      if (destroyed || transportLost) return false;
      try {
        options.send(message);
        return true;
      } catch (e) {
        transportLost = true;
        return false;
      }
    }
    function envelope(event, payload) {
      return {
        v: BRIDGE_VERSION,
        kind: "event",
        appId: binding.appId,
        sessionId: binding.sessionId,
        pageId: binding.pageId,
        event,
        payload
      };
    }
    function reject(error) {
      send(envelope(VIEW_ERROR_EVENT, { code: error.code, message: error.message }));
      return { ok: false, error };
    }
    function closed(message = "The page is closed.") {
      return { ok: false, error: miniAppError("BRIDGE_PAGE_CLOSED", message) };
    }
    const renderer = createViewRenderer(adapter, {
      now: options.now,
      maxNodes: options.maxNodes,
      onEvent(event) {
        send(
          envelope(VIEW_INPUT_EVENT, {
            handler: event.handler,
            type: event.type,
            detail: event.detail,
            dataset: event.dataset,
            catch: event.catch,
            timeStamp: event.timeStamp
          })
        );
      }
    });
    const session = createRenderSession(renderer);
    function applyRender(payload) {
      if (!validateRenderPayload(payload)) {
        return reject(miniAppError("BRIDGE_INVALID_MESSAGE", "The render payload is invalid."));
      }
      if (payload.pageId !== binding.pageId) {
        return reject(miniAppError("BRIDGE_PAGE_MISMATCH", "The render payload is bound to another page."));
      }
      try {
        return { ok: true, status: session.apply(payload) };
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "The render payload was rejected.";
        return reject(miniAppError("BRIDGE_INVALID_MESSAGE", message));
      }
    }
    function applyTheme(payload) {
      if (!hasOnlyKeys(payload, ["theme"]) || !isResolvedTheme(payload.theme)) {
        return reject(miniAppError("BRIDGE_INVALID_MESSAGE", "A theme event needs a resolved light or dark theme."));
      }
      renderer.setTheme(payload.theme);
      return { ok: true, status: "theme" };
    }
    function destroy() {
      if (destroyed) return { ok: true, status: "destroyed" };
      destroyed = true;
      renderer.destroy();
      adapter.dispose();
      return { ok: true, status: "destroyed" };
    }
    return {
      binding,
      ready() {
        if (destroyed) return closed();
        if (transportLost) return closed("The host bridge is gone.");
        if (!send(envelope(VIEW_READY_EVENT, {}))) return closed("The host bridge is gone.");
        return { ok: true, status: "ready" };
      },
      receive(value) {
        if (destroyed) return closed();
        if (transportLost) return closed("The host bridge is gone.");
        let raw = value;
        if (typeof value === "string") {
          if (utf8Length(value) > MAX_BRIDGE_MESSAGE_BYTES) {
            return reject(miniAppError("BRIDGE_TOO_LARGE"));
          }
          try {
            raw = JSON.parse(value);
          } catch (e) {
            return reject(miniAppError("BRIDGE_INVALID_MESSAGE", "The message is not JSON."));
          }
        }
        const parsed = parseBridgeMessage(raw, binding);
        if (!parsed.ok) return reject(parsed.error);
        if (parsed.message.kind !== "event") {
          return reject(miniAppError("BRIDGE_INVALID_MESSAGE", "The view accepts events only."));
        }
        const payload = parsed.message.payload;
        switch (parsed.message.event) {
          case VIEW_RENDER_EVENT:
            return applyRender(payload);
          case VIEW_THEME_EVENT:
            return applyTheme(payload);
          case VIEW_DESTROY_EVENT:
            return destroy();
          default:
            return reject(miniAppError("BRIDGE_INVALID_MESSAGE", "Unknown view event."));
        }
      },
      destroy,
      seq() {
        return session.seq();
      },
      pageId() {
        return session.pageId();
      }
    };
  }

  // src/install.ts
  function serialize(result) {
    return JSON.stringify(result);
  }
  function failure(code, message) {
    return serialize({ ok: false, error: miniAppError(code, message) });
  }
  function installBrowserView(win) {
    if (win.__qchatView) return win.__qchatView;
    let client = null;
    let destroyed = false;
    const handle = {
      start(bindingJson) {
        if (destroyed) return failure("BRIDGE_PAGE_CLOSED", "The view is destroyed.");
        if (client) return failure("BRIDGE_INVALID_MESSAGE", "The view has already started.");
        if (typeof bindingJson !== "string") {
          return failure("BRIDGE_INVALID_MESSAGE", "The binding must be a JSON string.");
        }
        let raw;
        try {
          raw = JSON.parse(bindingJson);
        } catch (e) {
          return failure("BRIDGE_INVALID_MESSAGE", "The binding is not JSON.");
        }
        if (!isViewBinding(raw)) return failure("BRIDGE_INVALID_MESSAGE", "The binding is invalid.");
        const root = win.document.getElementById(VIEW_ROOT_ID);
        if (!root) return failure("RUNTIME_CRASH", "The view root is missing.");
        const channel = win.qchatViewBridge;
        if (!channel) return failure("RUNTIME_CRASH", "The host bridge object is missing.");
        const binding = raw;
        client = createViewClient({
          document: win.document,
          root,
          binding,
          send(message) {
            channel.postMessage(JSON.stringify(message));
          }
        });
        return serialize(client.ready());
      },
      receive(messageJson) {
        if (destroyed) return failure("BRIDGE_PAGE_CLOSED", "The view is destroyed.");
        if (!client) return failure("BRIDGE_INVALID_MESSAGE", "The view has not started.");
        return serialize(client.receive(messageJson));
      },
      destroy() {
        if (client) {
          client.destroy();
          client = null;
        }
        destroyed = true;
        return serialize({ ok: true, status: "destroyed" });
      }
    };
    win.__qchatView = handle;
    return handle;
  }

  // src/browser.ts
  installBrowserView(window);
  return __toCommonJS(browser_exports);
})();
