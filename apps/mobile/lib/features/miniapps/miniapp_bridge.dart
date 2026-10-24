import 'dart:async';
import 'dart:convert';
import 'dart:ui' as ui;

import 'package:image_picker/image_picker.dart';
import 'package:path/path.dart' as p;

import 'miniapp_api.dart';
import 'miniapp_storage.dart';

class MiniAppBridgeException implements Exception {
  const MiniAppBridgeException(this.code, this.message);

  final String code;
  final String message;

  @override
  String toString() => '$code: $message';
}

/// Validates and executes calls from the Mini App page.
///
/// The page can only send JSON through the `QChatNative` JavaScript channel.
/// Every request is checked here: id format, duplicate ids, method allowlist,
/// parameter schema, declared permission, per-method rate limit and host-side
/// timeout. Privileged work (profile, media, QChat API, storage) happens in
/// Flutter; the page never receives a QChat access token.
class MiniAppBridge {
  MiniAppBridge({
    required this.appId,
    required this.appName,
    required this.version,
    required this.entry,
    required this.runtimeVersion,
    required this.minRuntimeVersion,
    required this.permissions,
    required this.api,
    required this.storage,
    required this.requestPermission,
    required this.onToast,
    required this.onShare,
    required this.onNavigate,
    required this.onClose,
    required this.onResponse,
    required this.systemInfo,
    Set<String> granted = const {},
  }) : _granted = {...granted};

  final String appId;
  final String appName;
  final String version;
  final String entry;
  final String runtimeVersion;
  final String minRuntimeVersion;
  final List<String> permissions;
  final MiniAppApi api;
  final MiniAppStorage storage;

  /// Asks the user (once per app) and persists the answer.
  final Future<bool> Function(String permission) requestPermission;
  final void Function(String message, String icon) onToast;
  final Future<bool> Function(String text, String url, String title) onShare;
  final Future<void> Function(String path) onNavigate;
  final void Function() onClose;
  final void Function(String payload) onResponse;
  final Map<String, dynamic> Function() systemInfo;

  final Set<String> _granted;
  final Set<String> _inflight = {};
  final List<DateTime> _recent = [];
  final Map<String, int> _methodCounts = {};
  DateTime _methodWindow = DateTime.now();
  bool _closed = false;

  static const _maxMessageBytes = 160 * 1024;
  static const _maxBodyBytes = 32 * 1024;
  static const _maxInflight = 20;
  static const _maxCallsPerWindow = 60;
  static const _window = Duration(seconds: 10);
  static const _maxImageBytes = 5 * 1024 * 1024;
  static final _idPattern = RegExp(r'^[A-Za-z0-9_-]{1,80}$');
  static final _storageKey = RegExp(r'^[A-Za-z0-9._-]{1,64}$');
  static final _apiPaths = {'/users/me', '/friends', '/conversations'};
  static const _methods = {
    'getAppInfo',
    'getUserInfo',
    'showToast',
    'chooseImage',
    'share',
    'navigateTo',
    'closeMiniApp',
    'request',
    'getStorage',
    'setStorage',
    'removeStorage',
    'getSystemInfo',
  };

  Set<String> get granted => Set.unmodifiable(_granted);

  void dispose() {
    _closed = true;
    _inflight.clear();
    _recent.clear();
  }

  /// Entry point for the JavaScript channel. Never throws.
  Future<void> handle(String raw) async {
    if (_closed || raw.length > _maxMessageBytes) return;
    Object? decoded;
    try {
      decoded = jsonDecode(raw);
    } catch (_) {
      return;
    }
    if (decoded is! Map) return;
    final id = decoded['id'];
    final method = decoded['method'];
    if (id is! String || !_idPattern.hasMatch(id) || method is! String) return;
    if (_inflight.contains(id) || _inflight.length >= _maxInflight) return;
    if (!_methods.contains(method)) {
      _fail(id, 'NOT_SUPPORTED', 'Unknown method');
      return;
    }
    if (!_allowCall(method)) {
      _fail(id, 'RATE_LIMITED', 'Too many calls, slow down');
      return;
    }
    _inflight.add(id);
    final params = decoded['params'];
    final timeout = method == 'chooseImage'
        ? const Duration(seconds: 60)
        : method == 'request'
        ? const Duration(seconds: 20)
        : const Duration(seconds: 10);
    try {
      final result = await _dispatch(method, params).timeout(timeout);
      _reply(id, result);
    } on TimeoutException {
      _fail(id, 'TIMEOUT', '$method timed out');
    } on MiniAppBridgeException catch (error) {
      _fail(id, error.code, error.message);
    } on MiniAppStorageException catch (error) {
      _fail(
        id,
        error.code,
        error.code == 'STORAGE_QUOTA_EXCEEDED'
            ? 'Mini App storage quota exceeded'
            : 'Storage is unavailable',
      );
    } catch (_) {
      _fail(id, 'HOST_ERROR', 'The QChat host could not complete this call');
    } finally {
      _inflight.remove(id);
    }
  }

  bool _allowCall(String method) {
    final now = DateTime.now();
    if (now.difference(_methodWindow) > _window) {
      _methodWindow = now;
      _methodCounts.clear();
      _recent.clear();
    }
    _recent.removeWhere((time) => now.difference(time) > _window);
    if (_recent.length >= _maxCallsPerWindow) return false;
    final count = (_methodCounts[method] ?? 0) + 1;
    final limit = method == 'chooseImage' ? 5 : 30;
    if (count > limit) return false;
    _methodCounts[method] = count;
    _recent.add(now);
    return true;
  }

  Future<Object?> _dispatch(String method, Object? raw) async {
    final params = raw == null
        ? const <String, dynamic>{}
        : raw is Map
        ? Map<String, dynamic>.from(raw)
        : throw const MiniAppBridgeException(
            'INVALID_ARGUMENT',
            'params must be an object',
          );

    switch (method) {
      case 'getAppInfo':
        return {
          'appId': appId,
          'name': appName,
          'version': version,
          'entry': entry,
          'runtimeVersion': runtimeVersion,
          'minRuntimeVersion': minRuntimeVersion,
          'permissions': permissions,
        };
      case 'getUserInfo':
        await _require('user.profile');
        final me = await api.me();
        return {
          'id': me['id']?.toString() ?? '',
          'qchatId': me['qchatId']?.toString() ?? '',
          'nickname': me['nickname']?.toString() ?? '',
          'avatarUrl': null,
        };
      case 'showToast':
        await _require('toast');
        final message = _string(params['message'], 'message', 1, 200);
        final icon = _enum(params['icon'], const {'success', 'error', 'none'});
        onToast(message, icon);
        return null;
      case 'chooseImage':
        await _require('media.choose');
        return _chooseImage(params);
      case 'share':
        await _require('share');
        final text = _optionalString(params['text'], 'text', 2000);
        final url = _optionalString(params['url'], 'url', 2048);
        final title = _optionalString(params['title'], 'title', 200);
        if (text.isEmpty && url.isEmpty) {
          throw const MiniAppBridgeException(
            'INVALID_ARGUMENT',
            'text or url is required',
          );
        }
        if (url.isNotEmpty && !_https.hasMatch(url)) {
          throw const MiniAppBridgeException(
            'INVALID_ARGUMENT',
            'url must be HTTPS',
          );
        }
        return {'shared': await onShare(text, url, title)};
      case 'navigateTo':
        final path = _string(params['path'], 'path', 1, 300);
        _validatePath(path);
        await onNavigate(path);
        return null;
      case 'closeMiniApp':
        onClose();
        return null;
      case 'request':
        return _request(params);
      case 'getStorage':
        await _require('storage');
        final key = _key(params['key']);
        return {'value': await storage.get(key)};
      case 'setStorage':
        await _require('storage');
        final key = _key(params['key']);
        final value = params['value'];
        int encodedSize;
        try {
          encodedSize = utf8.encode(jsonEncode(value)).length;
        } catch (_) {
          throw const MiniAppBridgeException(
            'INVALID_ARGUMENT',
            'value must be JSON serializable',
          );
        }
        if (encodedSize > MiniAppStorage.maxValueBytes) {
          throw const MiniAppBridgeException(
            'STORAGE_QUOTA_EXCEEDED',
            'value is larger than 64 KB',
          );
        }
        await storage.set(key, value);
        return null;
      case 'removeStorage':
        await _require('storage');
        await storage.remove(_key(params['key']));
        return null;
      case 'getSystemInfo':
        return systemInfo();
    }
    throw const MiniAppBridgeException('NOT_SUPPORTED', 'Unknown method');
  }

  Future<Map<String, dynamic>> _request(Map<String, dynamic> params) async {
    final path = _string(params['path'], 'path', 1, 300);
    _validatePath(path);
    final normalized = _normalizePath(path);
    if (!_apiPaths.contains(normalized)) {
      throw const MiniAppBridgeException(
        'PERMISSION_DENIED',
        'This QChat API path is not available to Mini Apps',
      );
    }
    await _require(
      normalized == '/conversations' ? 'qchat.api' : 'user.profile',
    );
    final method = params['method'] ?? 'GET';
    if (method is! String ||
        !const {'GET', 'POST', 'PUT', 'PATCH', 'DELETE'}.contains(method)) {
      throw const MiniAppBridgeException(
        'INVALID_ARGUMENT',
        'unsupported method',
      );
    }
    Map<String, dynamic>? query;
    final rawQuery = params['query'];
    if (rawQuery != null) {
      if (rawQuery is! Map) {
        throw const MiniAppBridgeException(
          'INVALID_ARGUMENT',
          'query must be an object',
        );
      }
      query = <String, dynamic>{};
      for (final entry in rawQuery.entries) {
        final value = entry.value;
        if (value is! String && value is! num && value is! bool) {
          throw const MiniAppBridgeException(
            'INVALID_ARGUMENT',
            'query values must be strings, numbers or booleans',
          );
        }
        query[entry.key.toString()] = value;
      }
    }
    final body = params['body'];
    if (body != null) {
      try {
        if (jsonEncode(body).length > _maxBodyBytes) {
          throw const MiniAppBridgeException(
            'INVALID_ARGUMENT',
            'body is too large',
          );
        }
      } catch (error) {
        if (error is MiniAppBridgeException) rethrow;
        throw const MiniAppBridgeException(
          'INVALID_ARGUMENT',
          'body must be JSON serializable',
        );
      }
    }
    return await api.request(
      normalized,
      method: method,
      query: query,
      body: body,
    );
  }

  Future<Map<String, dynamic>> _chooseImage(Map<String, dynamic> params) async {
    final maxWidth = _int(params['maxWidth'], 'maxWidth', 1, 4096, 1024);
    final maxHeight = _int(params['maxHeight'], 'maxHeight', 1, 4096, 4096);
    final quality = _double(params['quality'], 'quality', 0.1, 1, 0.85);
    final picked = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      maxWidth: maxWidth.toDouble(),
      maxHeight: maxHeight.toDouble(),
      imageQuality: (quality * 100).round(),
    );
    if (picked == null) {
      throw const MiniAppBridgeException('CANCELLED', 'No image was chosen');
    }
    final bytes = await picked.readAsBytes();
    if (bytes.length > _maxImageBytes) {
      throw const MiniAppBridgeException(
        'INVALID_ARGUMENT',
        'Image is larger than 5 MB',
      );
    }
    var width = maxWidth;
    var height = maxHeight;
    try {
      final codec = await ui.instantiateImageCodec(bytes);
      final frame = await codec.getNextFrame();
      width = frame.image.width;
      height = frame.image.height;
      frame.image.dispose();
      codec.dispose();
    } catch (_) {
      // Some formats (for example HEIC on older devices) cannot be decoded
      // here; the reported size is still bounded by the requested maximum.
    }
    final mime = picked.mimeType ?? _mimeFor(picked.path);
    return {
      'dataUrl': 'data:$mime;base64,${base64Encode(bytes)}',
      'mimeType': mime,
      'width': width,
      'height': height,
      'size': bytes.length,
    };
  }

  Future<void> _require(String permission) async {
    if (_granted.contains(permission)) return;
    if (!permissions.contains(permission)) {
      throw MiniAppBridgeException(
        'PERMISSION_DENIED',
        'This Mini App did not request $permission',
      );
    }
    final allowed = await requestPermission(permission);
    if (!allowed) {
      throw MiniAppBridgeException(
        'PERMISSION_DENIED',
        'The user did not grant $permission',
      );
    }
    _granted.add(permission);
  }

  void _reply(String id, Object? result) {
    if (_closed) return;
    onResponse(
      jsonEncode({'id': id, 'ok': true, 'result': result}),
    );
  }

  void _fail(String id, String code, String message) {
    if (_closed) return;
    onResponse(
      jsonEncode({
        'id': id,
        'ok': false,
        'error': {'code': code, 'message': message},
      }),
    );
  }

  static final _https = RegExp(r'^https://[^\s]+$', caseSensitive: false);

  String _string(Object? value, String name, int min, int max) {
    if (value is! String) {
      throw MiniAppBridgeException('INVALID_ARGUMENT', '$name must be a string');
    }
    final trimmed = value.trim();
    if (trimmed.length < min || value.length > max) {
      throw MiniAppBridgeException('INVALID_ARGUMENT', '$name is invalid');
    }
    return trimmed;
  }

  String _optionalString(Object? value, String name, int max) {
    if (value == null) return '';
    return _string(value, name, 0, max);
  }

  String _enum(Object? value, Set<String> allowed) {
    if (value == null) return 'none';
    if (value is! String || !allowed.contains(value)) {
      throw const MiniAppBridgeException(
        'INVALID_ARGUMENT',
        'invalid enum value',
      );
    }
    return value;
  }

  int _int(Object? value, String name, int min, int max, int fallback) {
    if (value == null) return fallback;
    if (value is! num) {
      throw MiniAppBridgeException('INVALID_ARGUMENT', '$name must be a number');
    }
    final parsed = value.round();
    if (parsed < min || parsed > max) {
      throw MiniAppBridgeException('INVALID_ARGUMENT', '$name is out of range');
    }
    return parsed;
  }

  double _double(Object? value, String name, double min, double max, double fallback) {
    if (value == null) return fallback;
    if (value is! num) {
      throw MiniAppBridgeException('INVALID_ARGUMENT', '$name must be a number');
    }
    if (value < min || value > max) {
      throw MiniAppBridgeException('INVALID_ARGUMENT', '$name is out of range');
    }
    return value.toDouble();
  }

  String _key(Object? value) {
    if (value is! String || !_storageKey.hasMatch(value)) {
      throw const MiniAppBridgeException('INVALID_ARGUMENT', 'invalid storage key');
    }
    return value;
  }

  void _validatePath(String path) {
    if (!path.startsWith('/') ||
        path.startsWith('//') ||
        path.contains('..') ||
        path.contains('\\') ||
        path.contains('\u0000') ||
        RegExp(r'^[a-z]+:', caseSensitive: false).hasMatch(path)) {
      throw const MiniAppBridgeException(
        'INVALID_ARGUMENT',
        'path must be a relative path inside this Mini App',
      );
    }
  }

  String _normalizePath(String path) {
    final clean = path.split('?').first.split('#').first;
    return clean.length > 1 && clean.endsWith('/')
        ? clean.substring(0, clean.length - 1)
        : clean;
  }

  String _mimeFor(String path) {
    switch (p.extension(path).toLowerCase()) {
      case '.png':
        return 'image/png';
      case '.gif':
        return 'image/gif';
      case '.webp':
        return 'image/webp';
      case '.heic':
        return 'image/heic';
      case '.bmp':
        return 'image/bmp';
      default:
        return 'image/jpeg';
    }
  }
}

/// Convenience for the runtime screen: escapes the payload as a JavaScript
/// string literal before handing it to `window.__QChatReceive`.
String qchatReceiveScript(String payload) =>
    'window.__QChatReceive && window.__QChatReceive(${jsonEncode(payload)});';
