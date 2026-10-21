import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:qchat/app/providers.dart';
import 'package:qchat/features/chats/media_screen.dart';
import 'package:qchat/main.dart';

import 'reference_ui_test.dart' show PreviewClient;

void main() {
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
