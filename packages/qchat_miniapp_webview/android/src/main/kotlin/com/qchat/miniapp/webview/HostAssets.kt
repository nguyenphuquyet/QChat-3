package com.qchat.miniapp.webview

import android.content.Context
import io.flutter.FlutterInjector
import java.io.IOException
import java.io.InputStream

/** The two WebView scripts the plugin ships as Flutter assets. */
internal interface HostAssets {
    fun open(name: String): InputStream?
}

/**
 * Resolves the plugin's Flutter asset keys.
 *
 * Flutter packages plugin assets as
 * `flutter_assets/packages/qchat_miniapp_webview/assets/<name>`, so the key is
 * built with the plugin package name instead of a hard-coded path.
 */
internal class FlutterHostAssets(context: Context) : HostAssets {
    private val appContext = context.applicationContext
    private val loader = FlutterInjector.instance().flutterLoader()

    override fun open(name: String): InputStream? {
        if (name != "qchat-view.js" && name != "qchat-components.js") return null
        val key = loader.getLookupKeyForAsset("assets/$name", "qchat_miniapp_webview")
        return try {
            appContext.assets.open(key)
        } catch (_: IOException) {
            null
        }
    }
}
