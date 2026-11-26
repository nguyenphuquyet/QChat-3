// Runs a built mini app inside a sandboxed iframe and speaks the qapp protocol
// with it: `render` frames come back, host calls are answered here.
//
// The iframe is sandboxed without `allow-same-origin`, so the app gets its own
// realm and cannot touch the Studio's storage, DOM or Tauri bridge. Every host
// method the real Flutter host implements is answered below with the same
// argument rules, so an app that works in the preview is not surprised later.
import type {
  QappDevice,
  QappFrame,
  QappHostResponse,
  QappLogLevel,
  QappPreviewLog,
} from "./types";

export interface QappPreviewOptions {
  appJs: string;
  appInfo: {
    appId: string;
    name: string;
    version: string;
    runtimeVersion: string;
    minRuntimeVersion: string;
    permissions: string[];
  };
  device: QappDevice;
  locale: string;
  onFrame: (frame: QappFrame) => void;
  onLog: (log: QappPreviewLog) => void;
  onError: (error: { code: string; message: string }) => void;
  onToast: (message: string, icon: string) => void;
  /** `closeMiniApp()` or a back gesture with an empty route stack. */
  onClose: () => void;
}

interface Pending {
  resolve: (response: QappHostResponse) => void;
}

const ROUTE_PATTERN = /^[A-Za-z0-9._~/-]{1,300}$/;
const STORAGE_KEY_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const MAX_BODY_BYTES = 32 * 1024;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const BOOTSTRAP = `
(function () {
  var token = __TOKEN__;
  var pending = new Map();
  var seq = 0;
  var timer = 0;
  // The SDK replaces the global timer functions with its own queue, so the
  // host clock has to keep a handle on the engine's real ones or every wake
  // would re-enter the queue it is trying to drain.
  var nativeSetTimeout = window.setTimeout.bind(window);
  var nativeClearTimeout = window.clearTimeout.bind(window);
  function post(message) {
    message.__qapp = true;
    message.token = token;
    parent.postMessage(message, "*");
  }
  window.__qchatNative = {
    send: function (kind, payload) {
      post({ kind: "send", sendKind: kind, payload: payload });
    },
    call: function (method, params) {
      var id = ++seq;
      return new Promise(function (resolve) {
        pending.set(id, resolve);
        post({ kind: "call", id: id, method: method, params: params });
      });
    }
  };
  window.__qchatTimerScheduler = {
    now: function () { return Date.now(); },
    wake: function (delayMs) {
      if (timer) { nativeClearTimeout(timer); timer = 0; }
      if (delayMs < 0) return;
      timer = nativeSetTimeout(function () {
        timer = 0;
        var tick = window.__qchatTickTimers;
        if (typeof tick === "function") tick(Date.now());
      }, delayMs);
    }
  };
  function onMessage(event) {
    var data = event.data;
    if (!data || data.__qapp !== true || data.token !== token) return;
    if (data.kind === "response") {
      var resolve = pending.get(data.id);
      if (resolve) { pending.delete(data.id); resolve(data.response); }
      return;
    }
    if (data.kind === "dispatch") {
      var dispatch = window.__qchatDispatch;
      if (typeof dispatch === "function") dispatch(data.id, data.event, data.payload);
      return;
    }
    if (data.kind === "lifecycle") {
      var lifecycle = window.__qchatLifecycle;
      if (typeof lifecycle === "function") lifecycle(data.event, data.payload);
    }
  }
  addEventListener("message", onMessage);
  addEventListener("error", function (event) {
    post({
      kind: "error",
      message: String(event.message || "Script error"),
      stack: event.error && event.error.stack ? String(event.error.stack) : undefined
    });
  });
  addEventListener("unhandledrejection", function (event) {
    var reason = event.reason;
    post({
      kind: "error",
      message: String(reason && reason.message ? reason.message : reason),
      stack: reason && reason.stack ? String(reason.stack) : undefined
    });
  });
  post({ kind: "boot" });
})();
`;

function escapeForScript(source: string): string {
  return source.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--");
}

function errorResponse(code: string, message: string): QappHostResponse {
  return { ok: false, error: { code, message } };
}

function numberIn(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export class QappPreview {
  private readonly options: QappPreviewOptions;
  private readonly container: HTMLElement;
  private readonly token: string;
  private readonly pending = new Map<number, Pending>();
  private readonly routes: string[] = [];
  private readonly callTimes: number[] = [];
  private readonly perMethod = new Map<string, number[]>();
  private frame: HTMLIFrameElement | null = null;
  private booted = false;
  private queued: Array<Record<string, unknown>> = [];
  private disposed = false;

  constructor(container: HTMLElement, options: QappPreviewOptions) {
    this.container = container;
    this.options = options;
    this.token = `qapp_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    window.addEventListener("message", this.handleMessage);
    this.mount();
  }

  private mount(): void {
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("title", "Mini App preview");
    frame.style.cssText =
      "display:block;border:0;width:100%;height:100%;background:transparent;color-scheme:normal;";
    this.container.appendChild(frame);
    this.frame = frame;
    frame.srcdoc = this.document();
  }

  private document(): string {
    const bootstrap = BOOTSTRAP.replace("__TOKEN__", JSON.stringify(this.token));
    const appJs = escapeForScript(this.options.appJs);
    return `<!doctype html>
<html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: transparent; }
  body {
    overflow: hidden;
    -webkit-tap-highlight-color: transparent;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: ${this.options.device.theme === "dark" ? "#f2f3f5" : "#1d2129"};
    font-size: 15px;
    line-height: 1.3;
  }
  *, *::before, *::after { box-sizing: border-box; }
  input, button, textarea, select { font: inherit; color: inherit; }
  :root { color-scheme: ${this.options.device.theme === "dark" ? "dark" : "light"}; }
  @keyframes qapp-spin { to { transform: rotate(360deg); } }
  @keyframes qapp-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes qapp-slide-up { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes qapp-scale-in { from { opacity: 0; transform: scale(1.06); } to { opacity: 1; transform: scale(1); } }
</style></head>
<body><script>${bootstrap}</script><script>${appJs}</script></body></html>`;
  }

  /** Replaces the running app, keeping the same container. */
  reload(appJs: string): void {
    this.options.appJs = appJs;
    this.pending.clear();
    this.queued = [];
    this.booted = false;
    this.frame?.remove();
    this.frame = null;
    if (!this.disposed) this.mount();
  }

  dispose(): void {
    this.disposed = true;
    window.removeEventListener("message", this.handleMessage);
    this.pending.clear();
    this.frame?.remove();
    this.frame = null;
  }

  dispatch(id: string, event: string, payload: unknown): void {
    this.post({ kind: "dispatch", id, event, payload });
  }

  lifecycle(event: string, payload: unknown): void {
    this.post({ kind: "lifecycle", event, payload });
  }

  private post(message: Record<string, unknown>): void {
    if (this.disposed) return;
    const envelope = { ...message, __qapp: true, token: this.token };
    if (!this.booted) {
      this.queued.push(envelope);
      return;
    }
    this.frame?.contentWindow?.postMessage(envelope, "*");
  }

  private handleMessage = (event: MessageEvent): void => {
    const frame = this.frame;
    if (!frame) return;
    const data = event.data as Record<string, unknown> | null;
    if (!data || typeof data !== "object") return;
    if (data.__qapp !== true || data.token !== this.token) return;
    if (event.source !== frame.contentWindow) return;
    switch (data.kind) {
      case "boot": {
        this.booted = true;
        const queued = this.queued;
        this.queued = [];
        for (const message of queued) frame.contentWindow?.postMessage(message, "*");
        return;
      }
      case "send": {
        this.handleSend(String(data.sendKind), data.payload);
        return;
      }
      case "call": {
        const id = Number(data.id);
        void this.handleCall(String(data.method), data.params).then((response) => {
          if (this.disposed) return;
          frame.contentWindow?.postMessage(
            { __qapp: true, token: this.token, kind: "response", id, response },
            "*",
          );
        });
        return;
      }
      case "error": {
        this.options.onError({
          code: "RUNTIME_ERROR",
          message: String(data.message ?? "Runtime error"),
        });
        this.options.onLog({
          level: "error",
          message: String(data.message ?? "Runtime error"),
          stack: data.stack === undefined ? undefined : String(data.stack),
        });
        return;
      }
    }
  };

  private handleSend(kind: string, payload: unknown): void {
    if (kind === "render") {
      this.options.onFrame(payload as QappFrame);
      return;
    }
    if (kind === "log") {
      const entry = (payload ?? {}) as Record<string, unknown>;
      this.options.onLog({
        level: String(entry.level ?? "log") as QappLogLevel,
        message: String(entry.message ?? ""),
        stack: entry.stack === undefined ? undefined : String(entry.stack),
      });
      return;
    }
    // `ready` and `timer` have no visible effect: the scheduler in the iframe
    // owns the clock, so nothing has to wake the runtime from here.
  }

  private allowCall(method: string): boolean {
    const now = Date.now();
    while (this.callTimes.length && now - this.callTimes[0] > 10_000) this.callTimes.shift();
    if (this.callTimes.length >= 60) return false;
    const times = this.perMethod.get(method) ?? [];
    while (times.length && now - times[0] > 10_000) times.shift();
    const limit = method === "chooseImage" ? 5 : 30;
    if (times.length >= limit) {
      this.perMethod.set(method, times);
      return false;
    }
    times.push(now);
    this.callTimes.push(now);
    this.perMethod.set(method, times);
    return true;
  }

  private granted(permission: string): boolean {
    return this.options.appInfo.permissions.includes(permission);
  }

  private permission(permission: string): QappHostResponse | null {
    if (this.granted(permission)) return null;
    return errorResponse(
      "PERMISSION_DENIED",
      `This app did not declare the "${permission}" permission`,
    );
  }

  private storageKey(key: unknown): string | null {
    if (typeof key !== "string" || !STORAGE_KEY_PATTERN.test(key)) return null;
    return `qapp-preview:${this.options.appInfo.appId}:${key}`;
  }

  private async handleCall(method: string, rawParams: unknown): Promise<QappHostResponse> {
    if (!this.allowCall(method)) {
      return errorResponse("RATE_LIMITED", "Too many calls, slow down");
    }
    const params = (rawParams ?? {}) as Record<string, unknown>;
    const device = this.options.device;
    switch (method) {
      case "getAppInfo":
        return {
          ok: true,
          result: {
            ...this.options.appInfo,
            entry: "app.js",
            format: "qapp",
          },
        };
      case "getSystemInfo":
        return {
          ok: true,
          result: {
            platform: "web",
            osVersion: "Studio preview",
            appVersion: this.options.appInfo.version,
            runtimeVersion: this.options.appInfo.runtimeVersion,
            locale: this.options.locale,
            theme: device.theme,
            screenWidth: device.width,
            screenHeight: device.height,
            pixelRatio: device.pixelRatio,
            safeAreaTop: device.safeAreaTop,
            safeAreaBottom: device.safeAreaBottom,
          },
        };
      case "getUserInfo": {
        const denied = this.permission("user.profile");
        if (denied) return denied;
        return {
          ok: true,
          result: {
            id: "u_preview",
            qchatId: "qchat_preview",
            nickname: "Người dùng xem trước",
            avatarUrl: null,
          },
        };
      }
      case "showToast": {
        const denied = this.permission("toast");
        if (denied) return denied;
        const message = typeof params.message === "string" ? params.message.trim() : "";
        if (message.length < 1 || message.length > 200) {
          return errorResponse("INVALID_ARGUMENT", "message must be 1–200 characters");
        }
        this.options.onToast(message, String(params.icon ?? "none"));
        return { ok: true, result: null };
      }
      case "chooseImage": {
        const denied = this.permission("media.choose");
        if (denied) return denied;
        const dataUrl = await this.pickImage();
        if (!dataUrl) return errorResponse("CANCELLED", "No image was chosen");
        return { ok: true, result: dataUrl };
      }
      case "share": {
        const denied = this.permission("share");
        if (denied) return denied;
        const text = typeof params.text === "string" ? params.text : "";
        const url = typeof params.url === "string" ? params.url : "";
        if (!text && !url) {
          return errorResponse("INVALID_ARGUMENT", "share needs text or url");
        }
        if (text.length > 2000 || url.length > 2048) {
          return errorResponse("INVALID_ARGUMENT", "share payload is too long");
        }
        return { ok: true, result: true };
      }
      case "navigateTo": {
        const path = typeof params.path === "string" ? params.path : "";
        if (!ROUTE_PATTERN.test(path) || path.includes("..")) {
          return errorResponse("INVALID_ARGUMENT", "invalid path");
        }
        if (params.external === true) {
          return errorResponse("NOT_SUPPORTED", "Opening external apps is not supported");
        }
        this.routes.push(path);
        this.lifecycle("navigate", { path, depth: this.routes.length });
        return { ok: true, result: null };
      }
      case "navigateBack": {
        if (this.routes.length === 0) {
          this.options.onClose();
          return { ok: true, result: null };
        }
        this.routes.pop();
        this.lifecycle("back", {
          path: this.routes.length ? this.routes[this.routes.length - 1] : null,
          depth: this.routes.length,
        });
        return { ok: true, result: null };
      }
      case "closeMiniApp":
        this.options.onClose();
        return { ok: true, result: null };
      case "openExternal":
        return errorResponse("NOT_SUPPORTED", "Opening external apps is not supported");
      case "getStorage": {
        const denied = this.permission("storage");
        if (denied) return denied;
        const key = this.storageKey(params.key);
        if (!key) return errorResponse("INVALID_ARGUMENT", "invalid storage key");
        const raw = window.localStorage.getItem(key);
        if (raw === null) return { ok: true, result: null };
        try {
          return { ok: true, result: JSON.parse(raw) };
        } catch {
          return { ok: true, result: null };
        }
      }
      case "setStorage": {
        const denied = this.permission("storage");
        if (denied) return denied;
        const key = this.storageKey(params.key);
        if (!key) return errorResponse("INVALID_ARGUMENT", "invalid storage key");
        let encoded: string;
        try {
          encoded = JSON.stringify(params.value ?? null);
        } catch {
          return errorResponse("INVALID_ARGUMENT", "value is not serialisable");
        }
        if (new TextEncoder().encode(encoded).length > 64 * 1024) {
          return errorResponse("STORAGE_QUOTA_EXCEEDED", "value is larger than 64 KB");
        }
        const prefix = `qapp-preview:${this.options.appInfo.appId}:`;
        let total = 0;
        let count = 0;
        for (let index = 0; index < window.localStorage.length; index++) {
          const name = window.localStorage.key(index);
          if (!name || !name.startsWith(prefix)) continue;
          count++;
          total += (window.localStorage.getItem(name) ?? "").length;
        }
        if (!window.localStorage.getItem(key) && count >= 128) {
          return errorResponse("STORAGE_QUOTA_EXCEEDED", "namespace holds 128 keys already");
        }
        if (total + encoded.length > 512 * 1024) {
          return errorResponse("STORAGE_QUOTA_EXCEEDED", "namespace is larger than 512 KB");
        }
        window.localStorage.setItem(key, encoded);
        return { ok: true, result: null };
      }
      case "removeStorage": {
        const denied = this.permission("storage");
        if (denied) return denied;
        const key = this.storageKey(params.key);
        if (!key) return errorResponse("INVALID_ARGUMENT", "invalid storage key");
        window.localStorage.removeItem(key);
        return { ok: true, result: null };
      }
      case "request":
        // The QChat API only exists inside QChat; the preview is honest about it
        // instead of inventing a user or a conversation.
        return errorResponse(
          "NOT_SUPPORTED",
          "request() needs the QChat host; use fetch() or run the app on a device",
        );
      case "fetch":
        return this.fetch(params);
      default:
        return errorResponse("NOT_SUPPORTED", `Unknown method: ${method}`);
    }
  }

  private async fetch(params: Record<string, unknown>): Promise<QappHostResponse> {
    const denied = this.permission("network");
    if (denied) return denied;
    const url = typeof params.url === "string" ? params.url : "";
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return errorResponse("INVALID_ARGUMENT", "invalid url");
    }
    if (parsed.protocol !== "https:") {
      return errorResponse("INVALID_ARGUMENT", "only https URLs are allowed");
    }
    if (parsed.username || parsed.password) {
      return errorResponse("INVALID_ARGUMENT", "url must not carry credentials");
    }
    const body = typeof params.body === "string" ? params.body : undefined;
    if (body && new TextEncoder().encode(body).length > MAX_BODY_BYTES) {
      return errorResponse("INVALID_ARGUMENT", "body is larger than 32 KB");
    }
    const timeoutMs = numberIn(params.timeoutMs, 1000, 15_000, 10_000);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers = (params.headers ?? {}) as Record<string, string>;
      const response = await window.fetch(parsed.toString(), {
        method: typeof params.method === "string" ? params.method : "GET",
        headers,
        body,
        signal: controller.signal,
      });
      const text = await response.text();
      if (new TextEncoder().encode(text).length > MAX_RESPONSE_BYTES) {
        return errorResponse("RESPONSE_TOO_LARGE", "response is larger than 1 MB");
      }
      const contentType = response.headers.get("content-type") ?? "";
      let data: unknown = text;
      if (contentType.includes("json")) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, name) => {
        responseHeaders[name] = value;
      });
      return {
        ok: true,
        result: { status: response.status, headers: responseHeaders, data },
      };
    } catch (error) {
      const aborted = controller.signal.aborted;
      return errorResponse(
        aborted ? "TIMEOUT" : "NETWORK_ERROR",
        error instanceof Error ? error.message : "Network error",
      );
    } finally {
      window.clearTimeout(timer);
    }
  }

  private pickImage(): Promise<string | null> {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.style.display = "none";
      const finish = (value: string | null) => {
        input.remove();
        resolve(value);
      };
      input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file) return finish(null);
        if (file.size > MAX_IMAGE_BYTES) return finish(null);
        const reader = new FileReader();
        reader.onload = () => finish(typeof reader.result === "string" ? reader.result : null);
        reader.onerror = () => finish(null);
        reader.readAsDataURL(file);
      });
      // A cancelled picker fires no event in every engine, so the caller can
      // still resolve by dropping the element when the window regains focus.
      window.addEventListener(
        "focus",
        () => {
          window.setTimeout(() => {
            if (input.isConnected && !input.files?.length) finish(null);
          }, 800);
        },
        { once: true },
      );
      document.body.appendChild(input);
      input.click();
    });
  }
}
