import Foundation

/// The installed layout of ADR 011 §2, in one place.
///
/// The Dart installer writes the files and the WebView host reads them, so both
/// must derive the same directory from the app id and version. On iOS the
/// analogue of Android's `filesDir` is Application Support: private to the app,
/// not visible in the Files app. The host computes the path; Dart asks for it
/// through `qchat/miniapp/installer` instead of rebuilding it.
enum MiniAppInstallPaths {
    static func filesDirectory() -> URL {
        let base = FileManager.default
            .urls(for: .applicationSupportDirectory, in: .userDomainMask)
            .first
            ?? URL(fileURLWithPath: NSHomeDirectory(), isDirectory: true)
        return base.appendingPathComponent("miniapps", isDirectory: true)
    }

    static func appsDirectory() -> URL {
        filesDirectory().appendingPathComponent("apps", isDirectory: true)
    }

    static func versionDirectory(appId: String, version: String) -> URL {
        appsDirectory()
            .appendingPathComponent(appId, isDirectory: true)
            .appendingPathComponent("versions", isDirectory: true)
            .appendingPathComponent(version, isDirectory: true)
    }

    /// `build/view.json`, the compiled bundle the host reads for the page CSS.
    static func bundleFile(appId: String, version: String) -> URL {
        versionDirectory(appId: appId, version: version)
            .appendingPathComponent("build", isDirectory: true)
            .appendingPathComponent("view.json", isDirectory: false)
    }
}
