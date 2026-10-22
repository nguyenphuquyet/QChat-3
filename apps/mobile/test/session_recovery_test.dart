import 'dart:async';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/core/network/client.dart';

class RefreshTransport implements HttpClientAdapter {
  RefreshTransport(this.status);
  final int status;
  int calls = 0;
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? stream,
    Future<void>? cancelFuture,
  ) async {
    calls++;
    return ResponseBody.fromString(
      '{}',
      status,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  for (final status in [401, 503, 429]) {
    test('refresh $status only invalidates a rejected session', () async {
      FlutterSecureStorage.setMockInitialValues({
        'refreshToken': 'saved-token',
      });
      final client = QChatClient()..userId = 'user';
      final transport = RefreshTransport(status);
      client.refreshDio.httpClientAdapter = transport;
      addTearDown(client.dispose);
      await client.reconnect();
      expect(client.sessionExpired.value, status == 401);
      expect(client.offline.value, status == 503);
      if (status == 401) {
        await client.reconnect();
        expect(transport.calls, 1);
      }
    });
  }
  test('missing refresh token requests reauthentication', () async {
    FlutterSecureStorage.setMockInitialValues({});
    final client = QChatClient()..userId = 'user';
    addTearDown(client.dispose);
    await client.reconnect();
    expect(client.sessionExpired.value, true);
    expect(client.offline.value, false);
  });
}
