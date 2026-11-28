package com.qchat.miniapp.webview

import android.content.Context
import java.io.File

/**
 * One validated platform-view request.
 *
 * The installed directory is derived from the app id and version under the app's
 * private files directory. A path from Dart is never used, so a caller cannot
 * point the loader at another app or at the app's database.
 */
internal class MiniAppViewRequest private constructor(
    val binding: MiniAppOrigin.Binding,
    val rootDir: File,
    val pageCss: String,
) {
    sealed class ParseResult {
        data class Valid(val request: MiniAppViewRequest) : ParseResult()
        data class Invalid(val code: String, val message: String) : ParseResult()
    }

    companion object {
        fun parse(context: Context, args: Any?): ParseResult {
            val binding = when (val result = MiniAppOrigin.bindingFrom(args)) {
                is MiniAppOrigin.BindingResult.Invalid ->
                    return ParseResult.Invalid(result.code, result.message)
                is MiniAppOrigin.BindingResult.Valid -> result.binding
            }

            val filesDir = context.filesDir.canonicalFile
            val rootDir = MiniAppInstallPaths
                .versionDir(filesDir, binding.appId, binding.version)
                .canonicalFile
            if (!rootDir.isDirectory || !rootDir.path.startsWith(filesDir.path + File.separator)) {
                return ParseResult.Invalid(
                    MiniAppErrorCodes.PACKAGE_INSTALL_FAILED,
                    "The installed version directory is missing.",
                )
            }

            val css = when (val result = MiniAppBundle.pageCss(rootDir, binding.route)) {
                is MiniAppBundle.Result.Invalid ->
                    return ParseResult.Invalid(result.code, result.message)
                is MiniAppBundle.Result.Valid -> result.css
            }

            return ParseResult.Valid(MiniAppViewRequest(binding, rootDir, css))
        }
    }
}
