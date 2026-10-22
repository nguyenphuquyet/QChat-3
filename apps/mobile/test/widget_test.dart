import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qchat/main.dart';
import 'package:tdesign_flutter/tdesign_flutter.dart';
import 'package:qchat/features/auth/auth_screen.dart';
import 'package:qchat/core/design_system/qchat_theme.dart';

void main() {
  testWidgets('QChat authentication renders without Material navigation', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(430, 1000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(const ProviderScope(child: QChatApp()));
    await tester.pump();
    expect(find.text('Q'), findsNothing);
    expect(find.text('Chào mừng trở lại.'), findsOneWidget);
    expect(find.text('Đăng nhập'), findsOneWidget);
    expect(find.text('Tạo tài khoản'), findsOneWidget);
  });
  testWidgets(
    'registration remains usable on a narrow screen with the keyboard',
    (tester) async {
      tester.view.physicalSize = const Size(320, 700);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetViewInsets);
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            theme: qchatTheme(true),
            home: const Material(child: AuthScreen()),
          ),
        ),
      );
      await tester.pumpAndSettle();
      final create = find.text('Create account');
      await tester.ensureVisible(create);
      await tester.tap(create);
      await tester.pumpAndSettle();
      expect(find.byType(TInput), findsNWidgets(4));
      tester.view.viewInsets = const FakeViewPadding(bottom: 300);
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byType(TInput).last);
      await tester.enterText(find.byType(TInput).last, 'a-long-password');
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    },
  );
}
