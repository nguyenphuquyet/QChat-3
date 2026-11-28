package com.qchat.miniapp.webview

import android.content.Context
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.io.File

/**
 * The host's half of the install seam.
 *
 * `versionDir` is the only method today: the Dart installer needs the exact
 * directory the WebView will read, and the host must never accept a path from
 * Dart. The method validates the app id and version with the same rules as the
 * platform-view binding, then derives the path from its own `filesDir`.
 */
internal class MiniAppInstallerChannel(
    context: Context,
    messenger: BinaryMessenger,
) {
    private val filesDir: File = context.applicationContext.filesDir
    private val channel = MethodChannel(messenger, CHANNEL)

    init {
        channel.setMethodCallHandler { call, reply -> handle(call, reply) }
    }

    fun dispose() {
        channel.setMethodCallHandler(null)
    }

    private fun handle(call: MethodCall, reply: MethodChannel.Result) {
        when (call.method) {
            "versionDir" -> {
                val args = call.arguments as? Map<*, *>
                val appId = args?.get("appId") as? String
                val version = args?.get("version") as? String
                if (appId == null || version == null ||
                    !MiniAppOrigin.isAppId(appId) || !MiniAppOrigin.isVersion(version)
                ) {
                    reply.error(
                        MiniAppErrorCodes.BRIDGE_INVALID_MESSAGE,
                        "appId or version is invalid.",
                        null,
                    )
                    return
                }
                reply.success(MiniAppInstallPaths.versionDir(filesDir, appId, version).absolutePath)
            }
            else -> reply.notImplemented()
        }
    }

    companion object {
        const val CHANNEL = "qchat/miniapp/installer"
    }
}
