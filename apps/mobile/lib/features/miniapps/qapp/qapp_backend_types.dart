import 'dart:typed_data';

import 'qapp_js_types.dart';

/// Reads the compiled bundle and its assets from the verified cache directory.
///
/// Implementations must never accept a path that escapes the package
/// directory. The web build gets a stub because native Mini Apps need a
/// JavaScript engine that only ships with the mobile app.
abstract class QappBackend {
  Future<String> readAppJs(String directory);

  Future<Uint8List?> readAsset(String directory, String relativePath);

  QappJsRuntime createRuntime();
}
