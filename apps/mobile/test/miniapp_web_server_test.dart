import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:path/path.dart' as p;
import 'package:qchat/features/miniapps/miniapp_web_server.dart';

Future<({int status, String body})> _get(String url) async {
  final client = HttpClient();
  try {
    final request = await client.getUrl(Uri.parse(url));
    final response = await request.close();
    final body = await response.transform(utf8.decoder).join();
    return (status: response.statusCode, body: body);
  } finally {
    client.close(force: true);
  }
}

void main() {
  late Directory root;
  late MiniAppWebServer server;
  late Uri base;

  setUp(() async {
    root = await Directory.systemTemp.createTemp('qchat-miniapp-web-');
    Future<void> write(String name, String body) async {
      final file = File(p.joinAll([root.path, ...name.split('/')]));
      await file.parent.create(recursive: true);
      await file.writeAsString(body);
    }

    await write(
      'index.html',
      '<!doctype html><html><head>'
          '<link rel="stylesheet" href="/assets/app-wxss.css"></head><body>'
          '<script src="/assets/app-service.js"></script></body></html>',
    );
    await write(
      'assets/app-wxss.css',
      '.page { background: url("/assets/images/pic.png"); }',
    );
    await write(
      'assets/app-service.js',
      'var logo = "/assets/images/logo.png"; var remote = "https://example.test/assets/x.png";',
    );
    await write('assets/images/pic.png', 'png');
    await write('assets/images/logo.png', 'png');

    server = await MiniAppWebServer.start(root.path);
    base = Uri.parse(server.baseUrl);
  });

  tearDown(() async {
    await server.dispose();
    if (await root.exists()) await root.delete(recursive: true);
  });

  test('rebases root-absolute package URLs onto the token path', () async {
    final token = base.pathSegments.first;

    final html = await _get(server.entryUrl);
    expect(html.status, 200);
    expect(html.body, contains('href="/$token/assets/app-wxss.css"'));
    expect(html.body, contains('src="/$token/assets/app-service.js"'));
    expect(html.body, contains('/$token/__qchat/bridge.js'));

    final css = await _get('${server.baseUrl}assets/app-wxss.css');
    expect(css.status, 200);
    expect(css.body, contains('url("/$token/assets/images/pic.png")'));

    final js = await _get('${server.baseUrl}assets/app-service.js');
    expect(js.status, 200);
    expect(js.body, contains('"/$token/assets/images/logo.png"'));
    // A URL that names another origin is not a package file.
    expect(js.body, contains('https://example.test/assets/x.png'));
  });

  test('the package stays unreadable outside the token path', () async {
    final origin = '${base.scheme}://${base.host}:${base.port}';

    expect((await _get('$origin/index.html')).status, 404);
    expect((await _get('$origin/assets/app-service.js')).status, 404);
  });
}
