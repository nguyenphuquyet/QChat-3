import 'dart:async';

import 'package:flutter/services.dart';

import 'qjs_result.dart';

/// One Android QuickJS runtime.
///
/// Create it with [create] and close it with [close]. The native side owns the
/// `JSRuntime`, so a leaked Dart object keeps its memory until the plugin
/// detaches; always close a runtime when its Mini App session ends.
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

  /// Start a runtime. Throws [PlatformException] when the native library is
  /// missing or the runtime cannot be allocated.
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
  /// [filename] is what the error stack shows. The native runtime interrupts
  /// the script after [timeout]; the result is then a `TimeoutError`.
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
  Future<void> close() async {
    if (_closed) return;
    _closed = true;
    await _channel.invokeMethod<void>('destroy', <String, Object?>{
      'runtimeId': _id,
    });
  }
}
