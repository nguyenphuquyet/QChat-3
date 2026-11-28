import Foundation

/// One validated platform-view request: which app version, session and page.
///
/// The ids are re-validated by the host even though the installer already
/// checked the manifest. The WebView is the boundary between untrusted page
/// script and the host, so the host never derives a URL or a file path from a
/// string it has not checked itself.
struct MiniAppBinding: Equatable {
    let appId: String
    let version: String
    let sessionId: String
    let pageId: String
    let route: String

    /// The versioned directory path on the app scheme.
    var basePath: String { "/qchat/\(appId)/\(version)/" }

    /// Scheme and host only; the bridge checks the document as well.
    var origin: String { "\(MiniAppOrigin.scheme)://\(MiniAppOrigin.host)" }

    var baseURL: URL { URL(string: origin + basePath)! }

    var pageURL: URL { URL(string: origin + basePath + MiniAppOrigin.viewPageName)! }
}

enum MiniAppBindingResult {
    case valid(MiniAppBinding)
    case invalid(code: String, message: String)
}

/// The one origin a Mini App may load from and send bridge messages from.
///
/// ADR 018 fixes it, mirroring ADR 011 on Android:
///
///   qchat-app://app/qchat/<appId>/<version>/
///
/// A custom scheme is used because WKWebView cannot hand `https` to a
/// `WKURLSchemeHandler`. The scheme handler serves only the installed version
/// directory and the host assets, so the scheme itself is the trust boundary.
enum MiniAppOrigin {
    static let scheme = "qchat-app"
    static let host = "app"

    /// Scripts and the host HTML live here, outside every app directory.
    static let hostAssetPrefix = "/qchat-host/"

    /// The host-owned document. A package file with this name is shadowed.
    static let viewPageName = "__qchat_view.html"

    private static let appIdExpression = try! NSRegularExpression(
        pattern: "^[a-z][a-z0-9]*(?:[.-][a-z0-9]+){1,7}$"
    )
    private static let versionExpression = try! NSRegularExpression(
        pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$"
    )
    private static let sessionExpression = try! NSRegularExpression(
        pattern: "^[A-Za-z0-9_-]{1,128}$"
    )
    private static let pageExpression = try! NSRegularExpression(
        pattern: "^p[0-9]{1,9}$"
    )
    private static let routeExpression = try! NSRegularExpression(
        pattern: "^[a-z0-9][a-z0-9._/-]{0,127}$"
    )

    /// Validate the creation parameters. They come from the Flutter side, which
    /// is trusted, but the same rules guard against a future caller passing a
    /// route such as `../other-app`.
    static func binding(from args: Any?) -> MiniAppBindingResult {
        guard let map = args as? [String: Any] else {
            return invalid("The platform view needs an app binding.")
        }

        guard let appId = map["appId"] as? String else {
            return invalid("appId is missing.")
        }
        guard isAppId(appId) else {
            return invalid("appId is invalid.")
        }

        guard let version = map["version"] as? String else {
            return invalid("version is missing.")
        }
        guard isVersion(version) else {
            return invalid("version is invalid.")
        }

        guard let sessionId = map["sessionId"] as? String else {
            return invalid("sessionId is missing.")
        }
        guard matches(sessionExpression, sessionId) else {
            return invalid("sessionId is invalid.")
        }

        guard let pageId = map["pageId"] as? String else {
            return invalid("pageId is missing.")
        }
        guard matches(pageExpression, pageId) else {
            return invalid("pageId is invalid.")
        }

        guard let route = map["route"] as? String else {
            return invalid("route is missing.")
        }
        guard matches(routeExpression, route) else {
            return invalid("route is invalid.")
        }
        let segments = route.split(separator: "/", omittingEmptySubsequences: false)
        if segments.contains(where: { $0.isEmpty || $0 == "." || $0 == ".." }) {
            return invalid("route is invalid.")
        }

        return .valid(
            MiniAppBinding(
                appId: appId,
                version: version,
                sessionId: sessionId,
                pageId: pageId,
                route: route
            )
        )
    }

    /// Manifest app id, e.g. `com.example.hello`; never a path.
    static func isAppId(_ value: String) -> Bool {
        matches(appIdExpression, value)
    }

    /// Semantic version, including prerelease and build metadata.
    static func isVersion(_ value: String) -> Bool {
        matches(versionExpression, value)
    }

    /// True when a URL belongs to this app version or to the host assets.
    static func isAppURL(_ url: URL, binding: MiniAppBinding) -> Bool {
        guard url.scheme == scheme, url.host == host else { return false }
        let path = url.path
        return path.hasPrefix(binding.basePath) || path.hasPrefix(hostAssetPrefix)
    }

    private static func matches(_ expression: NSRegularExpression, _ value: String) -> Bool {
        let range = NSRange(value.startIndex..<value.endIndex, in: value)
        return expression.firstMatch(in: value, options: [], range: range)?.range == range
    }

    private static func invalid(_ message: String) -> MiniAppBindingResult {
        .invalid(code: MiniAppErrorCodes.bridgeInvalidMessage, message: message)
    }
}
