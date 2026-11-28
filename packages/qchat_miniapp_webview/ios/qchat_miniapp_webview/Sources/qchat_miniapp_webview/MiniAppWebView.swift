import Flutter
import UIKit
import WebKit

/// One Mini App View WKWebView.
///
/// It owns the document, the scheme handler, the message handler and the
/// lifecycle. The service runtime (JavaScriptCore) is not part of this class: it
/// receives the same bridge events through the Dart channel and sends render
/// payloads back with `send`.
///
/// The Dart side talks over `qchat/miniapp/<viewId>` exactly as on Android, so
/// `MiniAppWebView` and `MiniAppWebViewController` have one contract on both
/// platforms (ADR 012/018).
final class MiniAppWebView: NSObject, FlutterPlatformView {
    static let viewType = "qchat/miniapp/webview"
    static let bridgeName = "qchatViewBridge"
    static let channelPrefix = "qchat/miniapp/"
    static let bridgeVersion = 1
    static let maxBridgeBytes = 1024 * 1024
    static let bridgeKinds: Set<String> = ["request", "response", "event", "cancel"]

    private let webView: WKWebView
    private let userContentController: WKUserContentController
    private let channel: FlutterMethodChannel
    private let schemeHandler: MiniAppSchemeHandler
    private let bridgeHandler: BridgeMessageHandler
    private let binding: MiniAppBinding?
    private let pageCSS: String

    private var started = false
    private var disposed = false

    /// Errors raised before the Dart side has installed its method-call handler
    /// are queued, not dropped. Dart sends `ready` right after it attaches, and
    /// the queue is flushed then; a validation failure in `init` therefore still
    /// reaches the screen instead of becoming a silent blank view.
    private var dartReady = false
    private var pendingErrors: [(String, String)] = []

    init(
        frame: CGRect,
        viewId: Int64,
        args: Any?,
        messenger: FlutterBinaryMessenger,
        assets: MiniAppHostAssets
    ) {
        var validBinding: MiniAppBinding?
        var validRoot: URL?
        var validCSS = ""
        var startError: (String, String)?

        switch MiniAppOrigin.binding(from: args) {
        case let .invalid(code, message):
            startError = (code, message)
        case let .valid(candidate):
            let filesRoot = MiniAppInstallPaths.filesDirectory()
                .resolvingSymlinksInPath()
                .standardizedFileURL
            let root = MiniAppInstallPaths
                .versionDirectory(appId: candidate.appId, version: candidate.version)
                .resolvingSymlinksInPath()
                .standardizedFileURL
            var isDirectory: ObjCBool = false
            let exists = FileManager.default.fileExists(
                atPath: root.path,
                isDirectory: &isDirectory
            )
            if !exists || !isDirectory.boolValue {
                startError = (
                    MiniAppErrorCodes.packageInstallFailed,
                    "The installed version directory is missing."
                )
            } else if !root.path.hasPrefix(filesRoot.path + "/") {
                startError = (
                    MiniAppErrorCodes.packageInstallFailed,
                    "The installed version directory is missing."
                )
            } else {
                switch MiniAppBundle.pageCSS(rootDirectory: root, route: candidate.route) {
                case let .invalid(code, message):
                    startError = (code, message)
                case let .valid(css):
                    validBinding = candidate
                    validRoot = root
                    validCSS = css
                }
            }
        }

        self.binding = validBinding
        self.pageCSS = validCSS

        let schemeHandler = MiniAppSchemeHandler(
            binding: validBinding,
            rootDirectory: validRoot,
            assets: assets
        )
        self.schemeHandler = schemeHandler

        let userContentController = WKUserContentController()
        self.userContentController = userContentController

        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        configuration.allowsInlineMediaPlayback = false
        configuration.allowsPictureInPictureMediaPlayback = false
        configuration.mediaTypesRequiringUserActionForPlayback = .all
        configuration.dataDetectorTypes = []
        configuration.userContentController = userContentController
        configuration.setURLSchemeHandler(schemeHandler, forURLScheme: MiniAppOrigin.scheme)

        let webView = WKWebView(frame: frame, configuration: configuration)
        self.webView = webView
        self.channel = FlutterMethodChannel(
            name: Self.channelPrefix + String(viewId),
            binaryMessenger: messenger
        )
        self.bridgeHandler = BridgeMessageHandler()

        super.init()

        bridgeHandler.owner = self
        userContentController.add(bridgeHandler, name: Self.bridgeName)

        webView.navigationDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.allowsBackForwardNavigationGestures = false
        webView.allowsLinkPreview = false
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never

        channel.setMethodCallHandler { [weak self] call, result in
            self?.handle(call, result: result)
        }

        if let startError = startError {
            reportError(startError.0, startError.1)
        } else if let binding = validBinding {
            webView.load(URLRequest(url: binding.pageURL))
        }
    }

    deinit {
        // `userContentController` retains `bridgeHandler`, which holds `self`
        // weakly, so there is no cycle to break; the WebView is released with
        // this object when Flutter removes the platform view.
        webView.stopLoading()
        webView.navigationDelegate = nil
        userContentController.removeScriptMessageHandler(forName: Self.bridgeName)
        userContentController.removeAllUserScripts()
    }

    func view() -> UIView {
        webView
    }

    // MARK: - Flutter channel

    private func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
        switch call.method {
        case "ready":
            flushErrors()
            result(nil)
        case "send":
            guard !disposed, started else {
                result(
                    FlutterError(
                        code: MiniAppErrorCodes.bridgePageClosed,
                        message: "The page is closed.",
                        details: nil
                    )
                )
                return
            }
            guard let arguments = call.arguments as? [String: Any],
                  let message = arguments["message"] as? String,
                  message.utf8.count <= Self.maxBridgeBytes else {
                result(
                    FlutterError(
                        code: MiniAppErrorCodes.bridgeInvalidMessage,
                        message: "The message is missing or too large.",
                        details: nil
                    )
                )
                return
            }
            webView.evaluateJavaScript(
                "window.__qchatView.receive(\(jsString(message)))",
                completionHandler: nil
            )
            result(nil)
        case "destroy":
            if !disposed {
                webView.evaluateJavaScript(
                    "window.__qchatView.destroy()",
                    completionHandler: nil
                )
                started = false
            }
            result(nil)
        default:
            result(FlutterMethodNotImplemented)
        }
    }

    // MARK: - Bridge

    fileprivate func handleBridgeMessage(_ message: WKScriptMessage) {
        guard !disposed, message.name == Self.bridgeName, let binding = binding else {
            return
        }

        // A custom-scheme document has an opaque origin, so the main frame and
        // the frame URL are checked instead of an origin string. The document
        // itself can only come from the scheme handler above.
        guard message.frameInfo.isMainFrame else {
            reportError(
                MiniAppErrorCodes.bridgeOriginRejected,
                "The message did not come from the Mini App page."
            )
            return
        }
        guard let frameURL = message.frameInfo.request.url,
              MiniAppOrigin.isAppURL(frameURL, binding: binding) else {
            reportError(
                MiniAppErrorCodes.bridgeOriginRejected,
                "The message did not come from the app origin."
            )
            return
        }
        guard let current = webView.url?.absoluteString,
              current.hasPrefix(binding.baseURL.absoluteString) else {
            reportError(
                MiniAppErrorCodes.bridgeOriginRejected,
                "The document is not the installed Mini App page."
            )
            return
        }

        guard let data = message.body as? String else {
            reportError(
                MiniAppErrorCodes.bridgeInvalidMessage,
                "The bridge message must be a string."
            )
            return
        }
        guard data.utf8.count <= Self.maxBridgeBytes else {
            reportError(
                MiniAppErrorCodes.bridgeTooLarge,
                "The bridge message is too large."
            )
            return
        }

        guard let object = try? JSONSerialization.jsonObject(with: Data(data.utf8)),
              let envelope = object as? [String: Any] else {
            reportError(
                MiniAppErrorCodes.bridgeInvalidMessage,
                "The bridge message is not JSON."
            )
            return
        }
        guard let version = envelope["v"] as? Int, version == Self.bridgeVersion else {
            reportError(
                MiniAppErrorCodes.bridgeInvalidMessage,
                "The bridge version is not supported."
            )
            return
        }
        guard let kind = envelope["kind"] as? String, Self.bridgeKinds.contains(kind) else {
            reportError(
                MiniAppErrorCodes.bridgeInvalidMessage,
                "The bridge kind is unknown."
            )
            return
        }
        guard envelope["appId"] as? String == binding.appId,
              envelope["sessionId"] as? String == binding.sessionId,
              envelope["pageId"] as? String == binding.pageId else {
            reportError(
                MiniAppErrorCodes.bridgePageMismatch,
                "The message is bound to another app, session or page."
            )
            return
        }

        channel.invokeMethod("onMessage", arguments: ["message": data])
    }

    // MARK: - Start

    private func injectCSSAndStart(_ binding: MiniAppBinding) {
        let style = "(function(){" +
            "var s=document.createElement('style');" +
            "s.id='qchat-page-style';" +
            "s.textContent=\(jsString(pageCSS));" +
            "document.head.appendChild(s);" +
            "})()"
        webView.evaluateJavaScript(style, completionHandler: nil)

        let startObject: [String: String] = [
            "appId": binding.appId,
            "sessionId": binding.sessionId,
            "pageId": binding.pageId,
        ]
        guard let startData = try? JSONSerialization.data(
            withJSONObject: startObject,
            options: []
        ),
            let startJSON = String(data: startData, encoding: .utf8) else {
            reportError(
                MiniAppErrorCodes.runtimeCrash,
                "The view binding could not be encoded."
            )
            return
        }

        webView.evaluateJavaScript(
            "window.__qchatView.start(\(jsString(startJSON)))"
        ) { [weak self] result, error in
            guard let self = self, !self.disposed else { return }
            if let error = error {
                self.reportError(
                    MiniAppErrorCodes.runtimeCrash,
                    "The view did not answer start: \(error.localizedDescription)"
                )
                return
            }
            guard let raw = result as? String else {
                self.reportError(
                    MiniAppErrorCodes.runtimeCrash,
                    "The view did not answer start."
                )
                return
            }
            guard let object = try? JSONSerialization.jsonObject(with: Data(raw.utf8)),
                  let parsed = object as? [String: Any] else {
                self.reportError(
                    MiniAppErrorCodes.runtimeCrash,
                    "The view answered start with invalid JSON."
                )
                return
            }
            guard parsed["ok"] as? Bool == true else {
                let failure = parsed["error"] as? [String: Any]
                let code = (failure?["code"] as? String).flatMap {
                    $0.isEmpty ? nil : $0
                } ?? MiniAppErrorCodes.runtimeCrash
                let message = (failure?["message"] as? String).flatMap {
                    $0.isEmpty ? nil : $0
                } ?? "The view refused to start."
                self.reportError(code, message)
                return
            }
        }
    }

    // MARK: - Errors

    private func reportError(_ code: String, _ message: String) {
        guard !disposed else { return }
        guard dartReady else {
            pendingErrors.append((code, message))
            return
        }
        channel.invokeMethod(
            "onError",
            arguments: ["code": code, "message": message]
        )
    }

    private func flushErrors() {
        dartReady = true
        guard !pendingErrors.isEmpty else { return }
        let errors = pendingErrors
        pendingErrors.removeAll()
        for (code, message) in errors {
            channel.invokeMethod(
                "onError",
                arguments: ["code": code, "message": message]
            )
        }
    }

    // MARK: - JavaScript strings

    /// A JavaScript string literal for [value]. `JSONSerialization` escapes the
    /// same characters a JSON string needs, which is a subset of JavaScript's.
    private func jsString(_ value: String) -> String {
        guard let data = try? JSONSerialization.data(
            withJSONObject: [value],
            options: []
        ),
            let array = String(data: data, encoding: .utf8) else {
            return "\"\""
        }
        return String(array.dropFirst().dropLast())
    }
}

// MARK: - WKNavigationDelegate

extension MiniAppWebView: WKNavigationDelegate {
    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        if url.absoluteString == "about:blank" {
            decisionHandler(.allow)
            return
        }
        guard let binding = binding,
              MiniAppOrigin.isAppURL(url, binding: binding) else {
            // No remote document, script, image or fetch may load. The CSP
            // already says so; this is the second, native gate.
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard !disposed, !started, let binding = binding else { return }
        guard webView.url?.absoluteString == binding.pageURL.absoluteString else {
            return
        }
        started = true
        injectCSSAndStart(binding)
    }

    func webView(
        _ webView: WKWebView,
        didFail navigation: WKNavigation!,
        withError error: Error
    ) {
        reportError(
            MiniAppErrorCodes.runtimeCrash,
            "The view document failed to load: \(error.localizedDescription)"
        )
    }

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
        reportError(
            MiniAppErrorCodes.runtimeCrash,
            "The view document failed to load: \(error.localizedDescription)"
        )
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        reportError(
            MiniAppErrorCodes.runtimeCrash,
            "The WebView content process was lost."
        )
    }
}

/// Holds the owner weakly so the user content controller cannot keep the
/// platform view alive. `WKUserContentController` retains its script message
/// handlers strongly, and the platform view owns the WebView.
private final class BridgeMessageHandler: NSObject, WKScriptMessageHandler {
    weak var owner: MiniAppWebView?

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        owner?.handleBridgeMessage(message)
    }
}
