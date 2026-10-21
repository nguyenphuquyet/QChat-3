import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qchat/app/providers.dart';
import 'package:qchat/core/network/client.dart';
import 'package:qchat/features/search/search_screen.dart';

class SearchClient extends QChatClient {
  final requests = <String, Completer<dynamic>>{};
  @override
  Future<dynamic> get(String path, {bool cached = true}) {
    final result = Completer<dynamic>();
    requests[path] = result;
    return result.future;
  }
}

void main() {
  testWidgets('search ignores stale results and never calls user lookup', (tester) async {
    final client = SearchClient();
    addTearDown(client.dispose);
    await tester.pumpWidget(ProviderScope(
      overrides: [clientProvider.overrideWithValue(client)],
      child: const MaterialApp(home: Material(child: SearchScreen())),
    ));
    await tester.enterText(find.byType(EditableText), 'old');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.enterText(find.byType(EditableText), 'new');
    await tester.pump(const Duration(milliseconds: 400));
    client.requests['/search?q=new']!.complete({
      'friends': [], 'conversations': [],
      'messages': [{'text': 'New result', 'sender': {'nickname': 'Alice'}, 'conversationId': 'chat'}],
    });
    await tester.pumpAndSettle();
    client.requests['/search?q=old']!.complete({
      'friends': [], 'conversations': [],
      'messages': [{'text': 'Stale result', 'sender': {'nickname': 'Bob'}, 'conversationId': 'chat'}],
    });
    await tester.pumpAndSettle();
    expect(find.text('New result'), findsOneWidget);
    expect(find.text('Stale result'), findsNothing);
    expect(client.requests.keys.every((p) => p.startsWith('/search?')), isTrue);
    await tester.enterText(find.byType(EditableText), '');
    await tester.pumpAndSettle();
    expect(find.text('New result'), findsNothing);
  });
}
