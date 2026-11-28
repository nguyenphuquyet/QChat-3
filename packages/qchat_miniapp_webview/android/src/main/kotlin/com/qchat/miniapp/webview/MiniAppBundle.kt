package com.qchat.miniapp.webview

import org.json.JSONObject
import java.io.File

/**
 * Reads the compiled view bundle the installer wrote (ADR 011 §1).
 *
 * The WebView never compiles WXML and never fetches `build/view.json`; the host
 * reads the page's compiled CSS from the installed directory and injects it as a
 * `<style>` element before `__qchatView.start`. The page bundle's `css` already
 * contains app WXSS, page WXSS and component WXSS, so nothing is concatenated
 * twice.
 */
internal object MiniAppBundle {
    const val FORMAT = "qchat-view-bundle"
    const val FORMAT_VERSION = 1
    private const val MAX_BUNDLE_BYTES = 8 * 1024 * 1024

    sealed class Result {
        data class Valid(val css: String) : Result()
        data class Invalid(val code: String, val message: String) : Result()
    }

    fun pageCss(rootDir: File, route: String): Result {
        val file = File(rootDir, "build/view.json")
        if (!file.isFile) {
            return Result.Invalid(
                MiniAppErrorCodes.PACKAGE_INSTALL_FAILED,
                "The installed version has no build/view.json.",
            )
        }
        if (file.length() > MAX_BUNDLE_BYTES) {
            return Result.Invalid(MiniAppErrorCodes.MANIFEST_INVALID, "The view bundle is too large.")
        }

        val bundle = try {
            JSONObject(file.readText(Charsets.UTF_8))
        } catch (_: Exception) {
            return Result.Invalid(MiniAppErrorCodes.MANIFEST_INVALID, "The view bundle is not JSON.")
        }

        if (bundle.optString("format") != FORMAT) {
            return Result.Invalid(MiniAppErrorCodes.MANIFEST_INVALID, "The view bundle format is unknown.")
        }
        if (bundle.optInt("formatVersion", -1) != FORMAT_VERSION) {
            return Result.Invalid(
                MiniAppErrorCodes.MANIFEST_VERSION_UNSUPPORTED,
                "The view bundle version is not supported.",
            )
        }

        val pages = bundle.optJSONObject("pages")
            ?: return Result.Invalid(MiniAppErrorCodes.MANIFEST_INVALID, "The view bundle has no pages.")
        val page = pages.optJSONObject(route)
            ?: return Result.Invalid(
                MiniAppErrorCodes.MANIFEST_INVALID,
                "The view bundle has no page $route.",
            )

        return Result.Valid(page.optString("css", ""))
    }
}
