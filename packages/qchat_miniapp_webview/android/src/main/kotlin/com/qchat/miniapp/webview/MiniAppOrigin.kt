package com.qchat.miniapp.webview

import android.net.Uri

/**
 * The one origin a Mini App may load from and send bridge messages from.
 *
 * ADR 011 §3 fixes it:
 *
 *   https://appassets.androidplatform.net/qchat/<appId>/<version>/
 *
 * The app id and version are re-validated here even though the installer already
 * checked the manifest. A WebView is the boundary between untrusted page script
 * and the host, so the host never derives a URL or a file path from a string it
 * has not checked itself.
 */
internal object MiniAppOrigin {
    const val SCHEME = "https"
    const val DOMAIN = "appassets.androidplatform.net"

    /** Scripts and the host HTML live here, outside every app directory. */
    const val HOST_ASSET_PREFIX = "/qchat-host/"

    /** The host-owned document. A package file with this name is shadowed. */
    const val VIEW_PAGE_NAME = "__qchat_view.html"

    private val APP_ID = Regex("^[a-z][a-z0-9]*(?:[.-][a-z0-9]+){1,7}$")
    private val VERSION = Regex("^[0-9]+\\.[0-9]+\\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$")
    private val SESSION_ID = Regex("^[A-Za-z0-9_-]{1,128}$")
    private val PAGE_ID = Regex("^p[0-9]{1,9}$")
    private val ROUTE = Regex("^[a-z0-9][a-z0-9._/-]{0,127}$")

    data class Binding(
        val appId: String,
        val version: String,
        val sessionId: String,
        val pageId: String,
        val route: String,
    ) {
        /** The versioned directory path on the app origin. */
        val basePath: String get() = "/qchat/$appId/$version/"

        /** Scheme, host and port only; `addWebMessageListener` cannot match a path. */
        val origin: String get() = "$SCHEME://$DOMAIN"

        val baseUrl: String get() = origin + basePath

        val pageUrl: String get() = baseUrl + VIEW_PAGE_NAME
    }

    sealed class BindingResult {
        data class Valid(val binding: Binding) : BindingResult()
        data class Invalid(val code: String, val message: String) : BindingResult()
    }

    /**
     * Validate the creation parameters. They come from the Flutter side, which is
     * trusted, but the same rules guard against a future caller passing a route
     * such as `../other-app`.
     */
    fun bindingFrom(args: Any?): BindingResult {
        val map = args as? Map<*, *>
            ?: return invalid("The platform view needs an app binding.")

        val appId = map["appId"] as? String
            ?: return invalid("appId is missing.")
        if (!isAppId(appId)) return invalid("appId is invalid.")

        val version = map["version"] as? String
            ?: return invalid("version is missing.")
        if (!isVersion(version)) return invalid("version is invalid.")

        val sessionId = map["sessionId"] as? String
            ?: return invalid("sessionId is missing.")
        if (!SESSION_ID.matches(sessionId)) return invalid("sessionId is invalid.")

        val pageId = map["pageId"] as? String
            ?: return invalid("pageId is missing.")
        if (!PAGE_ID.matches(pageId)) return invalid("pageId is invalid.")

        val route = map["route"] as? String
            ?: return invalid("route is missing.")
        if (!ROUTE.matches(route)) return invalid("route is invalid.")
        if (route.split('/').any { it.isEmpty() || it == "." || it == ".." }) {
            return invalid("route is invalid.")
        }

        return BindingResult.Valid(Binding(appId, version, sessionId, pageId, route))
    }

    /**
     * Belt and braces on top of the `allowedOriginRules` argument: the listener
     * also checks the frame and the current document URL.
     */
    fun isOrigin(uri: Uri): Boolean =
        uri.scheme == SCHEME && uri.host == DOMAIN && (uri.port == -1 || uri.port == 443)

    /** Manifest app id, e.g. `com.example.hello`; never a path. */
    fun isAppId(value: String): Boolean = APP_ID.matches(value)

    /** Semantic version, including prerelease and build metadata. */
    fun isVersion(value: String): Boolean = VERSION.matches(value)

    private fun invalid(message: String) =
        BindingResult.Invalid(MiniAppErrorCodes.BRIDGE_INVALID_MESSAGE, message)
}
