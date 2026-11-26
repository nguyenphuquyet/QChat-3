import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:path/path.dart' as p;

/// Serves one verified Mini App directory to the WebView.
///
/// The WebView never loads `file://` URLs: Android and iOS both make local file
/// access awkward and platform-specific. Instead a loopback-only HTTP server
/// exposes exactly one cache directory behind a random path token, so no other
/// app on the device can enumerate it. Every response carries a restrictive CSP
/// and the bridge script is injected into the entry document, which means a
/// package does not have to know how the host talks to it.
///
/// A WeChat build addresses its own files from the package root (`/assets/…`),
/// which is where WeChat itself serves them. This host mounts the package under
/// the token instead, so text responses are rebased onto `/<token>/assets/…`;
/// without that the entry document asks the origin root for its script and
/// stylesheet, gets a 404 and the WebView stays blank.
class MiniAppWebServer {
  MiniAppWebServer._(this._server, this.directory, this._token);

  final HttpServer _server;
  final String directory;
  final String _token;
  bool _closed = false;

  /// Text payloads may point at package files with a root-absolute URL
  /// (`src="/assets/app-service.js"`, `url(/assets/pic.png)`); see
  /// `_rebasePackageUrls`.
  static const _textExtensions = {'.html', '.htm', '.css', '.js', '.mjs'};

  static const _loopback = '127.0.0.1';

  /// The URL the WebView loads. The trailing slash matters: relative asset
  /// URLs in the package resolve under the token prefix.
  String get baseUrl => 'http://$_loopback:${_server.port}/$_token/';

  String get entryUrl => '${baseUrl}index.html';

  static Future<MiniAppWebServer> start(String directory) async {
    final root = Directory(directory);
    if (!await root.exists()) {
      throw const MiniAppWebServerException('APP_DIRECTORY_MISSING');
    }
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final token = _randomToken();
    final instance = MiniAppWebServer._(server, root.absolute.path, token);
    server.listen(
      instance._handle,
      onError: (Object _) {},
      cancelOnError: false,
    );
    return instance;
  }

  static String _randomToken() {
    final random = Random.secure();
    final bytes = List<int>.generate(24, (_) => random.nextInt(256));
    return bytes.map((byte) => byte.toRadixString(16).padLeft(2, '0')).join();
  }

  Future<void> dispose() async {
    if (_closed) return;
    _closed = true;
    await _server.close(force: true);
  }

  Future<void> _handle(HttpRequest request) async {
    final response = request.response;
    try {
      if (_closed) {
        response.statusCode = HttpStatus.gone;
        return;
      }
      if (request.method != 'GET' && request.method != 'HEAD') {
        response.statusCode = HttpStatus.methodNotAllowed;
        response.headers.set(HttpHeaders.allowHeader, 'GET, HEAD');
        return;
      }

      final segments = request.uri.pathSegments;
      if (segments.isEmpty || segments.first != _token) {
        response.statusCode = HttpStatus.notFound;
        return;
      }
      final relative = segments.skip(1).toList(growable: false);
      if (relative.isNotEmpty && relative.first == '__qchat') {
        if (relative.length == 2 && relative[1] == 'bridge.js') {
          _write(
            response,
            _bridgeScript,
            'text/javascript; charset=utf-8',
            request.method == 'HEAD',
          );
          return;
        }
        response.statusCode = HttpStatus.notFound;
        return;
      }

      final requested = relative.isEmpty ? 'index.html' : relative.join('/');
      final file = await _resolve(requested);
      if (file != null) {
        final extension = p.extension(file.path).toLowerCase();
        if (_textExtensions.contains(extension)) {
          final body = _rebasePackageUrls(
            utf8.decode(await file.readAsBytes(), allowMalformed: true),
          );
          _write(
            response,
            extension == '.html' || extension == '.htm'
                ? _injectBridge(body)
                : body,
            _contentType(file.path),
            request.method == 'HEAD',
          );
          return;
        }
        response.headers.contentType = ContentType.parse(_contentType(file.path));
        response.headers.set(HttpHeaders.contentLengthHeader, '${await file.length()}');
        _securityHeaders(response);
        if (request.method == 'HEAD') {
          await response.close();
          return;
        }
        await response.addStream(file.openRead());
        await response.close();
        return;
      }

      // A single-page app uses client-side routes such as /movie/42. Serve the
      // entry document for an extension-less navigation so a reload keeps
      // working instead of showing a host 404.
      if (_isNavigation(request, requested)) {
        final entry = File(p.join(directory, 'index.html'));
        if (await entry.exists()) {
          final html = _rebasePackageUrls(
            utf8.decode(await entry.readAsBytes(), allowMalformed: true),
          );
          _write(
            response,
            _injectBridge(html),
            'text/html; charset=utf-8',
            request.method == 'HEAD',
          );
          return;
        }
      }
      response.statusCode = HttpStatus.notFound;
    } catch (_) {
      try {
        response.statusCode = HttpStatus.internalServerError;
      } catch (_) {}
    } finally {
      try {
        await response.close();
      } catch (_) {}
    }
  }

  Future<File?> _resolve(String requested) async {
    if (requested.isEmpty ||
        requested.contains('\u0000') ||
        requested.contains('\\')) {
      return null;
    }
    final segments = requested.split('/');
    if (segments.any((part) => part.isEmpty || part == '.' || part == '..')) {
      return null;
    }
    final candidate = File(p.joinAll([directory, ...segments]));
    final normalized = p.normalize(candidate.path);
    final root = p.normalize(directory);
    if (normalized != root && !normalized.startsWith('$root${p.separator}')) {
      return null;
    }
    final type = await FileSystemEntity.type(normalized, followLinks: false);
    if (type != FileSystemEntityType.file) return null;
    return File(normalized);
  }

  bool _isNavigation(HttpRequest request, String requested) {
    if (requested.contains('.')) return false;
    final accept = request.headers.value(HttpHeaders.acceptHeader) ?? '';
    return accept.contains('text/html') || accept.contains('*/*');
  }

  /// Text payloads may point at package files with a root-absolute URL
  /// (`src="/assets/app-service.js"`, `url(/assets/pic.png)`). The package is
  /// mounted under the token, so those URLs are rebased onto it. A URL that
  /// already has a host or a protocol-relative prefix is left alone.
  String _rebasePackageUrls(String body) {
    return body.replaceAllMapped(
      RegExp(r'''(["'`(,\s=])/assets/'''),
      (match) => '${match[1]}/$_token/assets/',
    );
  }

  String _injectBridge(String html) {
    final bridge =
        '<script src="/$_token/__qchat/bridge.js"></script>';
    final viewport =
        '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">';
    var output = html;
    if (!RegExp(r'''<meta[^>]+name=["']viewport''', caseSensitive: false)
        .hasMatch(output)) {
      final head = RegExp(r'<head\b[^>]*>', caseSensitive: false).firstMatch(output);
      if (head != null) {
        output = output.replaceRange(head.end, head.end, viewport);
      } else {
        final htmlTag =
            RegExp(r'<html\b[^>]*>', caseSensitive: false).firstMatch(output);
        if (htmlTag != null) {
          output = output.replaceRange(htmlTag.end, htmlTag.end, '<head>$viewport</head>');
        } else {
          output = '$viewport$output';
        }
      }
    }
    final head = RegExp(r'<head\b[^>]*>', caseSensitive: false).firstMatch(output);
    if (head != null) {
      return output.replaceRange(head.end, head.end, bridge);
    }
    final htmlTag =
        RegExp(r'<html\b[^>]*>', caseSensitive: false).firstMatch(output);
    if (htmlTag != null) {
      return output.replaceRange(htmlTag.end, htmlTag.end, '<head>$bridge</head>');
    }
    return '$bridge$output';
  }

  void _write(
    HttpResponse response,
    String body,
    String type,
    bool head,
  ) {
    final bytes = utf8.encode(body);
    response.headers.contentType = ContentType.parse(type);
    response.headers.set(HttpHeaders.contentLengthHeader, '${bytes.length}');
    _securityHeaders(response);
    if (!head) response.add(bytes);
  }

  void _securityHeaders(HttpResponse response) {
    response.headers.set(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "media-src 'self' data: blob:",
        "connect-src 'none'",
        "frame-src 'none'",
        "worker-src 'none'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
      ].join('; '),
    );
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
    response.headers.set(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    );
    response.headers.set(HttpHeaders.cacheControlHeader, 'no-store');
  }

  static String _contentType(String path) {
    switch (p.extension(path).toLowerCase()) {
      case '.html':
      case '.htm':
        return 'text/html; charset=utf-8';
      case '.js':
      case '.mjs':
        return 'text/javascript; charset=utf-8';
      case '.css':
        return 'text/css; charset=utf-8';
      case '.json':
      case '.map':
        return 'application/json; charset=utf-8';
      case '.txt':
        return 'text/plain; charset=utf-8';
      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.gif':
        return 'image/gif';
      case '.webp':
        return 'image/webp';
      case '.avif':
        return 'image/avif';
      case '.svg':
        return 'image/svg+xml';
      case '.ico':
        return 'image/x-icon';
      case '.woff':
        return 'font/woff';
      case '.woff2':
        return 'font/woff2';
      case '.ttf':
        return 'font/ttf';
      case '.otf':
        return 'font/otf';
      case '.mp3':
        return 'audio/mpeg';
      case '.wav':
        return 'audio/wav';
      case '.mp4':
        return 'video/mp4';
      case '.webm':
        return 'video/webm';
      case '.vtt':
        return 'text/vtt; charset=utf-8';
      case '.wasm':
        return 'application/wasm';
      default:
        return 'application/octet-stream';
    }
  }
}

class MiniAppWebServerException implements Exception {
  const MiniAppWebServerException(this.code);

  final String code;

  @override
  String toString() => code;
}

/// The browser half of the host bridge. It is injected before the package's own
/// scripts and exposes one promise-based `window.qchat` object. Native calls
/// travel over the `QChatHost` JavaScript channel; answers come back through
/// `__qchatResolve`.
const _bridgeScript = r'''
(function () {
  if (window.qchat) return;
  var pending = new Map();
  var nextId = 0;
  var listeners = new Map();

  function post(method, params) {
    return new Promise(function (resolve, reject) {
      var id = ++nextId;
      pending.set(id, { resolve: resolve, reject: reject });
      try {
        QChatHost.postMessage(JSON.stringify({
          id: id,
          method: method,
          params: params == null ? {} : params
        }));
      } catch (error) {
        pending.delete(id);
        reject(new Error('QChat host is unavailable'));
      }
    });
  }

  window.__qchatResolve = function (id, json) {
    var key = Number(id);
    var entry = pending.get(key);
    if (!entry) return;
    pending.delete(key);
    var message;
    try {
      message = JSON.parse(json);
    } catch (error) {
      entry.reject(new Error('Invalid host response'));
      return;
    }
    if (message && message.ok) {
      entry.resolve(message.result);
      return;
    }
    var failure = new Error((message && message.message) || 'Host error');
    failure.code = (message && message.code) || 'HOST_ERROR';
    entry.reject(failure);
  };

  window.__qchatEmit = function (name, json) {
    var set = listeners.get(name);
    if (!set) return;
    var payload = {};
    try { payload = json ? JSON.parse(json) : {}; } catch (error) {}
    set.forEach(function (listener) {
      try { listener(payload); } catch (error) { console.error(error); }
    });
  };

  function on(name, listener) {
    if (typeof listener !== 'function') return function () {};
    var set = listeners.get(name);
    if (!set) {
      set = new Set();
      listeners.set(name, set);
    }
    set.add(listener);
    return function () { set.delete(listener); };
  }

  var storage = {
    get: function (key) {
      return post('getStorage', { key: key }).then(function (result) {
        return result == null ? null : result.value;
      });
    },
    set: function (key, value) {
      return post('setStorage', { key: key, value: value });
    },
    remove: function (key) {
      return post('removeStorage', { key: key });
    }
  };

  window.qchat = {
    version: '2.0.0',
    call: post,
    getAppInfo: function () { return post('getAppInfo'); },
    getUserInfo: function () { return post('getUserInfo'); },
    getSystemInfo: function () { return post('getSystemInfo'); },
    showToast: function (message, icon) {
      return post('showToast', { message: message, icon: icon || 'none' });
    },
    chooseImage: function (options) {
      return post('chooseImage', options || {});
    },
    share: function (options) {
      return post('share', options || {});
    },
    navigateTo: function (path) {
      return post('navigateTo', { path: path });
    },
    navigateBack: function () { return post('navigateBack'); },
    close: function () { return post('closeMiniApp'); },
    request: function (path, options) {
      var params = Object.assign({ path: path }, options || {});
      return post('request', params);
    },
    fetch: function (url, options) {
      var params = Object.assign({ url: url }, options || {});
      return post('fetch', params);
    },
    storage: storage,
    on: on,
    off: function (name, listener) {
      var set = listeners.get(name);
      if (set) set.delete(listener);
    }
  };

  // Older packages used the capitalised global; keep the alias so a package
  // written against the first web runtime still runs.
  window.QChat = window.qchat;
})();
''';
