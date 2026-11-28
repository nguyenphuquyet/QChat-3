package com.qchat.miniapp.webview

import io.flutter.embedding.engine.plugins.FlutterPlugin

/**
 * Registers the `qchat/miniapp/webview` platform view.
 *
 * The plugin has no method channel of its own: each view owns
 * `qchat/miniapp/<viewId>`, so two Mini Apps can never share a channel.
 */
class QchatMiniappWebviewPlugin : FlutterPlugin {
    override fun onAttachedToEngine(binding: FlutterPluginBinding) {
        binding.platformViewRegistry.registerViewFactory(
            MiniAppWebViewHost.VIEW_TYPE,
            MiniAppWebViewFactory(
                messenger = binding.binaryMessenger,
                assets = FlutterHostAssets(binding.applicationContext),
            ),
        )
    }

    override fun onDetachedFromEngine(binding: FlutterPluginBinding) {
        // The registry belongs to the engine that is going away; the views are
        // disposed by Flutter before the engine detaches.
    }
}
