import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../core/design_system/components.dart';
import 'miniapp_bridge.dart';

/// Imperative handle the runtime screen keeps for back, reload and lifecycle
/// events. The widget owns the platform controller; this object only forwards.
class MiniAppWebViewController {
  _MiniAppWebViewState? _state;

  void _attach(_MiniAppWebViewState state) => _state = state;

  void _detach(_MiniAppWebViewState state) {
    if (identical(_state, state)) _state = null;
  }

  Future<bool> back() async => await _state?.back() ?? false;

  void reload() => _state?.reload();

  void lifecycle(String event) => _state?.lifecycle(event);

  void evaluate(String script) => _state?.evaluate(script);
}

/// Hosts a verified Mini App in a WebView.
///
/// The page is served by [MiniAppWebServer] on loopback; this widget installs
/// the `QChatHost` channel, injects the safe-area values the package can read
/// from CSS, and forwards every bridge call to [MiniAppBridge]. No file URL is
/// loaded and navigation outside the loopback origin is refused.
class MiniAppWebView extends StatefulWidget {
  const MiniAppWebView({
    super.key,
    required this.entryUrl,
    required this.origin,
    required this.bridge,
    required this.systemInfo,
    required this.onReady,
    required this.onError,
    this.controller,
  });

  final String entryUrl;
  final String origin;
  final MiniAppBridge bridge;
  final Map<String, dynamic> Function() systemInfo;
  final VoidCallback onReady;
  final void Function(String code, String message) onError;
  final MiniAppWebViewController? controller;

  @override
  State<MiniAppWebView> createState() => _MiniAppWebViewState();
}

class _MiniAppWebViewState extends State<MiniAppWebView> {
  late final WebViewController _web;
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    widget.controller?._attach(this);
    _web = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(QChatColors.white)
      ..addJavaScriptChannel('QChatHost', onMessageReceived: _onMessage)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (_) => _pageFinished(),
          onWebResourceError: (error) {
            if (error.isForMainFrame == false) return;
            widget.onError('PAGE_LOAD_FAILED', error.description);
          },
          onHttpError: (error) {
            final status = error.response?.statusCode ?? 0;
            if (status >= 400) {
              widget.onError('PAGE_HTTP_$status', error.request?.uri.toString() ?? '');
            }
          },
          onNavigationRequest: (request) {
            final url = request.url;
            if (url == 'about:blank' || url.startsWith(widget.origin)) {
              return NavigationDecision.navigate;
            }
            // A package cannot open another origin, a data: URL or a custom
            // scheme from inside the frame. External links are a host API.
            return NavigationDecision.prevent;
          },
        ),
      )
      ..loadRequest(Uri.parse(widget.entryUrl));
  }

  @override
  void dispose() {
    widget.controller?._detach(this);
    super.dispose();
  }

  Future<void> _pageFinished() async {
    await _applySystemInfo();
    if (!_ready) {
      _ready = true;
      widget.onReady();
    }
  }

  Future<void> _applySystemInfo() async {
    final info = widget.systemInfo();
    final top = info['safeAreaTop'] ?? 0;
    final bottom = info['safeAreaBottom'] ?? 0;
    final theme = info['theme'] ?? 'light';
    final js =
        "document.documentElement.style.setProperty('--qchat-safe-top', '${top}px');"
        "document.documentElement.style.setProperty('--qchat-safe-bottom', '${bottom}px');"
        "document.documentElement.dataset.qchatTheme = '$theme';";
    await evaluate(js);
  }

  Future<void> _onMessage(JavaScriptMessage message) async {
    final id = _idOf(message.message);
    if (id == null) return;
    Object? params;
    String method;
    try {
      final decoded = jsonDecode(message.message);
      if (decoded is! Map) return;
      method = decoded['method']?.toString() ?? '';
      params = decoded['params'];
    } catch (_) {
      await _resolve(id, const MiniAppHostResponse.error(
        'INVALID_REQUEST',
        'The host received malformed JSON',
      ));
      return;
    }
    final response = await widget.bridge.execute(method, params);
    await _resolve(id, response);
  }

  int? _idOf(String raw) {
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map && decoded['id'] is num) {
        return (decoded['id'] as num).toInt();
      }
    } catch (_) {}
    return null;
  }

  Future<void> _resolve(int id, MiniAppHostResponse response) async {
    final payload = jsonEncode(jsonEncode(response.toJson()));
    await evaluate('window.__qchatResolve($id, $payload);');
  }

  Future<void> evaluate(String script) async {
    try {
      await _web.runJavaScript(script);
    } catch (_) {
      // The page may be gone while a permission dialog is open.
    }
  }

  Future<bool> back() async {
    if (await _web.canGoBack()) {
      await _web.goBack();
      return true;
    }
    return false;
  }

  void reload() {
    _ready = false;
    unawaited(_web.reload());
  }

  void lifecycle(String event) {
    final payload = jsonEncode(jsonEncode({'state': event}));
    unawaited(evaluate("window.__qchatEmit('lifecycle', $payload);"));
  }

  @override
  Widget build(BuildContext context) {
    final bottom = defaultTargetPlatform == TargetPlatform.iOS
        ? MediaQuery.viewInsetsOf(context).bottom
        : 0.0;
    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: WebViewWidget(controller: _web),
    );
  }
}
