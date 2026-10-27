import 'dart:async';

/// Request/response result exchanged between QuickJS and the Flutter host.
class QappHostResponse {
  const QappHostResponse.ok(this.result)
    : ok = true,
      code = null,
      message = null;

  const QappHostResponse.error(this.code, this.message)
    : ok = false,
      result = null;

  final bool ok;
  final Object? result;
  final String? code;
  final String? message;

  Map<String, dynamic> toJson() => ok
      ? {'ok': true, 'result': result}
      : {
          'ok': false,
          'error': {'code': code ?? 'HOST_ERROR', 'message': message ?? ''},
        };

  factory QappHostResponse.fromJson(Map<String, dynamic> json) {
    if (json['ok'] == true) return QappHostResponse.ok(json['result']);
    final error = json['error'];
    if (error is Map) {
      return QappHostResponse.error(
        error['code']?.toString() ?? 'HOST_ERROR',
        error['message']?.toString() ?? '',
      );
    }
    return const QappHostResponse.error('HOST_ERROR', 'Invalid host response');
  }
}

class QappRuntimeException implements Exception {
  const QappRuntimeException(this.code, this.message);

  final String code;
  final String message;

  @override
  String toString() => '$code: $message';
}

/// The interface the JavaScript runtime uses to talk to Flutter.
abstract class QappJsHost {
  void onRender(Map<String, dynamic> payload);
  void onReady(Map<String, dynamic>? payload);
  void onLog(String level, String message, String? stack);
  void onLifecycle(String event);
  Future<QappHostResponse> call(String method, Map<String, dynamic> params);
}

/// A sandboxed JavaScript engine that executes one compiled Mini App bundle.
abstract class QappJsRuntime {
  Future<void> start({required String appJs, required QappJsHost host});

  void dispatch(String nodeId, String event, Object? payload);

  /// Delivers a host lifecycle event (`resume`, `pause`, `navigate`, `back`).
  void lifecycle(String event, [Object? payload]);

  /// Stops running `setTimeout`/`setInterval` callbacks until [resumeTicks].
  ///
  /// The engine executes JavaScript on the Flutter UI thread, so a timer that
  /// fires while the user is dragging or flinging the content renders a whole
  /// new frame in the middle of the animation: that is the single hitch that is
  /// felt while scrolling. The host pauses the timer queue for the duration of
  /// the gesture and the pending delay is resumed afterwards.
  void pauseTicks();

  /// Resumes the timer queue paused by [pauseTicks].
  void resumeTicks();

  void dispose();
}
