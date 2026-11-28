package com.qchat.miniapp.webview

import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.ApplicationInfo
import android.graphics.Color
import android.net.Uri
import android.view.View
import android.webkit.CookieManager
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.platform.PlatformView
import org.json.JSONObject
import org.json.JSONTokener

/**
 * One Mini App View WebView.
 *
 * It owns the document, the origin-bound bridge and the lifecycle. The service
 * runtime (QuickJS) is not part of this class: it receives the same bridge
 * events through the Dart channel and sends render payloads back with [send].
 *
 * Nothing here has run on a real device yet. The CI build and the JVM tests are
 * `VERIFIED` for "builds" only; STATUS.md §5.4 stays the device checklist.
 */
internal class MiniAppWebViewHost(
    context: Context,
    messenger: BinaryMessenger,
    viewId: Int,
    args: Any?,
    private val hostAssets: HostAssets,
) : PlatformView {

    private val appContext = context.applicationContext
    private val channel = MethodChannel(messenger, CHANNEL_PREFIX + viewId)
    private val webView = WebView(context)
    private val pageView: View = webView

    private var binding: MiniAppOrigin.Binding? = null
    private var pageCss: String = ""
    private var started = false
    private var disposed = false

    /**
     * Errors raised before the Dart side has installed its method-call handler
     * are queued, not dropped. Dart sends `ready` right after it attaches, and
     * the queue is flushed then; a validation failure in `init` therefore still
     * reaches the screen instead of becoming a silent blank view.
     */
    private var dartReady = false
    private val pendingErrors = mutableListOf<Pair<String, String>>()

    init {
        channel.setMethodCallHandler { call, reply -> handleCall(call, reply) }
        // `args` is a constructor parameter, not a property, so it is passed in:
        // a member function cannot see it.
        start(args)
    }

    override fun getView(): View = pageView

    private fun start(args: Any?) {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            reportError(
                MiniAppErrorCodes.MINIAPP_WEBVIEW_UNSUPPORTED,
                "The system WebView does not support addWebMessageListener.",
            )
            return
        }

        when (val result = MiniAppViewRequest.parse(appContext, args)) {
            is MiniAppViewRequest.ParseResult.Invalid -> {
                reportError(result.code, result.message)
                return
            }
            is MiniAppViewRequest.ParseResult.Valid -> {
                binding = result.request.binding
                pageCss = result.request.pageCss
                configure(result.request)
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Suppress("DEPRECATION")
    private fun configure(request: MiniAppViewRequest) {
        val binding = request.binding
        webView.setBackgroundColor(Color.TRANSPARENT)
        webView.overScrollMode = View.OVER_SCROLL_NEVER

        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = false
        settings.databaseEnabled = false
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.allowFileAccessFromFileURLs = false
        settings.allowUniversalAccessFromFileURLs = false
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        settings.javaScriptCanOpenWindowsAutomatically = false
        settings.setSupportMultipleWindows(false)
        settings.setSupportZoom(false)
        settings.builtInZoomControls = false
        settings.displayZoomControls = false
        settings.setGeolocationEnabled(false)
        settings.mediaPlaybackRequiresUserGesture = true
        settings.textZoom = 100

        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false)

        if (WebViewFeature.isFeatureSupported(WebViewFeature.SAFE_BROWSING_ENABLE)) {
            WebSettingsCompat.setSafeBrowsingEnabled(settings, true)
        }
        // ADR 004/006: the Mini App theme is qxColorScheme, never a WebView guess.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK)) {
            WebSettingsCompat.setForceDark(settings, WebSettingsCompat.FORCE_DARK_OFF)
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(settings, false)
        }

        val debuggable = (appContext.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
        WebView.setWebContentsDebuggingEnabled(debuggable)

        val assetLoader = WebViewAssetLoader.Builder()
            .setDomain(MiniAppOrigin.DOMAIN)
            .addPathHandler(
                MiniAppOrigin.HOST_ASSET_PREFIX,
                HostAssetPathHandler(hostAssets),
            )
            .addPathHandler(
                binding.basePath,
                MiniAppAssetPathHandler(
                    rootDir = request.rootDir,
                    urlPrefix = binding.basePath,
                    hostPage = { hostPage() },
                ),
            )
            .build()

        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest,
            ): WebResourceResponse? {
                val url = request.url
                if (isAppUrl(url, binding)) {
                    return assetLoader.shouldInterceptRequest(url) ?: MiniAppResponses.notFound()
                }
                if (url.scheme == "data" || url.scheme == "about" || url.scheme == "blob") {
                    return null
                }
                // No remote document, script, image or fetch may load. The CSP
                // already says so; this is the second, native gate.
                return MiniAppResponses.forbidden()
            }

            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest,
            ): Boolean = !isAppUrl(request.url, binding)

            override fun onPageFinished(view: WebView, url: String) {
                if (disposed || started || url != binding.pageUrl) return
                started = true
                injectCssAndStart(binding)
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError,
            ) {
                if (!request.isForMainFrame) return
                reportError(
                    MiniAppErrorCodes.RUNTIME_CRASH,
                    "The view document failed to load: ${error.description}.",
                )
            }

            override fun onRenderProcessGone(
                view: WebView,
                detail: RenderProcessGoneDetail,
            ): Boolean {
                reportError(
                    MiniAppErrorCodes.RUNTIME_CRASH,
                    "The WebView render process was lost.",
                )
                return true
            }
        }

        WebViewCompat.addWebMessageListener(
            webView,
            VIEW_BRIDGE_OBJECT,
            setOf(binding.origin),
            object : WebViewCompat.WebMessageListener {
                override fun onPostMessage(
                    view: WebView,
                    message: WebMessageCompat,
                    sourceOrigin: Uri,
                    isMainFrame: Boolean,
                    replyProxy: JavaScriptReplyProxy,
                ) {
                    onPageMessage(view, message, sourceOrigin, isMainFrame)
                }
            },
        )

        webView.loadUrl(binding.pageUrl)
    }

    private fun injectCssAndStart(binding: MiniAppOrigin.Binding) {
        val css = pageCss
        val style = "(function(){" +
            "var s=document.createElement('style');" +
            "s.id='qchat-page-style';" +
            "s.textContent=${JSONObject.quote(css)};" +
            "document.head.appendChild(s);" +
            "})()"
        webView.evaluateJavascript(style, null)

        val startJson = JSONObject()
            .put("appId", binding.appId)
            .put("sessionId", binding.sessionId)
            .put("pageId", binding.pageId)
            .toString()
        webView.evaluateJavascript(
            "window.__qchatView.start(${JSONObject.quote(startJson)})",
        ) { raw ->
            if (disposed) return@evaluateJavascript
            val result = decodeJsString(raw)
            if (result == null) {
                reportError(MiniAppErrorCodes.RUNTIME_CRASH, "The view did not answer start.")
                return@evaluateJavascript
            }
            val parsed = try {
                JSONObject(result)
            } catch (_: Exception) {
                reportError(MiniAppErrorCodes.RUNTIME_CRASH, "The view answered start with invalid JSON.")
                return@evaluateJavascript
            }
            if (!parsed.optBoolean("ok", false)) {
                val error = parsed.optJSONObject("error")
                reportError(
                    error?.optString("code")?.takeIf { it.isNotEmpty() }
                        ?: MiniAppErrorCodes.RUNTIME_CRASH,
                    error?.optString("message")?.takeIf { it.isNotEmpty() }
                        ?: "The view refused to start.",
                )
            }
        }
    }

    private fun onPageMessage(
        view: WebView,
        message: WebMessageCompat,
        sourceOrigin: Uri,
        isMainFrame: Boolean,
    ) {
        if (disposed) return
        val binding = binding ?: return

        if (!isMainFrame || !MiniAppOrigin.isOrigin(sourceOrigin)) {
            reportError(
                MiniAppErrorCodes.BRIDGE_ORIGIN_REJECTED,
                "The message did not come from the app origin.",
            )
            return
        }
        val current = view.url ?: ""
        if (!current.startsWith(binding.baseUrl)) {
            reportError(
                MiniAppErrorCodes.BRIDGE_ORIGIN_REJECTED,
                "The document is not the installed Mini App page.",
            )
            return
        }

        val data = message.data
        if (data == null) {
            reportError(
                MiniAppErrorCodes.BRIDGE_INVALID_MESSAGE,
                "The bridge message must be a string.",
            )
            return
        }
        if (data.toByteArray(Charsets.UTF_8).size > MAX_BRIDGE_BYTES) {
            reportError(MiniAppErrorCodes.BRIDGE_TOO_LARGE, "The bridge message is too large.")
            return
        }

        val envelope = try {
            JSONObject(data)
        } catch (_: Exception) {
            reportError(MiniAppErrorCodes.BRIDGE_INVALID_MESSAGE, "The bridge message is not JSON.")
            return
        }
        if (envelope.optInt("v", -1) != BRIDGE_VERSION) {
            reportError(
                MiniAppErrorCodes.BRIDGE_INVALID_MESSAGE,
                "The bridge version is not supported.",
            )
            return
        }
        if (envelope.optString("kind") !in BRIDGE_KINDS) {
            reportError(MiniAppErrorCodes.BRIDGE_INVALID_MESSAGE, "The bridge kind is unknown.")
            return
        }
        if (
            envelope.optString("appId") != binding.appId ||
            envelope.optString("sessionId") != binding.sessionId ||
            envelope.optString("pageId") != binding.pageId
        ) {
            reportError(
                MiniAppErrorCodes.BRIDGE_PAGE_MISMATCH,
                "The message is bound to another app, session or page.",
            )
            return
        }

        channel.invokeMethod("onMessage", mapOf("message" to data))
    }

    private fun handleCall(call: MethodCall, reply: MethodChannel.Result) {
        when (call.method) {
            "ready" -> {
                flushErrors()
                reply.success(null)
            }
            "send" -> {
                val message = (call.arguments as? Map<*, *>)?.get("message") as? String
                if (disposed || !started) {
                    reply.error(MiniAppErrorCodes.BRIDGE_PAGE_CLOSED, "The page is closed.", null)
                    return
                }
                if (message == null || message.toByteArray(Charsets.UTF_8).size > MAX_BRIDGE_BYTES) {
                    reply.error(
                        MiniAppErrorCodes.BRIDGE_INVALID_MESSAGE,
                        "The message is missing or too large.",
                        null,
                    )
                    return
                }
                webView.evaluateJavascript(
                    "window.__qchatView.receive(${JSONObject.quote(message)})",
                    null,
                )
                reply.success(null)
            }
            "destroy" -> {
                if (!disposed) {
                    webView.evaluateJavascript("window.__qchatView.destroy()", null)
                    started = false
                }
                reply.success(null)
            }
            else -> reply.notImplemented()
        }
    }

    private fun reportError(code: String, message: String) {
        if (disposed) return
        if (!dartReady) {
            pendingErrors.add(code to message)
            return
        }
        channel.invokeMethod("onError", mapOf("code" to code, "message" to message))
    }

    private fun flushErrors() {
        dartReady = true
        if (pendingErrors.isEmpty()) return
        val errors = pendingErrors.toList()
        pendingErrors.clear()
        for ((code, message) in errors) {
            channel.invokeMethod("onError", mapOf("code" to code, "message" to message))
        }
    }

    override fun dispose() {
        if (disposed) return
        disposed = true
        channel.setMethodCallHandler(null)
        try {
            webView.stopLoading()
        } catch (_: Exception) {
            // The render process may already be gone; teardown still continues.
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            try {
                WebViewCompat.removeWebMessageListener(webView, VIEW_BRIDGE_OBJECT)
            } catch (_: Exception) {
                // Nothing is left to remove when the WebView is already dead.
            }
        }
        try {
            webView.loadUrl("about:blank")
            webView.webChromeClient = null
            webView.webViewClient = WebViewClient()
            webView.removeAllViews()
        } catch (_: Exception) {
            // Same as above: dispose must never throw into Flutter.
        }
        webView.destroy()
    }

    private fun isAppUrl(url: Uri, binding: MiniAppOrigin.Binding): Boolean {
        if (url.scheme != MiniAppOrigin.SCHEME || url.host != MiniAppOrigin.DOMAIN) return false
        val path = url.path ?: return false
        return path.startsWith(binding.basePath) || path.startsWith(MiniAppOrigin.HOST_ASSET_PREFIX)
    }

    private fun hostPage(): String = """
        <!doctype html>
        <html lang="en">
        <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
        <title>QChat Mini App</title>
        <script src="${MiniAppOrigin.HOST_ASSET_PREFIX}qchat-components.js"></script>
        <script src="${MiniAppOrigin.HOST_ASSET_PREFIX}qchat-view.js"></script>
        </head>
        <body><div id="qchat-root"></div></body>
        </html>
    """.trimIndent()

    private fun decodeJsString(raw: String?): String? {
        if (raw == null || raw == "null") return null
        return try {
            JSONTokener(raw).nextValue() as? String
        } catch (_: Exception) {
            null
        }
    }

    companion object {
        const val CHANNEL_PREFIX = "qchat/miniapp/"
        const val VIEW_BRIDGE_OBJECT = "qchatViewBridge"
        const val VIEW_TYPE = "qchat/miniapp/webview"
        const val BRIDGE_VERSION = 1
        const val MAX_BRIDGE_BYTES = 1024 * 1024
        private val BRIDGE_KINDS = setOf("request", "response", "event", "cancel")
    }
}
