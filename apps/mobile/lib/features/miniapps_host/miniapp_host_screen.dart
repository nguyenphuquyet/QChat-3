import 'dart:convert';

import 'package:flutter/widgets.dart';
import 'package:qchat_miniapp_webview/qchat_miniapp_webview.dart';

import '../../core/design_system/components.dart';
import '../../core/localization/strings.dart';

/// One Mini App page, drawn by the Android system WebView (ADR 011/012).
///
/// The screen owns the bridge binding, the loading and error surfaces and the
/// teardown. It never renders Mini App content itself: the page tree arrives as
/// a `view.render` bridge event from the service runtime.
///
/// The page host is implemented on Android and iOS (ADR 011/018); the platform
/// view itself is selected by `MiniAppWebView`. Building on another platform is
/// an error, not a silent fallback.
class MiniAppHostScreen extends StatefulWidget {
  const MiniAppHostScreen({
    super.key,
    required this.appId,
    required this.version,
    required this.route,
    required this.sessionId,
    required this.pageId,
    required this.title,
    this.onReady,
    this.onEvent,
  });

  /// Manifest app id, e.g. `com.example.hello`.
  final String appId;

  /// Installed semantic version.
  final String version;

  /// Page route in `build/view.json`, e.g. `pages/index/index`.
  final String route;

  /// Host session id; the app allocates it, never the page.
  final String sessionId;

  /// Host page id (`p1`, `p2`, ...).
  final String pageId;

  /// Title shown in the QChat app bar.
  final String title;

  /// Called once the page announced `view.ready`.
  final Future<void> Function(MiniAppWebViewController controller)? onReady;

  /// Every bridge event the page sends, in arrival order.
  final void Function(String event, Map<String, Object?> payload)? onEvent;

  @override
  State<MiniAppHostScreen> createState() => _MiniAppHostScreenState();
}

class _MiniAppHostScreenState extends State<MiniAppHostScreen> {
  final MiniAppWebViewController _controller = MiniAppWebViewController();
  bool _ready = false;
  String? _errorCode;
  String? _errorMessage;

  MiniAppWebViewRequest get _request => MiniAppWebViewRequest(
    appId: widget.appId,
    version: widget.version,
    route: widget.route,
    sessionId: widget.sessionId,
    pageId: widget.pageId,
  );

  @override
  void dispose() {
    // The platform view may already be gone; teardown must never throw here.
    _controller.destroy().catchError((Object _) {});
    _controller.dispose();
    super.dispose();
  }

  void _onMessage(String messageJson) {
    final Object? decoded;
    try {
      decoded = jsonDecode(messageJson);
    } catch (_) {
      return;
    }
    if (decoded is! Map<String, Object?>) return;
    final event = decoded['event'];
    if (event is! String) return;
    final payload = decoded['payload'];
    final map = payload is Map<String, Object?>
        ? payload
        : const <String, Object?>{};

    widget.onEvent?.call(event, map);
    switch (event) {
      case 'view.ready':
        if (_ready) return;
        setState(() => _ready = true);
        final onReady = widget.onReady;
        if (onReady == null) return;
        onReady(_controller).catchError((Object error) {
          _showError('RUNTIME_CRASH', 'The service runtime failed: $error');
        });
      case 'view.error':
        final code = map['code'];
        final message = map['message'];
        _showError(
          code is String ? code : 'RUNTIME_CRASH',
          message is String ? message : 'The page rejected a message.',
        );
    }
  }

  void _showError(String code, String message) {
    if (!mounted) return;
    setState(() {
      _errorCode = code;
      _errorMessage = message;
    });
  }

  void _close() {
    final navigator = Navigator.of(context);
    if (navigator.canPop()) navigator.pop();
  }

  @override
  Widget build(BuildContext context) {
    final background = qchatBackground(context);
    return QChatPage(
      title: widget.title,
      leading: QChatIconButton(
        'back',
        label: tr(context, 'back'),
        onTap: _close,
      ),
      child: Stack(
        fit: StackFit.expand,
        children: [
          ColoredBox(
            color: background,
            child: MiniAppWebView(
              request: _request,
              controller: _controller,
              onMessage: _onMessage,
              onError: _showError,
            ),
          ),
          if (_errorCode != null)
            _HostError(
              code: _errorCode!,
              message: _errorMessage!,
              background: background,
              onClose: _close,
            )
          else if (!_ready)
            ColoredBox(
              color: background,
              child: Center(
                child: QChatLoading(label: tr(context, 'miniappHostStarting')),
              ),
            ),
        ],
      ),
    );
  }
}

/// A host or page failure, shown with the real code instead of a generic
/// message: it is the only diagnostic a release build can give a support
/// request.
class _HostError extends StatelessWidget {
  const _HostError({
    required this.code,
    required this.message,
    required this.background,
    required this.onClose,
  });

  final String code;
  final String message;
  final Color background;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: background,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                tr(context, 'miniappHostError'),
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w600,
                  color: qchatInk(context),
                ),
              ),
              const SizedBox(height: 10),
              Text(
                code,
                style: TextStyle(fontSize: 13, color: qchatMuted(context)),
              ),
              const SizedBox(height: 6),
              Text(
                message,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  height: 1.4,
                  color: qchatMuted(context),
                ),
              ),
              const SizedBox(height: 22),
              QChatButton(tr(context, 'close'), onTap: onClose),
            ],
          ),
        ),
      ),
    );
  }
}
