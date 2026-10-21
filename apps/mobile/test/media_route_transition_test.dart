import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:qchat/app/providers.dart';
import 'package:qchat/features/chats/media_screen.dart';
import 'package:qchat/main.dart';

import 'reference_ui_test.dart' show PreviewClient;

class DelayedMediaClient extends PreviewClient {
  final access = Completer<Map<String, dynamic>>();
  @override
  Future<dynamic> get(String path, {bool cached = true}) {
    if (path == '/media/m1/access') return access.future;
    return super.get(path, cached: cached);
  }
}

void main() {
  testWidgets(
    'thumbnail flies immediately while media access is still pending',
    (tester) async {
      final client = DelayedMediaClient();
      final router = GoRouter(
        initialLocation: '/home',
        routes: [
          GoRoute(
            path: '/home',
            builder: (_, _) => const Scaffold(
              body: Align(
                alignment: Alignment.bottomLeft,
                child: Hero(
                  tag: 'message-first',
                  child: SizedBox(
                    key: ValueKey('source-frame'),
                    width: 100,
                    height: 150,
                    child: ColoredBox(color: Colors.red),
                  ),
                ),
              ),
            ),
          ),
          qchatMediaRoute(),
        ],
      );
      addTearDown(router.dispose);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [clientProvider.overrideWithValue(client)],
          child: MaterialApp.router(routerConfig: router),
        ),
      );
      await tester.pumpAndSettle();
      final original = tester.getRect(
        find.byKey(const ValueKey('source-frame')),
      );
      router.push('/media/m1', extra: 'message-first');
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 120));
      expect(client.access.isCompleted, isFalse);
      final flying = tester.getRect(find.byKey(const ValueKey('source-frame')));
      expect(flying.width, greaterThan(original.width));
      expect(flying.top, lessThan(original.top));
      expect(tester.takeException(), isNull);
      await tester.pumpAndSettle();
      router.pop();
      await tester.pumpAndSettle();
      expect(
        tester.getRect(find.byKey(const ValueKey('source-frame'))),
        original,
      );
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('media viewer fades in without sliding over the chat page', (
    tester,
  ) async {
    final router = GoRouter(
      initialLocation: '/home',
      routes: [
        GoRoute(
          path: '/home',
          builder: (_, _) => const Scaffold(body: Text('home')),
        ),
        qchatMediaRoute(),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [clientProvider.overrideWithValue(PreviewClient())],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();

    router.push('/media/m1');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 120));

    // A Cupertino page would still be sliding in from the right at this point.
    // The viewer must keep its final position so the shared-element zoom is the
    // only motion on top of the fading backdrop.
    final origin = tester.getTopLeft(find.byType(MediaScreen));
    expect(origin.dx, 0);
    expect(origin.dy, 0);

    final fades = tester.widgetList<FadeTransition>(
      find.ancestor(
        of: find.byType(MediaScreen),
        matching: find.byType(FadeTransition),
      ),
    );
    expect(
      fades.any((f) => f.opacity.value > 0 && f.opacity.value < 1),
      isTrue,
      reason: 'the viewer page should be mid-fade, not fully opaque',
    );
  });
}
