import 'dart:convert';
import 'dart:ffi';
import 'dart:io';

import 'package:archive/archive.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:path/path.dart' as p;
import 'package:qchat/features/miniapps/qapp/qapp_js_runtime.dart';

/// The compiled Hello World package is executed by the real QuickJS bridge,
/// not by a mock renderer. On hosts where flutter_js has no shared library yet
/// (for example Linux CI), the test is skipped instead of pretending to pass.
class _Host implements QappJsHost {
  final renders = <Map<String, dynamic>>[];
  final logs = <String>[];
  final calls = <String>[];

  @override
  void onRender(Map<String, dynamic> payload) => renders.add(payload);

  @override
  void onReady(Map<String, dynamic>? payload) {}

  @override
  void onLog(String level, String message, String? stack) {
    logs.add('$level: $message');
  }

  @override
  void onLifecycle(String event) {}

  @override
  Future<QappHostResponse> call(
    String method,
    Map<String, dynamic> params,
  ) async {
    calls.add(method);
    return switch (method) {
      'showToast' => const QappHostResponse.ok(null),
      _ => QappHostResponse.error('NOT_SUPPORTED', method),
    };
  }
}

Map<String, dynamic>? _findNode(
  Map<String, dynamic> node,
  bool Function(Map<String, dynamic>) test,
) {
  if (test(node)) return node;
  final children = node['children'];
  if (children is! List) return null;
  for (final child in children.whereType<Map>()) {
    final found = _findNode(Map<String, dynamic>.from(child), test);
    if (found != null) return found;
  }
  return null;
}

String _nodeText(Map<String, dynamic> node) {
  final props = node['props'];
  if (props is Map && props['text'] is String) return props['text'] as String;
  final children = node['children'];
  if (children is! List) return '';
  return children
      .whereType<Map>()
      .map((child) => _nodeText(Map<String, dynamic>.from(child)))
      .join();
}

String? _quickJsBridgeLibrary() {
  final cache =
      Platform.environment['PUB_CACHE'] ??
      (Platform.isWindows
          ? p.join(Platform.environment['LOCALAPPDATA'] ?? '', 'Pub', 'Cache')
          : p.join(Platform.environment['HOME'] ?? '', '.pub-cache'));
  final hosted = Directory(p.join(cache, 'hosted'));
  if (!hosted.existsSync()) return null;
  final candidates = <String>[
    if (Platform.isWindows) p.join('windows', 'shared', 'quickjs_c_bridge.dll'),
    if (Platform.isLinux)
      p.join('linux', 'shared', 'libquickjs_c_bridge_plugin.so'),
  ];
  for (final host in hosted.listSync()) {
    if (host is! Directory) continue;
    for (final package in host.listSync()) {
      if (package is! Directory) continue;
      if (!p.basename(package.path).startsWith('flutter_js-')) continue;
      for (final relative in candidates) {
        final file = File(p.join(package.path, relative));
        if (file.existsSync()) return file.path;
      }
    }
  }
  return null;
}

void main() {
  final quickJsLibrary = _quickJsBridgeLibrary();
  final example = p.normalize(
    p.join(
      Directory.current.path,
      '..',
      '..',
      'packages',
      'miniapp-examples',
      'hello-world',
      'dist',
      'hello-qchat-1.0.0.japp',
    ),
  );

  setUpAll(() {
    if ((Platform.isWindows || Platform.isLinux) && quickJsLibrary != null) {
      // flutter_js opens the bridge by bare filename. Preloading the absolute
      // path makes the same module handle available to its loader.
      DynamicLibrary.open(quickJsLibrary);
    }
  });

  test(
    'compiled hello .japp runs in QuickJS and rerenders on press',
    () async {
      final archive = ZipDecoder().decodeBytes(File(example).readAsBytesSync());
      final appFile = archive.files.firstWhere((file) => file.name == 'app.js');
      final appJs = utf8.decode(appFile.content as List<int>);

      final runtime = createQappJsRuntime();
      addTearDown(runtime.dispose);
      final host = _Host();
      await runtime.start(appJs: appJs, host: host);
      await Future<void>.delayed(Duration.zero);

      expect(host.renders, isNotEmpty);
      final first = host.renders.last;
      expect(first['v'], 1);
      final firstText = _nodeText(
        Map<String, dynamic>.from(first['root'] as Map),
      );
      expect(firstText, contains('Hello from TSX'));
      expect(firstText, isNot(contains('The host handled')));

      final root = Map<String, dynamic>.from(first['root'] as Map);
      final button = _findNode(root, (node) => node['type'] == 'Button');
      expect(button, isNotNull);
      runtime.dispatch(button!['id'] as String, 'press', null);
      await Future<void>.delayed(Duration.zero);

      expect(host.renders.length, greaterThan(1));
      final secondText = _nodeText(
        Map<String, dynamic>.from(host.renders.last['root'] as Map),
      );
      expect(secondText, contains('The host handled'));
      expect(host.calls, contains('showToast'));
      expect(host.logs, isEmpty);
    },
    skip: !File(example).existsSync()
        ? 'Build the hello-world example first'
        : (Platform.isWindows || Platform.isLinux) && quickJsLibrary == null
        ? 'QuickJS shared library not found'
        : false,
  );
}
