import 'dart:io';

import 'package:path/path.dart' as p;

/// Serves one unpacked Mini App from a random loopback port. The port is the
/// app's origin: cookies, localStorage and IndexedDB are isolated from QChat and
/// from every other Mini App.
class MiniAppAssetServer {
  MiniAppAssetServer({
    required this.root,
    required this.entry,
    required this.appId,
  });

  final String root;
  final String entry;
  final String appId;
  HttpServer? _server;

  String get origin {
    final server = _server;
    if (server == null) throw StateError('Asset server is not running');
    return 'http://127.0.0.1:${server.port}';
  }

  String get url => '$origin/${entry.split('/').map(Uri.encodeComponent).join('/')}';

  static const _csp =
      "default-src 'self'; "
      "script-src 'self' 'unsafe-inline'; "
      "style-src 'self' 'unsafe-inline'; "
      "img-src 'self' data: blob:; "
      "media-src 'self' blob:; "
      "font-src 'self' data:; "
      "connect-src 'self'; "
      "object-src 'none'; "
      "base-uri 'none'; "
      "form-action 'none'; "
      "frame-ancestors 'none'";

  Future<void> start() async {
    if (_server != null) return;
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    _server = server;
    server.listen(_handle, onError: (_) {});
  }

  Future<void> close() async {
    final server = _server;
    _server = null;
    if (server != null) await server.close(force: true);
  }

  Future<void> _handle(HttpRequest request) async {
    final response = request.response;
    try {
      if (request.method != 'GET' && request.method != 'HEAD') {
        response.statusCode = HttpStatus.methodNotAllowed;
        await response.close();
        return;
      }

      final segments = request.uri.pathSegments
          .where((segment) => segment.isNotEmpty)
          .toList();
      final relative = segments.isEmpty ? entry.split('/') : segments;
      if (relative.any(
        (segment) =>
            segment == '.' ||
            segment == '..' ||
            segment.contains('/') ||
            segment.contains('\\') ||
            segment.contains(':') ||
            segment.contains('\u0000'),
      )) {
        response.statusCode = HttpStatus.badRequest;
        await response.close();
        return;
      }

      final normalizedRoot = p.normalize(root);
      var file = File(p.joinAll([normalizedRoot, ...relative]));
      if (await FileSystemEntity.isDirectory(file.path)) {
        file = File(p.join(file.path, 'index.html'));
      }
      final normalized = p.normalize(file.path);
      if (!normalized.startsWith('$normalizedRoot${p.separator}')) {
        response.statusCode = HttpStatus.forbidden;
        await response.close();
        return;
      }
      if (!await file.exists()) {
        response.statusCode = HttpStatus.notFound;
        response.headers.contentType = ContentType.html;
        response.write(
          '<!doctype html><meta charset="utf-8"><title>Not found</title>'
          '<p>This file is not part of the Mini App.</p>',
        );
        await response.close();
        return;
      }

      response.headers.contentType = _contentType(file.path);
      response.headers.set('Content-Security-Policy', _csp);
      response.headers.set('X-Content-Type-Options', 'nosniff');
      response.headers.set('Referrer-Policy', 'no-referrer');
      response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
      response.headers.set('Cache-Control', 'no-store');
      response.headers.set('X-QChat-MiniApp', appId);
      if (request.method == 'HEAD') {
        response.contentLength = await file.length();
        await response.close();
        return;
      }
      await response.addStream(file.openRead());
      await response.close();
    } catch (_) {
      try {
        response.statusCode = HttpStatus.internalServerError;
        await response.close();
      } catch (_) {
        // The client disconnected; nothing else to do.
      }
    }
  }

  ContentType _contentType(String path) {
    switch (p.extension(path).toLowerCase()) {
      case '.html':
      case '.htm':
        return ContentType.html;
      case '.js':
      case '.mjs':
        return ContentType('text', 'javascript', charset: 'utf-8');
      case '.css':
        return ContentType('text', 'css', charset: 'utf-8');
      case '.json':
      case '.map':
        return ContentType.json;
      case '.png':
        return ContentType('image', 'png');
      case '.jpg':
      case '.jpeg':
        return ContentType('image', 'jpeg');
      case '.gif':
        return ContentType('image', 'gif');
      case '.webp':
        return ContentType('image', 'webp');
      case '.svg':
        return ContentType('image', 'svg+xml', charset: 'utf-8');
      case '.ico':
        return ContentType('image', 'x-icon');
      case '.woff':
        return ContentType('font', 'woff');
      case '.woff2':
        return ContentType('font', 'woff2');
      case '.ttf':
        return ContentType('font', 'ttf');
      case '.otf':
        return ContentType('font', 'otf');
      case '.wasm':
        return ContentType('application', 'wasm');
      case '.mp3':
        return ContentType('audio', 'mpeg');
      case '.mp4':
        return ContentType('video', 'mp4');
      case '.webm':
        return ContentType('video', 'webm');
      case '.txt':
        return ContentType.text;
      default:
        return ContentType.binary;
    }
  }
}
