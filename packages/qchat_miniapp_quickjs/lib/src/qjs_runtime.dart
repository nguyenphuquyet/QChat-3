import 'dart:async';

import 'package:flutter/services.dart';

import 'qjs_result.dart';

/// One Service Runtime: QuickJS on Android, JavaScriptCore on iOS.
///
/// Create it with [create] and close it with [close]. The native side owns the
/// engine (`JSRuntime` on Android, `JSContext` on iOS), so a leaked Dart object
/// keeps its memory until the plugin detaches; always close a runtime when its
/// Mini App session ends.
///
/// Both platforms answer the same `qchat/miniapp/service` channel with the same
/// JSON envelope, so callers do not branch on the platform. Two documented
/// limits differ (ADR 017, ADR 019): iOS cannot enforce the memory and stack
/// limits, and a timed-out iOS runtime is discarded instead of reused.
class QjsRuntime {
  QjsRuntime._(this._id);

  static const MethodChannel _channel = MethodChannel('qchat/miniapp/service');

  /// 64 MiB, enough for the service runtime and far below a runaway script.
  static const int defaultMemoryLimitBytes = 64 * 1024 * 1024;

  /// 1 MiB of native stack for the evaluator.
  static const int defaultStackSizeBytes = 1 * 1024 * 1024;

  /// ADR 017: a page script must not block the service for longer than this.
  static const Duration defaultTimeout = Duration(milliseconds: 2000);

  final int _id;
  bool _closed = false;

  /// Start a runtime. Throws [PlatformException] when the Android native
  /// library is missing or the runtime cannot be allocated.
  ///
  /// [memoryLimitBytes] and [stackSizeBytes] are enforced on Android only:
  /// JavaScriptCore has no public ceiling, so iOS accepts and records them but
  /// cannot apply them (ADR 019).
  static Future<QjsRuntime> create({
    int memoryLimitBytes = defaultMemoryLimitBytes,
    int stackSizeBytes = defaultStackSizeBytes,
  }) async {
    final id = await _channel.invokeMethod<int>('create', <String, Object?>{
      'memoryLimitBytes': memoryLimitBytes,
      'stackSizeBytes': stackSizeBytes,
    });
    if (id == null) {
      throw StateError('The QuickJS service runtime returned no id.');
    }
    return QjsRuntime._(id);
  }

  /// Evaluate [source] as a global script and return its JSON result.
  ///
  /// [filename] is what the error stack shows. Both engines report a
  /// `TimeoutError` once [timeout] passes. Android interrupts the script and
  /// the runtime stays usable; iOS cannot interrupt JavaScriptCore, so the
  /// runtime is poisoned after a timeout, the abandoned script keeps its
  /// context alive until it returns, and later calls report `TimeoutError`
  /// instead of running. Close a timed-out runtime and create a new one.
  Future<QjsEvalResult> eval(
    String source, {
    String filename = '<eval>',
    Duration timeout = defaultTimeout,
  }) async {
    if (_closed) {
      throw StateError('The QuickJS runtime is closed.');
    }
    final json = await _channel.invokeMethod<String>('eval', <String, Object?>{
      'runtimeId': _id,
      'source': source,
      'filename': filename,
      'timeoutMs': timeout.inMilliseconds,
    });
    if (json == null) {
      throw StateError('The QuickJS service runtime returned no result.');
    }
    return QjsEvalResult.decode(json);
  }

  /// Free the native runtime. Safe to call more than once.
  ///
  /// On iOS the release is queued behind any running script, so closing a
  /// timed-out runtime returns at once and frees the context when that script
  /// finally ends.
  Future<void> close() async {
    if (_closed) return;
    _closed = true;
    await _channel.invokeMethod<void>('destroy', <String, Object?>{
      'runtimeId': _id,
    });
  }
}
