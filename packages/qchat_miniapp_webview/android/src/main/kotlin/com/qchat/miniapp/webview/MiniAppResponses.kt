package com.qchat.miniapp.webview

import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileInputStream
import java.io.InputStream

/**
 * Responses served to the View WebView.
 *
 * Only the host page carries a Content-Security-Policy; it then governs every
 * subresource of the document. `style-src 'unsafe-inline'` is required because
 * WXSS and the P0/P1 components write `<style>` elements; `script-src` stays
 * `'self'`, so no inline script can run even if page data reached markup.
 */
internal object MiniAppResponses {
    const val CSP = "default-src 'none'; " +
        "script-src 'self'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data:; " +
        "font-src 'self'; " +
        "media-src 'self'; " +
        "connect-src 'none'; " +
        "frame-src 'none'; " +
        "worker-src 'none'; " +
        "object-src 'none'; " +
        "base-uri 'none'; " +
        "form-action 'none'"

    fun html(body: String): WebResourceResponse =
        respond("text/html", ByteArrayInputStream(body.toByteArray(Charsets.UTF_8)), cacheable = false)

    fun asset(mime: String, stream: InputStream): WebResourceResponse =
        respond(mime, stream, cacheable = true)

    fun notFound(): WebResourceResponse =
        error(404, "Not Found")

    fun forbidden(): WebResourceResponse =
        error(403, "Forbidden")

    private fun respond(mime: String, stream: InputStream, cacheable: Boolean): WebResourceResponse {
        val headers = mutableMapOf(
            "X-Content-Type-Options" to "nosniff",
            "Referrer-Policy" to "no-referrer",
        )
        if (mime == "text/html") headers["Content-Security-Policy"] = CSP
        headers["Cache-Control"] =
            if (cacheable) "public, max-age=31536000, immutable" else "no-store"
        return WebResourceResponse(mime, "utf-8", 200, "OK", headers, stream)
    }

    private fun error(status: Int, reason: String): WebResourceResponse =
        WebResourceResponse(
            "text/plain",
            "utf-8",
            status,
            reason,
            mapOf("Cache-Control" to "no-store", "X-Content-Type-Options" to "nosniff"),
            ByteArrayInputStream(reason.toByteArray(Charsets.UTF_8)),
        )
}

/** The installed directory of one app version, or the host scripts. */
internal class MiniAppAssetPathHandler(
    private val rootDir: File,
    private val urlPrefix: String,
    private val hostPage: () -> String,
) : WebViewAssetLoader.PathHandler {
    override fun handle(path: String): WebResourceResponse {
        val relative = MiniAppAssetPaths.relativePath(path, urlPrefix)
            ?: return MiniAppResponses.notFound()

        // Host-owned names are reserved: a package cannot shadow the document.
        // `path` is the URL path here, not the absolute URL.
        if (relative.startsWith("__qchat_")) {
            return if (path == urlPrefix + MiniAppOrigin.VIEW_PAGE_NAME) {
                MiniAppResponses.html(hostPage())
            } else {
                MiniAppResponses.notFound()
            }
        }

        val file = MiniAppAssetPaths.resolve(rootDir, relative)
            ?: return MiniAppResponses.notFound()
        val stream = try {
            FileInputStream(file)
        } catch (_: Exception) {
            return MiniAppResponses.notFound()
        }
        return MiniAppResponses.asset(MiniAppAssetPaths.mimeType(relative), stream)
    }
}

/** Serves `qchat-view.js` and `qchat-components.js` from the plugin assets. */
internal class HostAssetPathHandler(
    private val assets: HostAssets,
) : WebViewAssetLoader.PathHandler {
    override fun handle(path: String): WebResourceResponse {
        if (!path.startsWith(MiniAppOrigin.HOST_ASSET_PREFIX)) return MiniAppResponses.notFound()
        val name = path.removePrefix(MiniAppOrigin.HOST_ASSET_PREFIX)
        if (name.isEmpty() || name.contains('/') || name.contains('\\') || name.contains("..")) {
            return MiniAppResponses.notFound()
        }
        val stream = assets.open(name) ?: return MiniAppResponses.notFound()
        return MiniAppResponses.asset(MiniAppAssetPaths.mimeType(name), stream)
    }
}
