package com.qchat.miniapp.quickjs

import io.flutter.embedding.engine.plugins.FlutterPlugin

/**
 * Registers `qchat/miniapp/service`, the QuickJS service runtime channel.
 *
 * The plugin has no app-wide state beyond the channel: a runtime belongs to one
 * Mini App session, and [MiniAppServiceChannel] frees every runtime it created
 * when the engine detaches.
 */
class QchatQuickjsPlugin : FlutterPlugin {
    private var service: MiniAppServiceChannel? = null

    override fun onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        service = MiniAppServiceChannel(binding.binaryMessenger)
    }

    override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        service?.dispose()
        service = null
    }
}
