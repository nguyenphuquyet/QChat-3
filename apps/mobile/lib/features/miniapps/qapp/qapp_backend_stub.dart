import 'dart:typed_data';

import 'qapp_backend_types.dart';
import 'qapp_js_runtime.dart';

QappBackend createQappBackend() => const UnsupportedQappBackend();

class UnsupportedQappBackend implements QappBackend {
  const UnsupportedQappBackend();

  @override
  Future<String> readAppJs(String directory) => Future.error(
    const QappRuntimeException(
      'RUNTIME_UNAVAILABLE',
      'Native Mini Apps are only available on the QChat mobile app',
    ),
  );

  @override
  Future<Uint8List?> readAsset(String directory, String relativePath) async =>
      null;

  @override
  QappJsRuntime createRuntime() => createQappJsRuntime();
}
