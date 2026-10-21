import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/core/network/client.dart';
import 'package:qchat/core/storage/database.dart';

class ControlledTransport implements HttpClientAdapter {
  final started = Completer<RequestOptions>();
  final response = Completer<ResponseBody>();
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? stream,
    Future<void>? cancelFuture,
  ) {
    started.complete(options);
    return response.future;
  }

  @override
  void close({bool force = false}) {}
}

Future<void> settled(QChatClient client) async {
  for (var n = 0; n < 100 && client.flushing; n++) {
    await Future<void>.delayed(const Duration(milliseconds: 10));
  }
  expect(client.flushing, false);
}

void main() {
  test(
    'concurrent history and send acknowledgement preserve both messages',
    () async {
      final db = LocalDatabase.testing(NativeDatabase.memory());
      await Future.wait([
        db.mergeMessages('chat', [
          {'id': 'incoming', 'sequence': 1},
        ]),
        db.mergeMessages('chat', [
          {'id': 'outgoing', 'sequence': 2},
        ]),
      ]);
      final cached = await db.read('messages:chat') as List;
      expect(cached.map((m) => m['id']), ['incoming', 'outgoing']);
      expect(await db.read('cursor:chat'), isNull);
      await db.close();
    },
  );
  test(
    'optimistic message appears before HTTP, then merges acknowledgement once',
    () async {
      final client = QChatClient()
        ..userId = 'me'
        ..local = LocalDatabase.testing(NativeDatabase.memory());
      final transport = ControlledTransport();
      client.dio.httpClientAdapter = transport;
      final sending = client.send('chat', 'Hello');
      final optimistic = client.visibleMessages('chat', []);
      expect(optimistic.single['text'], 'Hello');
      expect(client.messageStatus(optimistic.single, []), 'sending');
      await sending;
      final request = await transport.started.future;
      final message = {
        ...request.data as Map,
        'id': 'server-id',
        'conversationId': 'chat',
        'senderId': 'me',
        'sequence': 1,
        'createdAt': '2026-10-19T12:00:00Z',
      };
      transport.response.complete(
        ResponseBody.fromString(
          jsonEncode(message),
          200,
          headers: {
            Headers.contentTypeHeader: ['application/json'],
          },
        ),
      );
      await settled(client);
      final rows = client.visibleMessages('chat', optimistic);
      expect(rows.length, 1);
      expect(rows.single['id'], 'server-id');
      expect(client.messageStatus(rows.single, []), 'sent');
      expect(await client.local!.pending(), isEmpty);
      expect(
        (await client.local!.read('messages:chat')).single['id'],
        'server-id',
      );
      await client.local!.close();
    },
  );

  test('failed send survives and retries with the same client ID', () async {
    final client = QChatClient()
      ..userId = 'me'
      ..local = LocalDatabase.testing(NativeDatabase.memory());
    final first = ControlledTransport();
    client.dio.httpClientAdapter = first;
    await client.send('chat', 'Offline');
    final original = await first.started.future;
    first.response.complete(ResponseBody.fromString('{}', 503));
    await settled(client);
    expect(
      client.messageStatus(client.visibleMessages('chat', []).single, []),
      'sendFailed',
    );
    expect((await client.local!.pending()).single['failed'], true);
    final retry = ControlledTransport();
    client.dio.httpClientAdapter = retry;
    final flushing = client.flush();
    final request = await retry.started.future;
    expect(request.data['clientId'], original.data['clientId']);
    expect(
      client.messageStatus(client.visibleMessages('chat', []).single, []),
      'sending',
    );
    retry.response.complete(
      ResponseBody.fromString(
        jsonEncode({
          ...request.data as Map,
          'id': 'saved',
          'conversationId': 'chat',
          'senderId': 'me',
          'sequence': 1,
          'createdAt': '2026-10-19T12:00:00Z',
        }),
        200,
        headers: {
          Headers.contentTypeHeader: ['application/json'],
        },
      ),
    );
    await flushing;
    expect(
      client.messageStatus(client.visibleMessages('chat', []).single, []),
      'sent',
    );
    await client.local!.close();
  });

  test(
    'receipt status requires every peer and never regresses from live receipts',
    () {
      final client = QChatClient()..userId = 'me';
      final message = <String, dynamic>{
        'conversationId': 'chat',
        'sequence': 4,
      };
      final peers = [
        {'userId': 'peer', 'readSequence': 0, 'deliveredSequence': 0},
      ];
      expect(client.messageStatus(message, peers), 'sent');
      client.receipts['chat:peer'] = {'deliveredSequence': 4};
      expect(client.messageStatus(message, peers), 'delivered');
      client.receipts['chat:peer']!['readSequence'] = 4;
      expect(client.messageStatus(message, peers), 'read');
      expect(
        client.messageStatus(message, [
          ...peers,
          {'userId': 'other'},
        ]),
        'sent',
      );
    },
  );
}
