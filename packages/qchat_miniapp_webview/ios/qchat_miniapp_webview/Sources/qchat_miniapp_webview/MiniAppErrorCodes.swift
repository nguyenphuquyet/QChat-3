import Foundation

/// Error codes shared with `packages/miniapp-contracts/src/errors.ts`.
///
/// A code is never reused for a different meaning, so the strings here must stay
/// identical to the registry and to the Android host. The iOS host reports these
/// codes to Dart; Dart decides whether to retry or to close the Mini App.
enum MiniAppErrorCodes {
    static let bridgeInvalidMessage = "BRIDGE_INVALID_MESSAGE"
    static let bridgeOriginRejected = "BRIDGE_ORIGIN_REJECTED"
    static let bridgePageMismatch = "BRIDGE_PAGE_MISMATCH"
    static let bridgeTooLarge = "BRIDGE_TOO_LARGE"
    static let bridgePageClosed = "BRIDGE_PAGE_CLOSED"
    static let miniAppWebViewUnsupported = "MINIAPP_WEBVIEW_UNSUPPORTED"
    static let packageInstallFailed = "PACKAGE_INSTALL_FAILED"
    static let manifestInvalid = "MANIFEST_INVALID"
    static let manifestVersionUnsupported = "MANIFEST_VERSION_UNSUPPORTED"
    static let runtimeCrash = "RUNTIME_CRASH"
}
