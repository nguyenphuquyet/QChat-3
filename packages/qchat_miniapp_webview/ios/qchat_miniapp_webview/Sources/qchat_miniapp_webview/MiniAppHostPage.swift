import Foundation

/// The host-owned document and the iOS bridge bootstrap.
///
/// The document is deliberately tiny: the root element, the bridge, the P0
/// component script and the view client. No inline script, so the CSP needs no
/// `'unsafe-inline'` for scripts.
///
/// On Android `addWebMessageListener` injects `window.qchatViewBridge` itself.
/// WKWebView only exposes `window.webkit.messageHandlers`, so this script
/// defines the same object over that API and the view client stays identical on
/// both platforms.
enum MiniAppHostPage {
    static let bridgeScriptName = "qchat-bridge.js"

    static let bridgeScript = """
    (function () {
      if (window.qchatViewBridge) { return; }
      var handlers = window.webkit && window.webkit.messageHandlers;
      var channel = handlers && handlers.qchatViewBridge;
      if (!channel) { return; }
      window.qchatViewBridge = {
        postMessage: function (message) { channel.postMessage(String(message)); }
      };
    })();
    """

    static let html = """
    <!doctype html>
    <html lang="en">
    <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>QChat Mini App</title>
    <script src="/qchat-host/\(bridgeScriptName)"></script>
    <script src="/qchat-host/qchat-components.js"></script>
    <script src="/qchat-host/qchat-view.js"></script>
    </head>
    <body><div id="qchat-root"></div></body>
    </html>
    """
}
