import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/core/network/client.dart';
import 'package:qchat/features/miniapps/miniapp_api.dart';
import 'package:qchat/features/miniapps/miniapp_bridge.dart';
import 'package:qchat/features/miniapps/miniapp_storage.dart';

const _appId = 'mp_0123456789abcdef';

class FakeApi extends MiniAppApi {
  FakeApi() : super(QChatClient());

  final requests = <Map<String, dynamic>>[];
  Completer<Map<String, dynamic>>? friendsGate;

  @override
  Future<Map<String, dynamic>> me() async => {
    'id': 'user-1',
    'qchatId': 'quyet',
    'nickname': 'Quyet',
    'avatarId': null,
  };

  @override
  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? query,
    Object? body,
  }) async {
    requests.add({'path': path, 'method': method, 'query': query, 'body': body});
    if (path == '/friends' && friendsGate != null) {
      return friendsGate!.future;
    }
    return {
      'items': [
        {'id': 'friend-1'},
      ],
    };
  }
}

class Harness {
  Harness(
    this.storage, {
    List<String> permissions = const [
      'toast',
      'user.profile',
      'media.choose',
      'share',
      'storage',
      'qchat.api',
    ],
    Set<String> granted = const {},
    bool allowPermission = true,
    bool shareResult = true,
  }) {
    bridge = MiniAppBridge(
      appId: _appId,
      appName: 'Demo',
      version: '1.0.0',
      entry: 'index.html',
      runtimeVersion: '1.0.0',
      minRuntimeVersion: '1.0.0',
      permissions: permissions,
      api: api,
      storage: storage,
      granted: granted,
      requestPermission: (permission) async {
        permissionRequests.add(permission);
        return allowPermission;
      },
      onToast: (message, icon) => toasts.add({'message': message, 'icon': icon}),
      onShare: (text, url, title) async {
        shares.add({'text': text, 'url': url, 'title': title});
        return shareResult;
      },
      onNavigate: (path) async => navigations.add(path),
      onClose: () => closes++,
      onResponse: responses.add,
      systemInfo: () => {
        'platform': 'android',
        'osVersion': '14',
        'appVersion': '1.1.0',
        'runtimeVersion': '1.0.0',
        'locale': 'vi',
        'theme': 'light',
        'screenWidth': 400.0,
        'screenHeight': 800.0,
        'pixelRatio': 2.0,
        'safeAreaTop': 24.0,
        'safeAreaBottom': 0.0,
      },
    );
  }

  final api = FakeApi();
  final MiniAppStorage storage;
  late final MiniAppBridge bridge;
  final responses = <String>[];
  final toasts = <Map<String, String>>[];
  final shares = <Map<String, String>>[];
  final navigations = <String>[];
  final permissionRequests = <String>[];
  int closes = 0;

  Future<Map<String, dynamic>> call(
    String method, {
    Object? params,
    String? id,
  }) async {
    await bridge.handle(
      jsonEncode({
        'id': id ?? 'req-${responses.length + 1}',
        'method': method,
        'params': params ?? const <String, dynamic>{},
      }),
    );
    expect(responses, isNotEmpty, reason: '$method did not reply');
    return jsonDecode(responses.last) as Map<String, dynamic>;
  }

  Map<String, dynamic>? errorOf(Map<String, dynamic> response) =>
      response['error'] is Map
      ? Map<String, dynamic>.from(response['error'] as Map)
      : null;
}

void main() {
  late Directory root;
  late Harness harness;

  setUp(() async {
    root = await Directory.systemTemp.createTemp('qchat-bridge-test');
    harness = Harness(await MiniAppStorage.open(root.path, _appId));
  });

  tearDown(() async {
    harness.bridge.dispose();
    if (await root.exists()) await root.delete(recursive: true);
  });

  test('getAppInfo needs no permission and returns the build metadata', () async {
    final response = await harness.call('getAppInfo');
    expect(response['ok'], isTrue);
    final result = response['result'] as Map<String, dynamic>;
    expect(result['appId'], _appId);
    expect(result['version'], '1.0.0');
    expect(result['permissions'], contains('storage'));
    expect(harness.permissionRequests, isEmpty);
  });

  test('getSystemInfo returns the host values', () async {
    final response = await harness.call('getSystemInfo');
    final result = response['result'] as Map<String, dynamic>;
    expect(result['platform'], 'android');
    expect(result['locale'], 'vi');
    expect(result['screenWidth'], 400.0);
  });

  test('a declared permission is requested once and remembered', () async {
    final first = await harness.call('showToast', params: {'message': 'Hi'});
    expect(first['ok'], isTrue);
    expect(harness.permissionRequests, ['toast']);
    expect(harness.toasts.single['message'], 'Hi');
    expect(harness.bridge.granted, contains('toast'));

    final second = await harness.call('showToast', params: {'message': 'Again'});
    expect(second['ok'], isTrue);
    expect(harness.permissionRequests, ['toast']);
    expect(harness.toasts.length, 2);
  });

  test('denied permissions return PERMISSION_DENIED and do not run', () async {
    final denied = Harness(harness.storage, allowPermission: false);
    addTearDown(denied.bridge.dispose);
    final response = await denied.call('showToast', params: {'message': 'Hi'});
    expect(denied.errorOf(response)?['code'], 'PERMISSION_DENIED');
    expect(denied.toasts, isEmpty);
  });

  test('a permission missing from the manifest is rejected without a prompt', () async {
    final limited = Harness(
      harness.storage,
      permissions: const ['toast'],
    );
    addTearDown(limited.bridge.dispose);
    final response = await limited.call('getUserInfo');
    expect(limited.errorOf(response)?['code'], 'PERMISSION_DENIED');
    expect(limited.permissionRequests, isEmpty);
  });

  test('invalid arguments are rejected before the host runs them', () async {
    final long = 'x' * 201;
    final response = await harness.call(
      'showToast',
      params: {'message': long},
    );
    expect(harness.errorOf(response)?['code'], 'INVALID_ARGUMENT');
    expect(harness.toasts, isEmpty);

    final traversal = await harness.call(
      'navigateTo',
      params: {'path': '/../secret'},
    );
    expect(harness.errorOf(traversal)?['code'], 'INVALID_ARGUMENT');
    expect(harness.navigations, isEmpty);
  });

  test('request rejects paths outside the allowlist', () async {
    final response = await harness.call(
      'request',
      params: {'path': '/admin'},
    );
    expect(harness.errorOf(response)?['code'], 'PERMISSION_DENIED');
    expect(harness.api.requests, isEmpty);
  });

  test('request maps /friends to user.profile and returns raw data', () async {
    final response = await harness.call(
      'request',
      params: {
        'path': '/friends?limit=10',
        'method': 'GET',
        'query': {'limit': 10},
      },
    );
    expect(response['ok'], isTrue);
    final result = response['result'] as Map<String, dynamic>;
    expect(result['items'], isA<List<dynamic>>());
    expect(harness.api.requests.single['path'], '/friends');
    expect(harness.permissionRequests, ['user.profile']);
  });

  test('request /conversations needs qchat.api', () async {
    final response = await harness.call(
      'request',
      params: {'path': '/conversations'},
    );
    expect(response['ok'], isTrue);
    expect(harness.permissionRequests, ['qchat.api']);
  });

  test('storage round-trips through the bridge', () async {
    final set = await harness.call(
      'setStorage',
      params: {'key': 'counter', 'value': {'value': 3}},
    );
    expect(set['ok'], isTrue);
    final get = await harness.call('getStorage', params: {'key': 'counter'});
    expect((get['result'] as Map<String, dynamic>)['value'], {'value': 3});
    final remove = await harness.call('removeStorage', params: {'key': 'counter'});
    expect(remove['ok'], isTrue);
    final empty = await harness.call('getStorage', params: {'key': 'counter'});
    expect((empty['result'] as Map<String, dynamic>)['value'], isNull);
  });

  test('storage rejects bad keys and oversized values', () async {
    final key = await harness.call(
      'setStorage',
      params: {'key': 'bad key', 'value': 1},
    );
    expect(harness.errorOf(key)?['code'], 'INVALID_ARGUMENT');

    final large = await harness.call(
      'setStorage',
      params: {'key': 'large', 'value': 'x' * 70000},
    );
    expect(harness.errorOf(large)?['code'], 'STORAGE_QUOTA_EXCEEDED');
  });

  test('share and close are forwarded to the host', () async {
    final share = await harness.call(
      'share',
      params: {'text': 'Hello', 'url': 'https://qchat.example'},
    );
    expect((share['result'] as Map<String, dynamic>)['shared'], isTrue);
    expect(harness.shares.single['text'], 'Hello');

    final close = await harness.call('closeMiniApp');
    expect(close['ok'], isTrue);
    expect(harness.closes, 1);
  });

  test('unknown methods and malformed messages are ignored safely', () async {
    final unknown = await harness.call('runShell');
    expect(harness.errorOf(unknown)?['code'], 'NOT_SUPPORTED');

    await harness.bridge.handle('not json');
    await harness.bridge.handle(jsonEncode({'method': 'getAppInfo'}));
    await harness.bridge.handle(
      jsonEncode({'id': 'bad id!', 'method': 'getAppInfo', 'params': {}}),
    );
    expect(harness.responses.length, 1);
  });

  test('a duplicate in-flight id runs once', () async {
    harness.api.friendsGate = Completer<Map<String, dynamic>>();
    final first = harness.bridge.handle(
      jsonEncode({
        'id': 'same-id',
        'method': 'request',
        'params': {'path': '/friends'},
      }),
    );
    await harness.bridge.handle(
      jsonEncode({
        'id': 'same-id',
        'method': 'request',
        'params': {'path': '/friends'},
      }),
    );
    expect(harness.api.requests.length, 1);
    harness.api.friendsGate!.complete({'items': []});
    await first;
    expect(harness.responses.length, 1);
    expect((jsonDecode(harness.responses.single) as Map)['ok'], isTrue);
  });

  test('calls over the rate limit fail with RATE_LIMITED', () async {
    for (var i = 0; i < 30; i++) {
      final response = await harness.call('getAppInfo');
      expect(response['ok'], isTrue, reason: 'call $i should pass');
    }
    final blocked = await harness.call('getAppInfo');
    expect(harness.errorOf(blocked)?['code'], 'RATE_LIMITED');
  });

  test('dispose stops further replies', () async {
    harness.bridge.dispose();
    await harness.bridge.handle(
      jsonEncode({'id': 'after', 'method': 'getAppInfo', 'params': {}}),
    );
    expect(harness.responses, isEmpty);
  });

  test('qchatReceiveScript escapes the payload as a JS string', () {
    final script = qchatReceiveScript('{"text":"a\\"b"}');
    expect(script, startsWith('window.__QChatReceive && window.__QChatReceive('));
    expect(script, contains('\\"'));
  });
}
