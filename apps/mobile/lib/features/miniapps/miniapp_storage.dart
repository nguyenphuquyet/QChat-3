import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:path/path.dart' as p;

class MiniAppStorageException implements Exception {
  const MiniAppStorageException(this.code);

  final String code;

  @override
  String toString() => code;
}

/// Per-app key/value storage with a hard quota. Values are JSON so the bridge
/// can return exactly what the page stored. Each app gets its own file; no app
/// can read another app's namespace.
class MiniAppStorage {
  MiniAppStorage._(this.file);

  static const maxValueBytes = 64 * 1024;
  static const maxTotalBytes = 512 * 1024;
  static const maxKeys = 128;

  final File file;
  Map<String, dynamic>? _data;
  Future<void> _tail = Future.value();

  static Future<MiniAppStorage> open(String root, String appId) async {
    if (!RegExp(r'^mp_[a-z0-9]{12,24}$').hasMatch(appId)) {
      throw const MiniAppStorageException('INVALID_APP_ID');
    }
    final directory = Directory(p.join(root, 'storage'));
    await directory.create(recursive: true);
    return MiniAppStorage._(File(p.join(directory.path, '$appId.json')));
  }

  Future<T> _serial<T>(Future<T> Function() action) {
    final completer = Completer<T>();
    _tail = _tail.catchError((_) {}).then((_) async {
      try {
        completer.complete(await action());
      } catch (error, stack) {
        completer.completeError(error, stack);
      }
    });
    return completer.future;
  }

  Future<Map<String, dynamic>> _load() async {
    if (_data != null) return _data!;
    if (!await file.exists()) return _data = <String, dynamic>{};
    try {
      final decoded = jsonDecode(await file.readAsString());
      if (decoded is Map) {
        return _data = decoded.map(
          (key, value) => MapEntry(key.toString(), value),
        );
      }
    } catch (_) {
      // A corrupted cache must not brick the app. Start from an empty map.
    }
    return _data = <String, dynamic>{};
  }

  Future<void> _flush() async {
    final data = _data ?? const <String, dynamic>{};
    final temporary = File('${file.path}.tmp');
    await temporary.parent.create(recursive: true);
    await temporary.writeAsString(jsonEncode(data), flush: true);
    if (await file.exists()) await file.delete();
    await temporary.rename(file.path);
  }

  int _sizeOf(Object? value) => utf8.encode(jsonEncode(value)).length;

  int _totalBytes(Map<String, dynamic> data) =>
      data.entries.fold(0, (sum, entry) => sum + _sizeOf(entry.value) + entry.key.length);

  Future<dynamic> get(String key) => _serial(() async {
    final data = await _load();
    return data[key];
  });

  Future<void> set(String key, dynamic value) => _serial(() async {
    final data = await _load();
    final valueSize = _sizeOf(value);
    if (valueSize > maxValueBytes) {
      throw const MiniAppStorageException('STORAGE_QUOTA_EXCEEDED');
    }
    if (!data.containsKey(key) && data.length >= maxKeys) {
      throw const MiniAppStorageException('STORAGE_QUOTA_EXCEEDED');
    }
    final next = Map<String, dynamic>.from(data)..[key] = value;
    if (_totalBytes(next) > maxTotalBytes) {
      throw const MiniAppStorageException('STORAGE_QUOTA_EXCEEDED');
    }
    _data = next;
    await _flush();
  });

  Future<void> remove(String key) => _serial(() async {
    final data = await _load();
    if (!data.containsKey(key)) return;
    data.remove(key);
    await _flush();
  });

  Future<void> clear() => _serial(() async {
    _data = <String, dynamic>{};
    if (await file.exists()) await file.delete();
  });
}
