import 'package:flutter/services.dart';

/// Paths the Android host and the Dart installer must agree on.
///
/// The host derives the installed directory from its own `filesDir`, so Dart
/// asks it for the path instead of rebuilding the layout: a mismatch here would
/// install a package the WebView can never find.
class MiniAppInstallPaths {
  MiniAppInstallPaths._();

  static const MethodChannel _channel = MethodChannel(
    'qchat/miniapp/installer',
  );

  /// The installed version directory for [appId] and [version].
  ///
  /// The directory may not exist yet; the installer creates it. The host
  /// re-validates both ids and refuses an invalid pair with
  /// `BRIDGE_INVALID_MESSAGE`.
  static Future<String> versionDir({
    required String appId,
    required String version,
  }) async {
    final path = await _channel.invokeMethod<String>('versionDir', <String, Object?>{
      'appId': appId,
      'version': version,
    });
    if (path == null || path.isEmpty) {
      throw StateError('The Mini App installer returned no version directory.');
    }
    return path;
  }
}
