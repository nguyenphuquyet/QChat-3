import 'dart:async';
import 'dart:convert';

import 'package:flutter_js/flutter_js.dart';

import 'qapp_js_types.dart';

QappJsRuntime createQappJsRuntime() => FlutterJsQappRuntime();

/// QuickJS (Android/Windows/Linux) and JavaScriptCore (iOS/macOS) runtime.
///
/// The compiled bundle talks to Flutter through two JSON-only globals:
///
/// * `globalThis.__qchatNative.send(kind, payload)` for render frames and logs.
/// * `globalThis.__qchatNative.call(method, params)` which returns a Promise
///   resolved by `globalThis.__qchatResolve(id, json)` after Flutter replies.
/// * `globalThis.__qchatNative.send("timer", { delayMs })` for the JavaScript
///   timer queue, answered by calling `globalThis.__qchatTickTimers(nowMs)`.
///   A negative `delayMs` cancels the pending wake.
///
/// XHR/fetch are disabled when the engine is created, so network access is only
/// possible through the permission-checked native bridge.
class FlutterJsQappRuntime implements QappJsRuntime {
  JavascriptRuntime? _runtime;
  QappJsHost? _host;
  bool _disposed = false;
  static const _channel = 'qchat';
  Timer? _wakeTimer;
  int? _wakeDelayMs;
  DateTime? _wakeDueAt;
  bool _ticksPaused = false;

  @override
  Future<void> start({required String appJs, required QappJsHost host}) async {
    if (_disposed) {
      throw const QappRuntimeException('RUNTIME_DISPOSED', 'Runtime is closed');
    }
    _host = host;
    final runtime = getJavascriptRuntime(
      xhr: false,
      extraArgs: const {'stackSize': 1024 * 1024},
    );
    _runtime = runtime;
    runtime.onMessage(_channel, _onChannelMessage);

    final bootstrap = runtime.evaluate(
      _bootstrap,
      sourceUrl: 'qchat://bootstrap.js',
    );
    if (bootstrap.isError) {
      throw QappRuntimeException('RUNTIME_ERROR', bootstrap.stringResult);
    }
    final result = runtime.evaluate(appJs, sourceUrl: 'qapp://app.js');
    if (result.isError) {
      throw QappRuntimeException('RUNTIME_ERROR', result.stringResult);
    }
    _pump();
  }

  @override
  void dispatch(String nodeId, String event, Object? payload) {
    Object? encoded;
    try {
      encoded = json.decode(jsonEncode(payload));
    } catch (_) {
      encoded = null;
    }
    _evaluate(
      'globalThis.__qchatDispatch && '
      'globalThis.__qchatDispatch(${jsonEncode(nodeId)}, ${jsonEncode(event)}, '
      '${jsonEncode(encoded)});',
    );
  }

  @override
  void lifecycle(String event, [Object? payload]) {
    final encoded = _encodePayload(payload);
    _evaluate(
      'globalThis.__qchatLifecycle && '
      'globalThis.__qchatLifecycle(${jsonEncode(event)}, ${jsonEncode(encoded)});',
    );
  }

  Object? _encodePayload(Object? payload) {
    if (payload == null) return null;
    try {
      return json.decode(jsonEncode(payload));
    } catch (_) {
      return null;
    }
  }

  @override
  void dispose() {
    if (_disposed) return;
    _disposed = true;
    _host = null;
    final runtime = _runtime;
    _runtime = null;
    _wakeTimer?.cancel();
    _wakeTimer = null;
    _wakeDelayMs = null;
    _wakeDueAt = null;
    try {
      runtime?.dispose();
    } catch (_) {
      // The engine may already be gone when the screen is torn down during a
      // crash; there is nothing useful left to report.
    }
  }

  void _onChannelMessage(dynamic args) {
    if (_disposed || args is! Map) return;
    final message = Map<String, dynamic>.from(args);
    final type = message['t']?.toString();
    if (type == 'send') {
      final kind = message['kind']?.toString() ?? '';
      final payload = message['payload'];
      // Never call into Flutter synchronously from inside the FFI callback:
      // schedule the host notification so a setState or a bridge call cannot
      // re-enter the JavaScript engine while it is still executing.
      scheduleMicrotask(() {
        if (_disposed) return;
        switch (kind) {
          case 'render':
            if (payload is Map) {
              _host?.onRender(Map<String, dynamic>.from(payload));
            }
            break;
          case 'ready':
            _host?.onReady(
              payload is Map ? Map<String, dynamic>.from(payload) : null,
            );
            break;
          case 'log':
            if (payload is Map) {
              _host?.onLog(
                payload['level']?.toString() ?? 'log',
                payload['message']?.toString() ?? '',
                payload['stack']?.toString(),
              );
            }
            break;
          case 'timer':
            // The JavaScript side keeps its own timer queue and asks the host
            // when to run the next callback. A negative delay cancels the
            // pending wake.
            if (payload is Map) {
              final delay = payload['delayMs'];
              _scheduleWake(delay is num ? delay.toInt() : -1);
            }
            break;
          case 'lifecycle':
            if (payload is Map) {
              final event = payload['event']?.toString();
              if (event != null && event.isNotEmpty) {
                _host?.onLifecycle(event);
              }
            }
            break;
        }
      });
      return;
    }
    if (type != 'call') return;
    final id = message['id']?.toString();
    final method = message['method']?.toString();
    if (id == null || id.isEmpty || method == null || method.isEmpty) return;
    final rawParams = message['params'];
    final params = rawParams is Map
        ? Map<String, dynamic>.from(rawParams)
        : const <String, dynamic>{};
    scheduleMicrotask(() async {
      if (_disposed) return;
      QappHostResponse response;
      try {
        final host = _host;
        response = host == null
            ? const QappHostResponse.error(
                'BRIDGE_UNAVAILABLE',
                'QChat host is not available',
              )
            : await host.call(method, params);
      } catch (error) {
        response = QappHostResponse.error('HOST_ERROR', error.toString());
      }
      if (_disposed) return;
      _resolve(id, response);
    });
  }

  void _resolve(String id, QappHostResponse response) {
    final payload = jsonEncode(response.toJson());
    _evaluate(
      'globalThis.__qchatResolve && '
      'globalThis.__qchatResolve(${jsonEncode(id)}, ${jsonEncode(payload)});',
    );
  }

  void _evaluate(String code) {
    final runtime = _runtime;
    if (_disposed || runtime == null) return;
    try {
      final result = runtime.evaluate(code);
      if (result.isError) {
        _host?.onLog('error', result.stringResult, null);
      }
      _pump();
    } catch (error) {
      _host?.onLog('error', error.toString(), null);
    }
  }

  /// `setTimeout`/`setInterval`/`requestAnimationFrame` live in the JavaScript
  /// timer queue, which has no clock of its own: it asks the host for a wake-up
  /// delay and expects the engine to be ticked with the current time. A
  /// negative delay means no timer is pending any more, so the wake is dropped.
  ///
  /// While the host is painting a gesture ([pauseTicks]) the delay is only
  /// remembered: running a callback then would render a new frame on the UI
  /// thread in the middle of the animation.
  void _scheduleWake(int delayMs) {
    _wakeTimer?.cancel();
    _wakeTimer = null;
    if (_disposed || delayMs < 0) {
      _wakeDelayMs = null;
      _wakeDueAt = null;
      return;
    }
    _wakeDelayMs = delayMs;
    _wakeDueAt = DateTime.now().add(Duration(milliseconds: delayMs));
    if (_ticksPaused) return;
    _startWake(delayMs);
  }

  void _startWake(int delayMs) {
    _wakeTimer?.cancel();
    _wakeTimer = Timer(Duration(milliseconds: delayMs), _tickTimers);
  }

  void _tickTimers() {
    _wakeTimer = null;
    if (_disposed) return;
    if (_ticksPaused) {
      // Paused between the timer firing and this callback running: keep the
      // delay so `resumeTicks` can run the tick straight away.
      return;
    }
    _wakeDelayMs = null;
    _wakeDueAt = null;
    final now = DateTime.now().millisecondsSinceEpoch;
    _evaluate(
      'globalThis.__qchatTickTimers && globalThis.__qchatTickTimers($now);',
    );
  }

  @override
  void pauseTicks() {
    if (_disposed || _ticksPaused) return;
    _ticksPaused = true;
    _wakeTimer?.cancel();
    _wakeTimer = null;
  }

  @override
  void resumeTicks() {
    if (_disposed || !_ticksPaused) return;
    _ticksPaused = false;
    final delay = _wakeDelayMs;
    final dueAt = _wakeDueAt;
    if (delay == null || dueAt == null) return;
    // Keep the timer's own schedule: a callback that was due 800ms into the
    // gesture still fires 200ms from now when the tick had 1000ms to go.
    final remaining = dueAt.difference(DateTime.now()).inMilliseconds;
    _startWake(remaining < 0 ? 0 : remaining);
  }

  void _pump() {
    final runtime = _runtime;
    if (_disposed || runtime == null) return;
    try {
      runtime.executePendingJob();
    } catch (error) {
      _host?.onLog('error', error.toString(), null);
    }
  }

  static const _bootstrap = r'''
(function () {
  if (globalThis.__qchatNativeInstalled) return;
  globalThis.__qchatNativeInstalled = true;
  var pending = {};
  var sequence = 0;

  globalThis.__qchatResolve = function (id, json) {
    var resolve = pending[id];
    if (typeof resolve !== 'function') return;
    delete pending[id];
    var value;
    try {
      value = JSON.parse(json);
    } catch (error) {
      value = { ok: false, error: { code: 'HOST_ERROR', message: 'Invalid host response' } };
    }
    resolve(value);
  };

  globalThis.__qchatNative = {
    send: function (kind, payload) {
      try {
        sendMessage('qchat', JSON.stringify({
          t: 'send',
          kind: String(kind),
          payload: payload === undefined ? null : payload
        }));
      } catch (error) {
        // A render frame must never crash the app.
      }
    },
    call: function (method, params) {
      return new Promise(function (resolve) {
        var id = 'q' + (++sequence);
        pending[id] = resolve;
        try {
          sendMessage('qchat', JSON.stringify({
            t: 'call',
            id: id,
            method: String(method),
            params: params || {}
          }));
        } catch (error) {
          delete pending[id];
          resolve({ ok: false, error: { code: 'BRIDGE_UNAVAILABLE', message: 'Host bridge is not available' } });
        }
      });
    }
  };
})();
''';
}
