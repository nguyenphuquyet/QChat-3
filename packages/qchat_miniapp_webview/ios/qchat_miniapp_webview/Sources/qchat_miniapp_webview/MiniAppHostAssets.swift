import Flutter
import Foundation

/// The two WebView scripts the plugin ships as Flutter assets.
protocol MiniAppHostAssets {
    func data(named name: String) -> Data?
}

/// Resolves the plugin's Flutter asset keys.
///
/// Flutter packages plugin assets as
/// `flutter_assets/packages/qchat_miniapp_webview/assets/<name>`, so the key is
/// built with the plugin package name instead of a hard-coded path. The key
/// lookup comes from the registrar, which owns the correct bundle for the
/// engine that is registering the plugin.
final class BundleHostAssets: MiniAppHostAssets {
    private static let names: Set<String> = ["qchat-view.js", "qchat-components.js"]

    private let lookupKey: (String) -> String?

    init(lookupKey: @escaping (String) -> String?) {
        self.lookupKey = lookupKey
    }

    func data(named name: String) -> Data? {
        guard Self.names.contains(name),
              let key = lookupKey("assets/\(name)") else {
            return nil
        }
        // The key is a path inside the bundle (`flutter_assets/packages/...`),
        // so it is joined to the bundle root instead of being looked up as a
        // single resource name.
        let path = Bundle.main.bundlePath + "/" + key
        guard FileManager.default.fileExists(atPath: path) else { return nil }
        return FileManager.default.contents(atPath: path)
    }
}
