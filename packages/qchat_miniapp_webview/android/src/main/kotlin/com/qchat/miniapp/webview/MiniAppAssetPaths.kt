package com.qchat.miniapp.webview

import java.io.File
import java.net.URLDecoder

/**
 * Pure path rules for the installed package.
 *
 * The View WebView needs images, fonts and media. It must never fetch the
 * package's service code (`app.js`, page `.js`, `.wxml`, `.wxss`, `.wxs`) or the
 * manifest: a page script that could read its own service code would make the
 * process split meaningless. Only an extension allowlist is served, and every
 * resolved file must stay under the installed version directory.
 */
internal object MiniAppAssetPaths {
    private val VIEW_EXTENSIONS = setOf(
        "png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico",
        "woff", "woff2", "ttf", "otf",
        "mp3", "wav", "m4a", "aac", "ogg",
        "mp4", "webm", "mov",
    )

    /**
     * Turn a request path into a path relative to the installed directory.
     * Returns null for another prefix, an empty path, an encoded traversal, a
     * backslash, a drive letter or a dot segment.
     */
    fun relativePath(path: String, prefix: String): String? {
        if (!path.startsWith(prefix)) return null
        val raw = path.substring(prefix.length)
        if (raw.isEmpty()) return null

        val decoded = try {
            // Keep a literal '+' intact; URLDecoder would turn it into a space.
            URLDecoder.decode(raw.replace("+", "%2B"), Charsets.UTF_8.name())
        } catch (_: IllegalArgumentException) {
            return null
        }
        if (decoded.isEmpty() || decoded.startsWith("/") || decoded.contains('\\')) return null
        if (decoded.contains('\u0000') || decoded.contains(':')) return null
        val segments = decoded.split('/')
        if (segments.any { it.isEmpty() || it == "." || it == ".." }) return null
        return decoded
    }

    /** True when the file is something the view may draw or play. */
    fun isViewAsset(relative: String): Boolean {
        val name = relative.substringAfterLast('/')
        if (name.isEmpty() || name.startsWith(".")) return false
        val extension = name.substringAfterLast('.', "").lowercase()
        return extension in VIEW_EXTENSIONS
    }

    /** Resolve under [rootDir], or null when the file escapes or is not a view asset. */
    fun resolve(rootDir: File, relative: String): File? {
        if (!isViewAsset(relative)) return null
        val root = try {
            rootDir.canonicalFile
        } catch (_: Exception) {
            return null
        }
        val candidate = try {
            File(root, relative).canonicalFile
        } catch (_: Exception) {
            return null
        }
        val rootPath = root.path
        if (candidate.path != rootPath && !candidate.path.startsWith(rootPath + File.separator)) {
            return null
        }
        return if (candidate.isFile) candidate else null
    }

    fun mimeType(relative: String): String = when (relative.substringAfterLast('.', "").lowercase()) {
        "html" -> "text/html"
        "js" -> "text/javascript"
        "css" -> "text/css"
        "json" -> "application/json"
        "png" -> "image/png"
        "jpg", "jpeg" -> "image/jpeg"
        "gif" -> "image/gif"
        "webp" -> "image/webp"
        "svg" -> "image/svg+xml"
        "bmp" -> "image/bmp"
        "ico" -> "image/x-icon"
        "woff" -> "font/woff"
        "woff2" -> "font/woff2"
        "ttf" -> "font/ttf"
        "otf" -> "font/otf"
        "mp3" -> "audio/mpeg"
        "wav" -> "audio/wav"
        "m4a" -> "audio/mp4"
        "aac" -> "audio/aac"
        "ogg" -> "audio/ogg"
        "mp4" -> "video/mp4"
        "webm" -> "video/webm"
        "mov" -> "video/quicktime"
        else -> "application/octet-stream"
    }
}
