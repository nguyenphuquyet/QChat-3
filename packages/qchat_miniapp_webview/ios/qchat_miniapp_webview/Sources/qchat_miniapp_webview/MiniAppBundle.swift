import Foundation

/// Reads the compiled view bundle the installer wrote (ADR 011 §1).
///
/// The WebView never compiles WXML and never fetches `build/view.json`; the host
/// reads the page's compiled CSS from the installed directory and injects it as a
/// `<style>` element before `__qchatView.start`. The page bundle's `css` already
/// contains app WXSS, page WXSS and component WXSS, so nothing is concatenated
/// twice.
enum MiniAppBundle {
    static let format = "qchat-view-bundle"
    static let formatVersion = 1
    private static let maxBundleBytes = 8 * 1024 * 1024

    enum Result {
        case valid(css: String)
        case invalid(code: String, message: String)
    }

    static func pageCSS(rootDirectory: URL, route: String) -> Result {
        let file = rootDirectory
            .appendingPathComponent("build", isDirectory: true)
            .appendingPathComponent("view.json", isDirectory: false)

        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: file.path, isDirectory: &isDirectory),
              !isDirectory.boolValue else {
            return .invalid(
                code: MiniAppErrorCodes.packageInstallFailed,
                message: "The installed version has no build/view.json."
            )
        }

        if let attributes = try? FileManager.default.attributesOfItem(atPath: file.path),
           let size = attributes[.size] as? NSNumber,
           size.intValue > maxBundleBytes {
            return .invalid(
                code: MiniAppErrorCodes.manifestInvalid,
                message: "The view bundle is too large."
            )
        }

        guard let data = try? Data(contentsOf: file),
              let object = try? JSONSerialization.jsonObject(with: data),
              let bundle = object as? [String: Any] else {
            return .invalid(
                code: MiniAppErrorCodes.manifestInvalid,
                message: "The view bundle is not JSON."
            )
        }

        guard bundle["format"] as? String == format else {
            return .invalid(
                code: MiniAppErrorCodes.manifestInvalid,
                message: "The view bundle format is unknown."
            )
        }
        guard let version = bundle["formatVersion"] as? Int, version == formatVersion else {
            return .invalid(
                code: MiniAppErrorCodes.manifestVersionUnsupported,
                message: "The view bundle version is not supported."
            )
        }

        guard let pages = bundle["pages"] as? [String: Any] else {
            return .invalid(
                code: MiniAppErrorCodes.manifestInvalid,
                message: "The view bundle has no pages."
            )
        }
        guard let page = pages[route] as? [String: Any] else {
            return .invalid(
                code: MiniAppErrorCodes.manifestInvalid,
                message: "The view bundle has no page \(route)."
            )
        }

        return .valid(css: page["css"] as? String ?? "")
    }
}
