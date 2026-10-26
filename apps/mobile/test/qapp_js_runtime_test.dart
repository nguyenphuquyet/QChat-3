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

/// Reads `app.js` out of a compiled `.japp` package.
String _appJsOf(String japp) {
  final archive = ZipDecoder().decodeBytes(File(japp).readAsBytesSync());
  final appFile = archive.files.firstWhere((file) => file.name == 'app.js');
  return utf8.decode(appFile.content as List<int>);
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
  final envDemo = p.normalize(
    p.join(
      Directory.current.path,
      '..',
      '..',
      'packages',
      'miniapp-examples',
      'env-demo',
      'dist',
      'env-demo-1.0.0.japp',
    ),
  );
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

  test(
    'the host wakes the JavaScript timer queue and the app rerenders',
    () async {
      final runtime = createQappJsRuntime();
      addTearDown(runtime.dispose);
      final host = _Host();
      await runtime.start(appJs: _appJsOf(envDemo), host: host);
      await Future<void>.delayed(Duration.zero);

      String lastText() => _nodeText(
        Map<String, dynamic>.from(host.renders.last['root'] as Map),
      );

      expect(host.renders, isNotEmpty);
      expect(lastText(), contains('Timers: waiting'));
      expect(lastText(), contains('Ticks: 0'));

      // The app schedules a 10 ms and a 30 ms timeout, then clears a 15 ms
      // interval 50 ms in. Every wake-up is a real Dart `Timer` the host set
      // from the delay the bundle asked for, so a little slack is all it needs.
      await Future<void>.delayed(const Duration(milliseconds: 400));
      final text = lastText();
      expect(text, contains('Timers: early,late'), reason: text);
      expect(text, contains('Ticks: 3'), reason: text);
      expect(text, contains('Aborted: true'));
      expect(text, contains('1.234.567,5'), reason: 'the Intl polyfill ran');

      // `console.warn`/`debug` reached the host through the log channel.
      expect(host.logs, contains(startsWith('warn: this is a warning')));
    },
    skip: !File(envDemo).existsSync()
        ? 'Build the env-demo example first'
        : (Platform.isWindows || Platform.isLinux) && quickJsLibrary == null
        ? 'QuickJS shared library not found'
        : false,
  );
}
