package com.qchat.miniapp.webview

import android.content.Context
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.StandardMessageCodec
import io.flutter.plugin.platform.PlatformView
import io.flutter.plugin.platform.PlatformViewFactory

/**
 * Builds one [MiniAppWebViewHost] per `AndroidView`.
 *
 * Creation parameters are the app binding; the installed directory and the page
 * CSS are derived by the host, not passed in.
 */
internal class MiniAppWebViewFactory(
    private val messenger: BinaryMessenger,
    private val assets: HostAssets,
) : PlatformViewFactory(StandardMessageCodec.INSTANCE) {
    override fun create(context: Context, viewId: Int, args: Any?): PlatformView =
        MiniAppWebViewHost(context, messenger, viewId, args, assets)
}
