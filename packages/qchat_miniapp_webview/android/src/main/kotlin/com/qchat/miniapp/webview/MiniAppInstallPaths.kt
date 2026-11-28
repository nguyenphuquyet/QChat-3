package com.qchat.miniapp.webview

import java.io.File

/**
 * The installed layout of ADR 011 §2, in one place.
 *
 * The Dart installer writes the files and the WebView host reads them, so both
 * must derive the same directory from the app id and version. The host computes
 * it from its own `filesDir`; Dart asks for it through
 * `qchat/miniapp/installer` instead of rebuilding the path itself.
 */
internal object MiniAppInstallPaths {
    fun appsDir(filesDir: File): File = File(File(filesDir, "miniapps"), "apps")

    fun versionDir(filesDir: File, appId: String, version: String): File =
        File(File(appsDir(filesDir), appId), "versions${File.separator}$version")

    /** `build/view.json`, the compiled bundle the host reads for the page CSS. */
    fun bundleFile(filesDir: File, appId: String, version: String): File =
        File(File(versionDir(filesDir, appId, version), "build"), "view.json")
}
