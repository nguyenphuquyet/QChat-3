/// Android system WebView host for QChat Mini Apps.
///
/// This library is the Flutter seam of ADR 011 §3 and ADR 012: one
/// [MiniAppWebView] per page, bound to one app/session/page triple. The page
/// runs on the app-private origin; the service runtime stays outside the WebView
/// and exchanges bridge messages through [MiniAppWebViewController].
library;

export 'src/miniapp_webview.dart';
