part of 'miniapp_webview.dart';

/// The host-issued identity of one Mini App page.
///
/// [pageId] is the host allocation (`p<n>`) used by the bridge contract, not the
/// route. [route] names the compiled page in `build/view.json`; the Android host
/// reads that page's CSS and serves it with the installed version.
@immutable
class MiniAppWebViewRequest {
  const MiniAppWebViewRequest({
    required this.appId,
    required this.version,
    required this.route,
    required this.sessionId,
    required this.pageId,
  });

  /// Manifest app id, e.g. `com.example.hello`.
  final String appId;

  /// Installed semantic version, e.g. `1.0.0`.
  final String version;

  /// Page route, e.g. `pages/index/index`.
  final String route;

  /// Host session id.
  final String sessionId;

  /// Host page id (`p1`, `p2`, ...).
  final String pageId;

  Map<String, Object?> toMap() => <String, Object?>{
        'appId': appId,
        'version': version,
        'route': route,
        'sessionId': sessionId,
        'pageId': pageId,
      };

  @override
  bool operator ==(Object other) =>
      other is MiniAppWebViewRequest &&
      other.appId == appId &&
      other.version == version &&
      other.route == route &&
      other.sessionId == sessionId &&
      other.pageId == pageId;

  @override
  int get hashCode => Object.hash(appId, version, route, sessionId, pageId);

  @override
  String toString() =>
      'MiniAppWebViewRequest($appId@$version $route session=$sessionId page=$pageId)';
}

/// Sends host messages to the page and tears it down.
///
/// One controller belongs to one [MiniAppWebView]. It is attached when the
/// platform view is created; a call before that is a programming error.
class MiniAppWebViewController {
  MethodChannel? _channel;
  bool _disposed = false;

  /// True once the platform view exists and the channel is open.
  bool get isAttached => _channel != null;

  /// Send one `view.render` / `view.theme` / `view.destroy` bridge event.
  ///
  /// [messageJson] is the JSON of a `BridgeEvent` from the shared contract. The
  /// host checks the size and binding before it reaches the page.
  Future<void> send(String messageJson) async {
    final channel = _channel;
    if (_disposed) throw StateError('The Mini App WebView controller is disposed.');
    if (channel == null) {
      throw StateError('The Mini App WebView is not attached yet.');
    }
    await channel.invokeMethod<void>('send', <String, Object?>{
      'message': messageJson,
    });
  }

  /// Ask the page to remove its tree and close.
  Future<void> destroy() async {
    final channel = _channel;
    if (channel == null) return;
    await channel.invokeMethod<void>('destroy');
  }

  void _attach(MethodChannel channel) {
    if (_disposed) {
      throw StateError('The Mini App WebView controller is disposed.');
    }
    _channel = channel;
  }

  void _detach() {
    _channel = null;
  }

  /// Called by [MiniAppWebView] when the widget leaves the tree.
  void dispose() {
    _disposed = true;
    _channel = null;
  }
}
