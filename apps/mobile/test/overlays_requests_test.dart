import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tdesign_flutter/tdesign_flutter.dart';
import 'package:qchat/app/providers.dart';
import 'package:qchat/core/design_system/components.dart';
import 'package:qchat/core/design_system/qchat_theme.dart';
import 'package:qchat/features/contacts/friends_screen.dart';
import 'reference_ui_test.dart' show PreviewClient;

void main() {
  testWidgets('new friends only shows incoming requests', (tester) async {
    final client = PreviewClient();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [clientProvider.overrideWithValue(client)],
        child: MaterialApp(
          locale: const Locale('vi'),
          supportedLocales: const [Locale('vi')],
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          theme: qchatTheme(false),
          home: const FriendsScreen(requestsOnly: true),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Bạn bè mới'), findsOneWidget);
    expect(find.text('Chưa có yêu cầu kết bạn'), findsOneWidget);
    expect(find.byType(TInput), findsNothing);
    expect(find.text('QChat ID'), findsNothing);
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
        MaterialApp(
          theme: qchatTheme(dark),
          home: Builder(
            builder: (c) => Scaffold(
              body: TextButton(
                child: const Text('Open'),
                onPressed: () => qchatSheet(c, [
                  for (var i = 0; i < 20; i++)
                    ('Action $i', () => selected = true),
                ]),
              ),
            ),
          ),
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
