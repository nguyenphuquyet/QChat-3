/// The capability registry.
///
/// A Mini Program author checks `wx.canIUse` (or `wx.getCapabilities`) before
/// calling an API or setting an attribute, and the QChat host must answer with
/// what it really implements. This module is the single source for that answer:
/// [buildCapabilities] is written into `window.__QCHAT_APP_CONFIG__` at build
/// time, so the runtime never keeps a second, drifting copy of the tables.
///
/// A component or API is listed here only when `builtin/` or `runtime/host.js`
/// actually implements it. Anything else is reported as unsupported with a
/// reason instead of being silently accepted.

export type ApiCapability = {
  supported: boolean;
  /// The bridge method the runtime calls, when it differs from the API name.
  bridge?: string;
  /// Any one of these permissions must be declared by the Mini Program.
  permissions?: string[];
  reason?: string;
};

export type ComponentCapability = {
  attributes: string[];
  /// Enumerated attribute values, for `wx.canIUse("button.open-type.share")`.
  values?: Record<string, string[]>;
};

export type CapabilityManifest = {
  permissions: string[];
  apis: Record<string, ApiCapability>;
  /// Bridge method -> permissions, used by the runtime to gate `window.qchat`.
  bridge: Record<string, string[]>;
  components: Record<string, ComponentCapability>;
};

const toast = ["toast"];
const storage = ["storage"];

/// Every `wx` API the host implements. `host.js` exposes exactly these keys;
/// `test/capabilities.test.ts` boots the runtime and fails if the two drift.
export const API_CAPABILITIES: Record<string, ApiCapability> = {
  canIUse: { supported: true },
  getCapabilities: { supported: true },
  nextTick: { supported: true },

  getSystemInfo: { supported: true },
  getSystemInfoSync: { supported: true },
  getWindowInfo: { supported: true },
  getDeviceInfo: { supported: true },
  getAppBaseInfo: { supported: true },
  getAppInfo: { supported: true },
  getUserInfo: { supported: true, bridge: "getUserInfo", permissions: ["user.profile"] },
  getUserProfile: { supported: true, bridge: "getUserInfo", permissions: ["user.profile"] },

  showToast: { supported: true, bridge: "showToast", permissions: toast },
  hideToast: { supported: true },
  showLoading: { supported: true, bridge: "showToast", permissions: toast },
  hideLoading: { supported: true },

  setNavigationBarTitle: { supported: true },
  setNavigationBarColor: { supported: true },
  showNavigationBarLoading: { supported: true },
  hideNavigationBarLoading: { supported: true },
  pageScrollTo: { supported: true },

  navigateTo: { supported: true },
  redirectTo: { supported: true },
  reLaunch: { supported: true },
  switchTab: { supported: true },
  navigateBack: { supported: true },
  getCurrentPages: { supported: true },

  getStorage: { supported: true, bridge: "getStorage", permissions: storage },
  getStorageSync: { supported: true, permissions: storage },
  setStorage: { supported: true, bridge: "setStorage", permissions: storage },
  setStorageSync: { supported: true, permissions: storage },
  removeStorage: { supported: true, bridge: "removeStorage", permissions: storage },
  removeStorageSync: { supported: true, permissions: storage },
  clearStorage: { supported: true, permissions: storage },
  clearStorageSync: { supported: true, permissions: storage },

  request: {
    supported: true,
    bridge: "request",
    permissions: ["network", "qchat.api", "user.profile"],
  },
  fetch: { supported: true, bridge: "fetch", permissions: ["network"] },

  chooseImage: { supported: true, bridge: "chooseImage", permissions: ["media.choose"] },
  chooseMedia: { supported: true, bridge: "chooseImage", permissions: ["media.choose"] },

  share: { supported: true, bridge: "share", permissions: ["share"] },
  showShareMenu: { supported: true },
  hideShareMenu: { supported: true },
  onShareAppMessage: { supported: true },
  offShareAppMessage: { supported: true },

  getMenuButtonBoundingClientRect: { supported: true },
  vibrateShort: { supported: true },
  vibrateLong: { supported: true },
  createSelectorQuery: { supported: true },

  // Implemented by neither the WebView runtime nor the native bridge yet. They
  // are listed so `wx.getCapabilities()` can explain why they fail instead of
  // leaving an author to guess.
  showModal: {
    supported: false,
    reason: "wx.showModal needs a native modal surface; the QChat bridge does not expose one yet",
  },
  showActionSheet: {
    supported: false,
    reason: "wx.showActionSheet needs a native action sheet; the QChat bridge does not expose one yet",
  },
  previewImage: {
    supported: false,
    reason: "wx.previewImage needs a native image viewer; the QChat bridge does not expose one yet",
  },
  getSetting: {
    supported: false,
    reason: "wx.getSetting needs the native permission ledger; use wx.getCapabilities().permissions",
  },
  authorize: {
    supported: false,
    reason: "wx.authorize needs the native permission ledger; declare the permission in manifest.json",
  },
  setClipboardData: {
    supported: false,
    reason: "clipboard access is not exposed to Mini Programs by the QChat bridge",
  },
  getClipboardData: {
    supported: false,
    reason: "clipboard access is not exposed to Mini Programs by the QChat bridge",
  },
  login: {
    supported: false,
    reason: "wx.login needs the native QChat session; the bridge does not expose it",
  },
  checkSession: {
    supported: false,
    reason: "wx.checkSession needs the native QChat session; the bridge does not expose it",
  },
};

const commonEvents = ["bindtap", "catchtap"];

/// Attributes and events implemented by `builtin/<tag>`. Only properties the
/// component declares are listed; `wx.canIUse("view.hidden")` is true, an
/// invented attribute is false.
export const COMPONENT_CAPABILITIES: Record<string, ComponentCapability> = {
  view: {
    attributes: ["hover-class", "hover-stop-propagation", "hover-start-time", "hover-stay-time", "hidden", ...commonEvents],
  },
  text: {
    attributes: ["selectable", "user-select", "space", "decode", "hidden", ...commonEvents],
    values: { space: ["ensp", "emsp", "nbsp"] },
  },
  button: {
    attributes: [
      "size", "type", "plain", "disabled", "loading", "form-type", "open-type", "lang",
      "session-from", "send-message-title", "send-message-path", "send-message-img",
      "app-parameter", "show-message-card", "group-id", "hover-class", "hidden",
      "bindgetuserinfo", "binderror", ...commonEvents,
    ],
    values: {
      size: ["default", "mini"],
      type: ["default", "primary", "warn"],
      "form-type": ["submit", "reset"],
      "open-type": ["share", "getUserInfo"],
    },
  },
  image: {
    attributes: [
      "src", "mode", "lazy-load", "show-menu-by-longpress", "webp", "hidden",
      "bindload", "binderror", ...commonEvents,
    ],
    values: { mode: ["scaleToFill", "aspectFit", "aspectFill", "widthFix", "heightFix"] },
  },
  "scroll-view": {
    attributes: [
      "scroll-x", "scroll-y", "upper-threshold", "lower-threshold", "scroll-top",
      "scroll-left", "scroll-into-view", "scroll-with-animation", "enable-back-to-top",
      "enable-flex", "enhanced", "show-scrollbar", "paging-enabled", "fast-deceleration",
      "scroll-anchoring", "refresher-enabled", "refresher-threshold", "refresher-default-style",
      "refresher-background", "refresher-triggered", "hidden",
      "bindscroll", "bindscrolltoupper", "bindscrolltolower", ...commonEvents,
    ],
  },
  input: {
    attributes: [
      "value", "type", "password", "placeholder", "placeholder-style", "placeholder-class",
      "disabled", "maxlength", "cursor", "cursor-spacing", "focus", "confirm-type",
      "confirm-hold", "hold-keyboard", "adjust-position", "auto-blur", "always-embed",
      "selection-start", "selection-end", "name", "hidden",
      "bindinput", "bindfocus", "bindblur", "bindconfirm", ...commonEvents,
    ],
    values: {
      type: ["text", "number", "idcard", "digit", "safe-password", "nickname"],
      "confirm-type": ["send", "search", "next", "go", "done"],
    },
  },
  textarea: {
    attributes: [
      "value", "placeholder", "placeholder-style", "placeholder-class", "disabled",
      "maxlength", "auto-focus", "focus", "auto-height", "fixed", "cursor-spacing",
      "cursor", "show-confirm-bar", "selection-start", "selection-end", "adjust-position",
      "hold-keyboard", "disable-default-padding", "confirm-type", "confirm-hold", "name",
      "hidden", "bindinput", "bindfocus", "bindblur", "bindconfirm", ...commonEvents,
    ],
  },
  switch: {
    attributes: ["checked", "disabled", "type", "color", "name", "hidden", "bindchange", ...commonEvents],
    values: { type: ["switch", "checkbox"] },
  },
  checkbox: {
    attributes: ["value", "disabled", "checked", "color", "hidden", "bindchange", ...commonEvents],
  },
  "checkbox-group": {
    attributes: ["value", "name", "hidden", "bindchange", ...commonEvents],
  },
  radio: {
    attributes: ["value", "checked", "disabled", "color", "hidden", "bindchange", ...commonEvents],
  },
  "radio-group": {
    attributes: ["value", "name", "hidden", "bindchange", ...commonEvents],
  },
  slider: {
    attributes: [
      "min", "max", "step", "value", "selected-color", "active-color", "background-color",
      "block-size", "block-color", "show-value", "disabled", "name", "hidden",
      "bindchanging", "bindchange", ...commonEvents,
    ],
  },
  navigator: {
    attributes: [
      "target", "url", "open-type", "delta", "app-id", "path", "extra-data", "version",
      "hover-class", "hover-stop-propagation", "hover-start-time", "hover-stay-time",
      "hidden", "binderror", ...commonEvents,
    ],
    values: {
      target: ["self", "miniProgram"],
      "open-type": ["navigate", "redirect", "switchTab", "reLaunch", "navigateBack", "exit"],
    },
  },
  progress: {
    attributes: [
      "percent", "show-info", "stroke-width", "active-color", "background-color", "active",
      "active-mode", "duration", "border-radius", "font-size", "hidden", ...commonEvents,
    ],
    values: { "active-mode": ["backwards", "forwards"] },
  },
  swiper: {
    attributes: [
      "indicator-dots", "indicator-color", "indicator-active-color", "autoplay", "current",
      "interval", "duration", "circular", "vertical", "previous-margin", "next-margin",
      "display-multiple-items", "skip-hidden-item-layout", "easing-function",
      "snap-to-edge", "current-item-id", "hidden",
      "bindchange", "bindtransition", "bindanimationfinish", ...commonEvents,
    ],
    values: {
      "easing-function": ["default", "linear", "easeInCubic", "easeOutCubic", "easeInOutCubic"],
    },
  },
  "swiper-item": {
    attributes: ["item-id", "hidden", ...commonEvents],
  },
  picker: {
    attributes: [
      "mode", "disabled", "range", "range-key", "value", "start", "end", "fields",
      "header-text", "name", "hidden",
      "bindchange", "bindcancel", "bindcolumnchange", "binderror", ...commonEvents,
    ],
    values: {
      mode: ["selector", "multiSelector", "time", "date"],
      fields: ["year", "month", "day"],
    },
  },
  form: {
    attributes: ["report-submit", "report-submit-timeout", "hidden", "bindsubmit", "bindreset", ...commonEvents],
  },
  label: {
    attributes: ["for", "hidden", ...commonEvents],
  },
  "rich-text": {
    attributes: ["nodes", "space", "user-select", "hidden", ...commonEvents],
    values: { space: ["ensp", "emsp", "nbsp"] },
  },
};

/// Builds the manifest embedded in the built package.
export function buildCapabilities(declaredPermissions: string[]): CapabilityManifest {
  const permissions = [...new Set(declaredPermissions)].sort();
  const apis: Record<string, ApiCapability> = {};
  const bridge: Record<string, string[]> = {};
  for (const [name, capability] of Object.entries(API_CAPABILITIES)) {
    apis[name] = { ...capability };
    if (capability.supported && capability.permissions?.length) {
      bridge[capability.bridge ?? name] = [...capability.permissions];
    }
  }
  return {
    permissions,
    apis,
    bridge,
    components: JSON.parse(JSON.stringify(COMPONENT_CAPABILITIES)) as Record<string, ComponentCapability>,
  };
}
