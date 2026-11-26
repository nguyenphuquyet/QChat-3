import 'package:flutter/cupertino.dart' show CupertinoPageRoute;
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:qchat/app/providers.dart';
import 'package:qchat/core/design_system/components.dart';
import 'package:qchat/features/chats/chat_screen.dart';
import 'package:qchat/features/chats/chat_details_screen.dart';
import 'package:qchat/main.dart';
import 'chat_features_test.dart' show FakeClient;
import 'test_app.dart';

void main() {
  testWidgets('chat details follows edge swipe and refreshes after dismissal', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final client = FakeClient();
    final router = GoRouter(
      initialLocation: '/home',
      routes: [
        qchatRoute(
          path: '/home',
          builder: (_, _) => const ColoredBox(color: QChatColors.background),
        ),
        qchatRoute(
          path: '/chat/chat',
          builder: (_, _) => const ChatScreen(id: 'chat'),
        ),
      ],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [clientProvider.overrideWithValue(client)],
        child: qchatRouterHarness(
          routerConfig: router,
          locale: const Locale('vi'),
        ),
      ),
    );
    router.push('/chat/chat');
    await tester.pumpAndSettle();
    await tester.tap(
      find.byWidgetPredicate((w) => w is QChatIconButton && w.icon == 'more'),
    );
    await tester.pumpAndSettle();
    final details = find.byType(ChatDetailsScreen);
    expect(
      ModalRoute.of(tester.element(details)),
      isA<CupertinoPageRoute<void>>(),
    );
    final reads = client.calls.where((p) => p == '/conversations/chat').length;
    final swipe = await tester.startGesture(const Offset(1, 400));
    await swipe.moveBy(const Offset(20, 0));
    await tester.pump();
    await swipe.moveBy(const Offset(80, 0));
    await tester.pump();
    expect(tester.getTopLeft(details).dx, greaterThan(0));
    expect(tester.getTopLeft(details).dx, lessThan(160));
    // Reverse the gesture: the details page must settle back without reloading.
    await swipe.moveBy(const Offset(-85, 0));
    await swipe.up();
    await tester.pumpAndSettle();
    expect(details, findsOneWidget);
    expect(tester.getTopLeft(details).dx, 0);
    expect(client.calls.where((p) => p == '/conversations/chat').length, reads);
    await tester.dragFrom(const Offset(1, 400), const Offset(320, 0));
    await tester.pump(const Duration(milliseconds: 16));
    expect(client.calls.where((p) => p == '/conversations/chat').length, reads);
    await tester.pumpAndSettle();
    expect(details, findsNothing);
    expect(
      client.calls.where((p) => p == '/conversations/chat').length,
      reads + 1,
    );
    expect(tester.takeException(), isNull);
  });
}
