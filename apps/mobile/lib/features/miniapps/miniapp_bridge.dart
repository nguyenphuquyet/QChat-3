import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:dio/dio.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path/path.dart' as p;

import 'miniapp_api.dart';
import 'miniapp_storage.dart';
import 'qapp/qapp_js_types.dart';

class MiniAppBridgeException implements Exception {
  const MiniAppBridgeException(this.code, this.message);

  final String code;
  final String message;

  @override
  String toString() => '$code: $message';
}

/// Opens the app's photo picker for `chooseImage`.
///
/// The bridge holds no `BuildContext`, so the screen that hosts it supplies the
/// picker. That is what makes a Mini App open the same WeChat-style page as the
/// chat instead of the operating system's photo picker.
typedef MiniAppImagePicker =
    Future<XFile?> Function({
      required int maxWidth,
      required int maxHeight,
      required double quality,
    });

/// Validates and executes calls from the native Mini App runtime.
///
/// QuickJS can only call the host through [execute]. Every request is checked
/// here: method allowlist, parameter schema, declared permission, per-method
/// rate limit and host-side timeout. Privileged work (profile, media, QChat API,
/// storage, network) happens in Flutter; JavaScript never receives a QChat
/// access token.
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
    required this.onChooseImage,
    required this.onToast,
    required this.onShare,
    required this.onNavigate,
    required this.onClose,
    required this.systemInfo,
    this.onNavigateBack,
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

  /// Opens the app's photo picker; null means the user cancelled.
  final MiniAppImagePicker onChooseImage;

  final void Function(String message, String icon) onToast;
  final Future<bool> Function(String text, String url, String title) onShare;
  final Future<void> Function(String path) onNavigate;
  final void Function() onClose;
  final Map<String, dynamic> Function() systemInfo;
  final Future<void> Function()? onNavigateBack;

  final Set<String> _granted;
  final List<DateTime> _recent = [];
  final Map<String, int> _methodCounts = {};
  DateTime _methodWindow = DateTime.now();
  bool _closed = false;

  static const _maxBodyBytes = 32 * 1024;
  static const _maxResponseBytes = 1024 * 1024;
  static const _maxCallsPerWindow = 60;
  static const _window = Duration(seconds: 10);
  static const _maxImageBytes = 5 * 1024 * 1024;
  static final _storageKey = RegExp(r'^[A-Za-z0-9._-]{1,64}$');
  static final _routePattern = RegExp(r'^[A-Za-z0-9._~/-]{1,300}$');
  static final _apiPaths = {'/users/me', '/friends', '/conversations'};
  static const _methods = {
    'getAppInfo',
    'getUserInfo',
    'showToast',
    'chooseImage',
    'share',
    'navigateTo',
    'navigateBack',
    'closeMiniApp',
    'request',
    'fetch',
    'getStorage',
    'setStorage',
    'removeStorage',
    'getSystemInfo',
  };

  Set<String> get granted => Set.unmodifiable(_granted);

  void dispose() {
    _closed = true;
    _recent.clear();
  }

  /// Entry point used by the QuickJS host. Returns the response directly.
  Future<QappHostResponse> execute(String method, Object? rawParams) async {
    if (_closed) {
      return const QappHostResponse.error('HOST_CLOSED', 'Mini App is closed');
    }
    if (!_methods.contains(method)) {
      return const QappHostResponse.error('NOT_SUPPORTED', 'Unknown method');
    }
    if (!_allowCall(method)) {
      return const QappHostResponse.error(
        'RATE_LIMITED',
        'Too many calls, slow down',
      );
    }
    try {
      final result = await _dispatch(
        method,
        rawParams,
      ).timeout(_timeoutFor(method));
      return QappHostResponse.ok(result);
    } on TimeoutException {
      return QappHostResponse.error('TIMEOUT', '$method timed out');
    } on MiniAppBridgeException catch (error) {
      return QappHostResponse.error(error.code, error.message);
    } on MiniAppStorageException catch (error) {
      return QappHostResponse.error(
        error.code,
        error.code == 'STORAGE_QUOTA_EXCEEDED'
            ? 'Mini App storage quota exceeded'
            : 'Storage is unavailable',
      );
    } catch (_) {
      return const QappHostResponse.error(
        'HOST_ERROR',
        'The QChat host could not complete this call',
      );
    }
  }

  Duration _timeoutFor(String method) => switch (method) {
    'chooseImage' => const Duration(seconds: 60),
    'request' || 'fetch' => const Duration(seconds: 20),
    _ => const Duration(seconds: 10),
  };

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
          'format': 'qapp',
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
        if (params['external'] == true) {
          throw const MiniAppBridgeException(
            'NOT_SUPPORTED',
            'Opening external apps is not supported',
          );
        }
        final path = _string(params['path'], 'path', 1, 300);
        _validateRoute(path);
        await onNavigate(path);
        return null;
      case 'navigateBack':
        final back = onNavigateBack;
        if (back != null) {
          await back();
        } else {
          onClose();
        }
        return null;
      case 'closeMiniApp':
        onClose();
        return null;
      case 'request':
        return _request(params);
      case 'fetch':
        return _fetch(params);
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

  Future<Map<String, dynamic>> _fetch(Map<String, dynamic> params) async {
    await _require('network');
    final url = _string(params['url'], 'url', 1, 2048);
    final uri = Uri.tryParse(url);
    if (uri == null ||
        uri.scheme != 'https' ||
        uri.host.isEmpty ||
        uri.userInfo.isNotEmpty) {
      throw const MiniAppBridgeException(
        'INVALID_ARGUMENT',
        'url must be an HTTPS URL',
      );
    }
    final method = params['method'] ?? 'GET';
    if (method is! String ||
        !const {'GET', 'POST', 'PUT', 'PATCH', 'DELETE'}.contains(method)) {
      throw const MiniAppBridgeException(
        'INVALID_ARGUMENT',
        'unsupported method',
      );
    }
    final headers = _requestHeaders(params['headers']);
    Uint8List? payload;
    final body = params['body'];
    if (body != null && method != 'GET') {
      if (body is! String) {
        throw const MiniAppBridgeException(
          'INVALID_ARGUMENT',
          'body must be a string',
        );
      }
      final encoded = utf8.encode(body);
      if (encoded.length > _maxBodyBytes) {
        throw const MiniAppBridgeException(
          'INVALID_ARGUMENT',
          'body is too large',
        );
      }
      payload = Uint8List.fromList(encoded);
    }
    final timeoutValue = params['timeoutMs'];
    final timeout = timeoutValue is num
        ? Duration(milliseconds: timeoutValue.round().clamp(1000, 15000))
        : const Duration(seconds: 10);
    final dio = Dio(
      BaseOptions(
        connectTimeout: const Duration(seconds: 8),
        sendTimeout: timeout,
        receiveTimeout: timeout,
        followRedirects: false,
        validateStatus: (_) => true,
        responseType: ResponseType.stream,
        headers: const {'accept': 'application/json, text/plain, */*'},
      ),
    );
    final token = CancelToken();
    var current = uri;
    var currentMethod = method;
    var currentPayload = payload;
    Response<ResponseBody> response;
    var hops = 0;
    while (true) {
      response = await dio.request<ResponseBody>(
        current.toString(),
        data: currentPayload == null
            ? null
            : Stream<Uint8List>.value(currentPayload),
        options: Options(
          method: currentMethod,
          headers: {
            ...headers,
            if (currentPayload != null)
              'content-type': headers['content-type'] ?? 'application/json',
          },
          followRedirects: false,
          validateStatus: (_) => true,
        ),
        cancelToken: token,
      );
      final status = response.statusCode ?? 0;
      final location = response.headers.value('location');
      if (status < 300 || status >= 400 || location == null) break;
      hops += 1;
      if (hops > 3) {
        throw const MiniAppBridgeException(
          'TOO_MANY_REDIRECTS',
          'The server redirected too many times',
        );
      }
      final next = current.resolve(location);
      if (next.scheme != 'https' || next.host.isEmpty) {
        throw const MiniAppBridgeException(
          'INVALID_ARGUMENT',
          'redirects must stay on HTTPS',
        );
      }
      if (status == 303 ||
          ((status == 301 || status == 302) &&
              currentMethod != 'GET' &&
              currentMethod != 'HEAD')) {
        currentMethod = 'GET';
        currentPayload = null;
      }
      current = next;
    }

    final builder = BytesBuilder(copy: false);
    final stream = response.data?.stream;
    if (stream != null) {
      await for (final chunk in stream) {
        builder.add(chunk);
        if (builder.length > _maxResponseBytes) {
          token.cancel('response too large');
          throw const MiniAppBridgeException(
            'RESPONSE_TOO_LARGE',
            'The response is larger than 1 MB',
          );
        }
      }
    }
    final bytes = builder.takeBytes();
    final text = utf8.decode(bytes, allowMalformed: true);
    Object? data = text;
    final contentType = response.headers.value('content-type') ?? '';
    if (contentType.toLowerCase().contains('application/json') ||
        text.trimLeft().startsWith('{') ||
        text.trimLeft().startsWith('[')) {
      try {
        data = jsonDecode(text);
      } catch (_) {
        data = text;
      }
    }
    final responseHeaders = <String, String>{};
    response.headers.forEach((name, values) {
      final key = name.toLowerCase();
      if (key == 'set-cookie') return;
      responseHeaders[key] = values.join(',');
    });
    return {
      'status': response.statusCode ?? 0,
      'headers': responseHeaders,
      'data': data,
    };
  }

  Map<String, String> _requestHeaders(Object? raw) {
    if (raw == null) return const {};
    if (raw is! Map || raw.length > 20) {
      throw const MiniAppBridgeException(
        'INVALID_ARGUMENT',
        'headers must be an object',
      );
    }
    const blocked = {
      'host',
      'cookie',
      'set-cookie',
      'content-length',
      'connection',
      'transfer-encoding',
      'upgrade',
      'proxy-authorization',
    };
    final headers = <String, String>{};
    for (final entry in raw.entries) {
      final name = entry.key.toString().toLowerCase();
      final value = entry.value;
      if (!RegExp(r'^[a-z0-9-]{1,64}$').hasMatch(name) ||
          blocked.contains(name) ||
          value is! String ||
          value.length > 512 ||
          value.contains('\r') ||
          value.contains('\n')) {
        throw const MiniAppBridgeException(
          'INVALID_ARGUMENT',
          'invalid request header',
        );
      }
      headers[name] = value;
    }
    return headers;
  }

  Future<Map<String, dynamic>> _chooseImage(Map<String, dynamic> params) async {
    final maxWidth = _int(params['maxWidth'], 'maxWidth', 1, 4096, 1024);
    final maxHeight = _int(params['maxHeight'], 'maxHeight', 1, 4096, 4096);
    final quality = _double(params['quality'], 'quality', 0.1, 1, 0.85);
    final picked = await onChooseImage(
      maxWidth: maxWidth,
      maxHeight: maxHeight,
      quality: quality,
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

  static final _https = RegExp(r'^https://[^\s]+$', caseSensitive: false);

  String _string(Object? value, String name, int min, int max) {
    if (value is! String) {
      throw MiniAppBridgeException(
        'INVALID_ARGUMENT',
        '$name must be a string',
      );
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
      throw MiniAppBridgeException(
        'INVALID_ARGUMENT',
        '$name must be a number',
      );
    }
    final parsed = value.round();
    if (parsed < min || parsed > max) {
      throw MiniAppBridgeException('INVALID_ARGUMENT', '$name is out of range');
    }
    return parsed;
  }

  double _double(
    Object? value,
    String name,
    double min,
    double max,
    double fallback,
  ) {
    if (value == null) return fallback;
    if (value is! num) {
      throw MiniAppBridgeException(
        'INVALID_ARGUMENT',
        '$name must be a number',
      );
    }
    if (value < min || value > max) {
      throw MiniAppBridgeException('INVALID_ARGUMENT', '$name is out of range');
    }
    return value.toDouble();
  }

  String _key(Object? value) {
    if (value is! String || !_storageKey.hasMatch(value)) {
      throw const MiniAppBridgeException(
        'INVALID_ARGUMENT',
        'invalid storage key',
      );
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

  void _validateRoute(String path) {
    if (!_routePattern.hasMatch(path) ||
        path.startsWith('//') ||
        path.contains('..') ||
        path.contains('\\') ||
        path.contains('\u0000')) {
      throw const MiniAppBridgeException(
        'INVALID_ARGUMENT',
        'path must be an in-app route',
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
