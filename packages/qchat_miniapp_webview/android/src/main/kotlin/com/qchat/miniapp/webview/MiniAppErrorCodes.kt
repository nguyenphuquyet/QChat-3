package com.qchat.miniapp.webview

/**
 * Error codes shared with `packages/miniapp-contracts/src/errors.ts`.
 *
 * A code is never reused for a different meaning, so the strings here must stay
 * identical to the registry. The Kotlin host reports these codes to Dart; Dart
 * decides whether to retry or to close the Mini App.
 */
internal object MiniAppErrorCodes {
    const val BRIDGE_INVALID_MESSAGE = "BRIDGE_INVALID_MESSAGE"
    const val BRIDGE_ORIGIN_REJECTED = "BRIDGE_ORIGIN_REJECTED"
    const val BRIDGE_PAGE_MISMATCH = "BRIDGE_PAGE_MISMATCH"
    const val BRIDGE_TOO_LARGE = "BRIDGE_TOO_LARGE"
    const val BRIDGE_PAGE_CLOSED = "BRIDGE_PAGE_CLOSED"
    const val MINIAPP_WEBVIEW_UNSUPPORTED = "MINIAPP_WEBVIEW_UNSUPPORTED"
    const val PACKAGE_INSTALL_FAILED = "PACKAGE_INSTALL_FAILED"
    const val MANIFEST_INVALID = "MANIFEST_INVALID"
    const val MANIFEST_VERSION_UNSUPPORTED = "MANIFEST_VERSION_UNSUPPORTED"
    const val RUNTIME_CRASH = "RUNTIME_CRASH"
}
