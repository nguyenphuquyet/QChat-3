import Foundation

/// Pure path rules for the installed package.
///
/// The View WebView needs images, fonts and media. It must never fetch the
/// package's service code (`app.js`, page `.js`, `.wxml`, `.wxss`, `.wxs`) or the
/// manifest: a page script that could read its own service code would make the
/// process split meaningless. Only an extension allowlist is served, and every
/// resolved file must stay under the installed version directory.
enum MiniAppAssetPaths {
    private static let viewExtensions: Set<String> = [
        "png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico",
        "woff", "woff2", "ttf", "otf",
        "mp3", "wav", "m4a", "aac", "ogg",
        "mp4", "webm", "mov",
    ]

    /// Turn a decoded URL path into a path relative to the installed directory.
    ///
    /// `URL.path` is already percent-decoded once, so a second decoding would
    /// turn `%252e%252e` into `..`. The path is not decoded again: a literal
    /// `%2e%2e` segment is just a file name that does not exist.
    ///
    /// Returns nil for another prefix, an empty path, a backslash, a colon, a
    /// NUL or a dot segment.
    static func relativePath(from path: String, prefix: String) -> String? {
        guard path.hasPrefix(prefix) else { return nil }
        let raw = String(path.dropFirst(prefix.count))
        guard !raw.isEmpty, !raw.hasPrefix("/") else { return nil }
        guard !raw.contains("\\"), !raw.contains(":"), !raw.contains("\0") else { return nil }
        let segments = raw.split(separator: "/", omittingEmptySubsequences: false)
        guard segments.allSatisfy({ !$0.isEmpty && $0 != "." && $0 != ".." }) else {
            return nil
        }
        return raw
    }

    /// True when the file is something the view may draw or play.
    static func isViewAsset(_ relative: String) -> Bool {
        let name = relative.split(separator: "/").last.map(String.init) ?? ""
        if name.isEmpty || name.hasPrefix(".") { return false }
        let fileExtension = name.split(separator: ".").last.map(String.init)?.lowercased() ?? ""
        return viewExtensions.contains(fileExtension)
    }

    /// Resolve under [rootDirectory], or nil when the file escapes or is not a
    /// view asset.
    static func resolve(rootDirectory: URL, relative: String) -> URL? {
        guard isViewAsset(relative) else { return nil }
        let root = rootDirectory.resolvingSymlinksInPath().standardizedFileURL
        let candidate = root
            .appendingPathComponent(relative)
            .resolvingSymlinksInPath()
            .standardizedFileURL
        guard candidate.path.hasPrefix(root.path + "/") else { return nil }
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: candidate.path, isDirectory: &isDirectory),
              !isDirectory.boolValue else {
            return nil
        }
        return candidate
    }

    static func mimeType(_ name: String) -> String {
        switch name.split(separator: ".").last.map(String.init)?.lowercased() ?? "" {
        case "html": return "text/html"
        case "js": return "text/javascript"
        case "css": return "text/css"
        case "json": return "application/json"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "gif": return "image/gif"
        case "webp": return "image/webp"
        case "svg": return "image/svg+xml"
        case "bmp": return "image/bmp"
        case "ico": return "image/x-icon"
        case "woff": return "font/woff"
        case "woff2": return "font/woff2"
        case "ttf": return "font/ttf"
        case "otf": return "font/otf"
        case "mp3": return "audio/mpeg"
        case "wav": return "audio/wav"
        case "m4a": return "audio/mp4"
        case "aac": return "audio/aac"
        case "ogg": return "audio/ogg"
        case "mp4": return "video/mp4"
        case "webm": return "video/webm"
        case "mov": return "video/quicktime"
        default: return "application/octet-stream"
        }
    }
}
