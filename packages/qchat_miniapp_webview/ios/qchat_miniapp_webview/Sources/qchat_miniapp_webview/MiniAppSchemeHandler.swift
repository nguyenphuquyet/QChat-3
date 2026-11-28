import Foundation
import WebKit

/// Serves `qchat-app://app/...` to one Mini App WKWebView.
///
/// The handler is the iOS equivalent of `WebViewAssetLoader` (ADR 011) plus the
/// host asset path. It is the only thing that can answer a request on the
/// scheme, and it answers from exactly two places:
///
/// - the installed version directory, through the view-asset allowlist;
/// - the host page and the host scripts.
///
/// A package file named `__qchat_view.html` is therefore shadowed by the host
/// document, and service code (`app.js`, page `.js`, `.wxml`, `.wxss`) is never
/// readable by page script.
final class MiniAppSchemeHandler: NSObject, WKURLSchemeHandler {
    private let binding: MiniAppBinding?
    private let rootDirectory: URL?
    private let assets: MiniAppHostAssets
    private let lock = NSLock()
    private var activeTasks: Set<ObjectIdentifier> = []

    init(binding: MiniAppBinding?, rootDirectory: URL?, assets: MiniAppHostAssets) {
        self.binding = binding
        self.rootDirectory = rootDirectory
        self.assets = assets
        super.init()
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        let identifier = ObjectIdentifier(urlSchemeTask as AnyObject)
        lock.lock()
        activeTasks.insert(identifier)
        lock.unlock()

        guard let url = urlSchemeTask.request.url,
              let binding = binding,
              let root = rootDirectory else {
            complete(
                urlSchemeTask,
                identifier: identifier,
                status: 404,
                reason: "Not Found",
                mime: "text/plain",
                body: Data("Not Found".utf8),
                cacheable: false
            )
            return
        }

        let path = url.path

        // Host-owned document. It wins over any package file with that name.
        if path == binding.basePath + MiniAppOrigin.viewPageName {
            complete(
                urlSchemeTask,
                identifier: identifier,
                status: 200,
                reason: "OK",
                mime: "text/html",
                body: Data(MiniAppHostPage.html.utf8),
                cacheable: false
            )
            return
        }

        // Host scripts: the bridge bootstrap and the two Flutter assets.
        if path.hasPrefix(MiniAppOrigin.hostAssetPrefix) {
            let name = String(path.dropFirst(MiniAppOrigin.hostAssetPrefix.count))
            if name.isEmpty || name.contains("/") || name.contains("\\") || name.contains("..") {
                completeNotFound(urlSchemeTask, identifier: identifier)
                return
            }
            if name == MiniAppHostPage.bridgeScriptName {
                complete(
                    urlSchemeTask,
                    identifier: identifier,
                    status: 200,
                    reason: "OK",
                    mime: "text/javascript",
                    body: Data(MiniAppHostPage.bridgeScript.utf8),
                    cacheable: false
                )
                return
            }
            if let body = assets.data(named: name) {
                complete(
                    urlSchemeTask,
                    identifier: identifier,
                    status: 200,
                    reason: "OK",
                    mime: MiniAppAssetPaths.mimeType(name),
                    body: body,
                    cacheable: true
                )
                return
            }
            completeNotFound(urlSchemeTask, identifier: identifier)
            return
        }

        guard path.hasPrefix(binding.basePath),
              let relative = MiniAppAssetPaths.relativePath(
                from: path,
                prefix: binding.basePath
              ),
              let file = MiniAppAssetPaths.resolve(
                rootDirectory: root,
                relative: relative
              ),
              let body = FileManager.default.contents(atPath: file.path) else {
            completeNotFound(urlSchemeTask, identifier: identifier)
            return
        }

        complete(
            urlSchemeTask,
            identifier: identifier,
            status: 200,
            reason: "OK",
            mime: MiniAppAssetPaths.mimeType(relative),
            body: body,
            cacheable: true
        )
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        let identifier = ObjectIdentifier(urlSchemeTask as AnyObject)
        lock.lock()
        activeTasks.remove(identifier)
        lock.unlock()
    }

    private func completeNotFound(
        _ task: WKURLSchemeTask,
        identifier: ObjectIdentifier
    ) {
        complete(
            task,
            identifier: identifier,
            status: 404,
            reason: "Not Found",
            mime: "text/plain",
            body: Data("Not Found".utf8),
            cacheable: false
        )
    }

    /// Reply only while WebKit still wants the answer. Calling `didFinish` after
    /// `stop` is an exception, so the task is removed from the set first.
    private func complete(
        _ task: WKURLSchemeTask,
        identifier: ObjectIdentifier,
        status: Int,
        reason: String,
        mime: String,
        body: Data,
        cacheable: Bool
    ) {
        lock.lock()
        let stillActive = activeTasks.remove(identifier) != nil
        lock.unlock()
        guard stillActive, let url = task.request.url else { return }

        guard let response = MiniAppResponses.response(
            url: url,
            status: status,
            mime: mime,
            cacheable: cacheable
        ) else {
            task.didFailWithError(
                NSError(
                    domain: "com.qchat.miniapp.webview",
                    code: status,
                    userInfo: [NSLocalizedDescriptionKey: reason]
                )
            )
            return
        }

        task.didReceive(response)
        task.didReceive(body)
        task.didFinish()
    }
}
