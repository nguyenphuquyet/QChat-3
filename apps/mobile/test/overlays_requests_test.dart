import 'package:flutter/cupertino.dart' show CupertinoTextField;
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qchat/app/providers.dart';
import 'package:qchat/core/design_system/components.dart';
import 'package:qchat/features/contacts/friends_screen.dart';
import 'reference_ui_test.dart' show PreviewClient;
import 'test_app.dart';

class RequestClient extends PreviewClient {
  @override
  Future<dynamic> get(String path, {bool cached = true}) async {
    if (path == '/friends/requests') {
      return [
        {
          'id': 'request-1',
          'sender': {
            'id': 'peer',
            'nickname': 'Linh',
            'qchatId': 'linh_preview',
          },
        },
      ];
    }
    return super.get(path, cached: cached);
  }
}

void main() {
  testWidgets('new friends only shows incoming requests', (tester) async {
    final client = PreviewClient();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [clientProvider.overrideWithValue(client)],
        child: qchatHarness(
          const FriendsScreen(requestsOnly: true),
          locale: const Locale('vi'),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Bạn bè mới'), findsOneWidget);
    expect(find.text('Chưa có yêu cầu kết bạn'), findsOneWidget);
    expect(find.byType(CupertinoTextField), findsNothing);
    expect(find.text('QChat ID'), findsNothing);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
    await client.changes.close();
    await client.messageChanges.close();
  });

  testWidgets('a request offers their profile above accept', (tester) async {
    final client = RequestClient();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [clientProvider.overrideWithValue(client)],
        child: qchatHarness(
          const FriendsScreen(requestsOnly: true),
          locale: const Locale('vi'),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Linh'));
    await tester.pumpAndSettle();
    expect(find.text('Xem hồ sơ'), findsOneWidget);
    expect(find.text('Chấp nhận'), findsOneWidget);
    expect(find.text('Từ chối'), findsOneWidget);
    // The profile entry sits on top of the response actions.
    expect(
      tester.getTopLeft(find.text('Xem hồ sơ')).dy,
      lessThan(tester.getTopLeft(find.text('Chấp nhận')).dy),
    );
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
    await client.changes.close();
    await client.messageChanges.close();
  });

  for (final dark in [false, true]) {
    testWidgets('sheet scrolls and dismisses in dark=$dark', (tester) async {
      tester.view.physicalSize = const Size(320, 480);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      var selected = false;
      await tester.pumpWidget(
        qchatHarness(
          Builder(
            builder: (c) => GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => qchatSheet(c, [
                for (var i = 0; i < 20; i++)
                  ('Action $i', () => selected = true),
              ]),
              child: const ColoredBox(
                color: QChatColors.background,
                child: Center(child: Text('Open')),
              ),
            ),
          ),
          dark: dark,
        ),
      );
      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await tester.tap(find.text('Action 0'));
      await tester.pumpAndSettle();
      expect(selected, isTrue);
      expect(find.text('Action 0'), findsNothing);
    });
  }
}
