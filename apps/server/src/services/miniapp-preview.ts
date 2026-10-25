import { buildLimits } from "./miniapp-package";
import { readZip } from "./zip";

/// Reviewer preview: the stored ZIP is opened read-only and one file is
/// returned. HTML entries get a small bridge shim so the app can render
/// without the Flutter host; privileged calls are answered with preview data
/// or a clear "not supported in preview" error.
export type PreviewMeta = {
  appId: string;
  name: string;
  version: string;
  entry: string;
  runtimeVersion: string;
  minRuntimeVersion: string;
  permissions: string[];
};

const contentTypes: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8",
  map: "application/json; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  mp4: "video/mp4",
  webm: "video/webm",
  wasm: "application/wasm",
};

export function previewContentType(name: string) {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return contentTypes[extension] ?? "application/octet-stream";
}

function safeJson(value: unknown) {
  // `</script>` inside a manifest string must not terminate the shim script.
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/// Runs before the app bundle. The SDK installs `window.__QChatReceive` when
/// it loads, so every reply is deferred by one task.
export function previewBridgeSource(meta: PreviewMeta) {
  return `(function () {
  window.__QCHAT_PREVIEW__ = true;
  var meta = ${safeJson(meta)};
  var permissions = new Set(meta.permissions || []);
  var granted = function (permission) { return permissions.has(permission); };
  var store = new Map();
  var reply = function (id, ok, payload) {
    var message = JSON.stringify(ok ? { id: id, ok: true, result: payload } : { id: id, ok: false, error: payload });
    if (typeof window.__QChatReceive === "function") window.__QChatReceive(message);
  };
  var fail = function (id, code, message) { reply(id, false, { code: code, message: message }); };
  var toast = function (message) {
    var node = document.createElement("div");
    node.textContent = message;
    node.setAttribute("style", "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);max-width:80%;padding:10px 16px;border-radius:999px;background:#0c3b2f;color:#fff;font:600 13px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25);z-index:2147483647");
    document.body.appendChild(node);
    window.setTimeout(function () { node.remove(); }, 2200);
  };
  window.QChatNative = {
    postMessage: function (raw) {
      var request;
      try { request = JSON.parse(raw); } catch (error) { return; }
      if (!request || typeof request.id !== "string") return;
      var method = String(request.method || "");
      var params = request.params || {};
      window.setTimeout(function () {
        if (method === "getAppInfo") return reply(request.id, true, meta);
        if (method === "getSystemInfo")
          return reply(request.id, true, {
            platform: "web",
            osVersion: "preview",
            appVersion: "preview",
            runtimeVersion: meta.runtimeVersion,
            locale: navigator.language || "en",
            theme: window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
            pixelRatio: window.devicePixelRatio || 1,
            safeAreaTop: 0,
            safeAreaBottom: 0
          });
        if (method === "getUserInfo")
          return granted("user.profile")
            ? reply(request.id, true, { id: "preview", qchatId: "preview_user", nickname: "Preview user", avatarUrl: null })
            : fail(request.id, "PERMISSION_DENIED", "user.profile is not declared in the manifest");
        if (method === "showToast") {
          toast(String(params.message || ""));
          return reply(request.id, true, null);
        }
        if (method === "getStorage" || method === "setStorage" || method === "removeStorage") {
          if (!granted("storage")) return fail(request.id, "PERMISSION_DENIED", "storage is not declared in the manifest");
          if (method === "getStorage") return reply(request.id, true, { value: store.has(params.key) ? store.get(params.key) : null });
          if (method === "setStorage") { store.set(params.key, params.value); return reply(request.id, true, null); }
          store.delete(params.key);
          return reply(request.id, true, null);
        }
        if (method === "chooseImage") return fail(request.id, "NOT_SUPPORTED", "The image picker is unavailable in the preview");
        if (method === "share") {
          toast("Share is simulated in the preview");
          return reply(request.id, true, { shared: true });
        }
        if (method === "navigateTo") {
          toast("navigateTo(" + String(params.path || "") + ") is simulated");
          return reply(request.id, true, null);
        }
        if (method === "closeMiniApp") {
          toast("closeMiniApp is simulated");
          return reply(request.id, true, null);
        }
        if (method === "request") return fail(request.id, "NOT_SUPPORTED", "QChat API calls are unavailable in the preview");
        return fail(request.id, "NOT_SUPPORTED", method + " is not supported in the preview");
      }, 0);
    }
  };
})();`;
}

/// The shim must run before the bundle, so it goes right after `<head>`, or at
/// the very start when the document has no head element.
export function injectPreviewBridge(html: string, meta: PreviewMeta) {
  const script = `<script>${previewBridgeSource(meta)}</script>`;
  const head = /<head(?:\s[^>]*)?>/i.exec(html);
  if (head) {
    const at = head.index + head[0].length;
    return html.slice(0, at) + script + html.slice(at);
  }
  return script + html;
}

export function readPreviewFile(
  archive: Buffer,
  meta: PreviewMeta,
  requested: string,
) {
  const entries = readZip(archive, buildLimits);
  const name = requested || meta.entry;
  const entry = entries.find((file) => file.name === name);
  if (!entry) return null;
  const type = previewContentType(name);
  const bytes = /\.html?$/i.test(name)
    ? Buffer.from(injectPreviewBridge(entry.bytes.toString("utf8"), meta), "utf8")
    : entry.bytes;
  return { name, bytes, type };
}
