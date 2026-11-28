package com.qchat.miniapp.webview

import io.flutter.embedding.engine.plugins.FlutterPlugin

/**
 * Registers the `qchat/miniapp/webview` platform view and the installer path
 * channel.
 *
 * The plugin has no app-wide method channel beyond the installer: each view owns
 * `qchat/miniapp/<viewId>`, so two Mini Apps can never share a channel.
 *
 * `FlutterPluginBinding` is a nested interface of [FlutterPlugin]
 * (`FlutterPlugin.FlutterPluginBinding`); there is no top-level class with that
 * name in the embedding, so the parameter is spelled out here.
 */
class QchatMiniappWebviewPlugin : FlutterPlugin {
    private var installer: MiniAppInstallerChannel? = null

    override fun onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        binding.platformViewRegistry.registerViewFactory(
            MiniAppWebViewHost.VIEW_TYPE,
            MiniAppWebViewFactory(
                messenger = binding.binaryMessenger,
                assets = FlutterHostAssets(binding.applicationContext),
            ),
        )
        installer = MiniAppInstallerChannel(binding.applicationContext, binding.binaryMessenger)
    }

    override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        // The registry belongs to the engine that is going away; the views are
        // disposed by Flutter before the engine detaches.
        installer?.dispose()
        installer = null
    }
}
