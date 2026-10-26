import 'dart:io';
import 'dart:typed_data';

import 'package:path/path.dart' as p;

import 'qapp_backend_types.dart';
import 'qapp_js_runtime.dart';

QappBackend createQappBackend() => NativeQappBackend();

class NativeQappBackend implements QappBackend {
  static const _maxAppBytes = 4 * 1024 * 1024;
  static const _maxAssetBytes = 8 * 1024 * 1024;

  @override
  Future<String> readAppJs(String directory) async {
    final root = Directory(directory);
    if (!await root.exists()) {
      throw const QappRuntimeException(
        'PACKAGE_MISSING',
        'The Mini App package is not installed',
      );
    }
    final file = File(p.join(root.path, 'app.js'));
    if (!await file.exists()) {
      throw const QappRuntimeException('ENTRY_MISSING', 'app.js is missing');
    }
    final length = await file.length();
    if (length == 0) {
      throw const QappRuntimeException('ENTRY_MISSING', 'app.js is empty');
    }
    if (length > _maxAppBytes) {
      throw const QappRuntimeException(
        'ENTRY_TOO_LARGE',
        'app.js is larger than 4 MB',
      );
    }
    return file.readAsString();
  }

  @override
  Future<Uint8List?> readAsset(String directory, String relativePath) async {
    final name = relativePath.replaceAll('\\', '/');
    if (!name.startsWith('assets/') ||
        name.contains('..') ||
        name.contains('\u0000') ||
        name.contains(':')) {
      return null;
    }
    final root = p.normalize(p.absolute(directory));
    final target = p.normalize(p.joinAll([root, ...name.split('/')]));
    if (!p.isWithin(root, target)) return null;
    final file = File(target);
    if (!await file.exists()) return null;
    if (await file.length() > _maxAssetBytes) return null;
    return file.readAsBytes();
  }

  @override
  QappJsRuntime createRuntime() => createQappJsRuntime();
}
