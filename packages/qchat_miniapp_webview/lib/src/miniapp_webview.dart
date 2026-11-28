import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

part 'miniapp_webview_controller.dart';

/// Receives one bridge event from the page as raw JSON.
typedef MiniAppWebViewMessage = void Function(String messageJson);

/// Receives a host rejection or a fatal WebView error.
typedef MiniAppWebViewError = void Function(String code, String message);

/// The Android system WebView that draws one Mini App page.
///
/// The page is served from
/// `https://appassets.androidplatform.net/qchat/<appId>/<version>/` and talks to
/// the host through the origin-bound `qchatViewBridge` listener. The widget
/// never renders Mini App content itself and never falls back to another engine.
///
/// iOS is M8; building this widget on another platform is a programming error,
/// not a silent fallback.
class MiniAppWebView extends StatefulWidget {
  const MiniAppWebView({
    super.key,
    required this.request,
    this.controller,
    this.onMessage,
    this.onError,
  });

  /// The platform view type registered by the Android plugin.
  static const String viewType = 'qchat/miniapp/webview';

  final MiniAppWebViewRequest request;
  final MiniAppWebViewController? controller;
  final MiniAppWebViewMessage? onMessage;
  final MiniAppWebViewError? onError;

  @override
  State<MiniAppWebView> createState() => _MiniAppWebViewState();
}

class _MiniAppWebViewState extends State<MiniAppWebView> {
  MethodChannel? _channel;

  @override
  void didUpdateWidget(MiniAppWebView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller?._detach();
      final channel = _channel;
      if (channel != null) widget.controller?._attach(channel);
    }
  }

  @override
  void dispose() {
    _channel?.setMethodCallHandler(null);
    widget.controller?._detach();
    super.dispose();
  }

  void _onPlatformViewCreated(int id) {
    final channel = MethodChannel('qchat/miniapp/$id');
    channel.setMethodCallHandler(_handleCall);
    _channel = channel;
    widget.controller?._attach(channel);
    // The host queues any error raised while it was being created; this call
    // releases the queue now that the handler above is installed.
    channel.invokeMethod<void>('ready').catchError((Object _) {
      // The platform view is already gone; nothing is left to flush.
    });
  }

  Future<Object?> _handleCall(MethodCall call) async {
    switch (call.method) {
      case 'onMessage':
        final arguments = call.arguments;
        if (arguments is Map && arguments['message'] is String) {
          widget.onMessage?.call(arguments['message'] as String);
        }
        return null;
      case 'onError':
        final arguments = call.arguments;
        final code = arguments is Map && arguments['code'] is String
            ? arguments['code'] as String
            : 'RUNTIME_CRASH';
        final message = arguments is Map && arguments['message'] is String
            ? arguments['message'] as String
            : 'The Mini App WebView failed.';
        widget.onError?.call(code, message);
        return null;
      default:
        throw MissingPluginException(
          'Unknown Mini App WebView method ${call.method}.',
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (defaultTargetPlatform != TargetPlatform.android) {
      throw UnsupportedError(
        'MiniAppWebView is implemented on Android only; the iOS host lands in M8.',
      );
    }
    return AndroidView(
      key: ValueKey<MiniAppWebViewRequest>(widget.request),
      viewType: MiniAppWebView.viewType,
      creationParams: widget.request.toMap(),
      creationParamsCodec: const StandardMessageCodec(),
      onPlatformViewCreated: _onPlatformViewCreated,
    );
  }
}
