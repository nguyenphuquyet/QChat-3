import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/core/design_system/components.dart';
import 'package:qchat/features/payments/transfer_screen.dart';

import 'test_app.dart';

void main() {
  testWidgets('transfer screen shows the recipient, card and keypad', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        child: qchatHarness(
          const TransferScreen(to: 'zyg0978', name: 'Cương'),
          locale: const Locale('vi'),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Chuyển tiền cho Cương'), findsOneWidget);
    expect(find.text('QChat ID: zyg0978'), findsOneWidget);
    expect(find.text('Khoản tiền đã chuyển'), findsOneWidget);
    expect(find.text('Thêm Ghi chú nhận tiền'), findsOneWidget);
    expect(find.byType(QChatKeypad), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('keypad-5')));
    await tester.tap(find.byKey(const ValueKey('keypad-0')));
    await tester.pump();
    expect(
      tester.widget<Text>(find.byKey(const ValueKey('transfer-amount'))).data,
      '50',
    );

    await tester.tap(find.byKey(const ValueKey('keypad-backspace')));
    await tester.pump();
    expect(
      tester.widget<Text>(find.byKey(const ValueKey('transfer-amount'))).data,
      '5',
    );
  });

  testWidgets('tapping the amount hides and shows the transfer keypad', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        child: qchatHarness(
          const TransferScreen(to: 'zyg0978', name: 'Cương'),
          locale: const Locale('vi'),
        ),
      ),
    );
    await tester.pump();

    expect(find.byType(QChatKeypad), findsOneWidget);
    await tester.tap(find.text('₫'));
    await tester.pump();
    expect(find.byType(QChatKeypad), findsNothing);
    await tester.tap(find.text('₫'));
    await tester.pump();
    expect(find.byType(QChatKeypad), findsOneWidget);
  });

  testWidgets(
    'red packet screen mirrors the send layout with an inline keypad',
    (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          child: qchatHarness(
            const TransferScreen(to: 'zyg0978', name: 'Cương', redPacket: true),
            locale: const Locale('vi'),
          ),
        ),
      );
      await tester.pump();

      expect(find.text('Gửi Hồng bao'), findsOneWidget);
      expect(find.text('Số tiền'), findsOneWidget);
      expect(find.text('₫0'), findsOneWidget);
      expect(find.text('Best wishes'), findsOneWidget);
      expect(find.text('Bìa Vỏ hồng bao'), findsOneWidget);
      expect(find.text('Gửi'), findsOneWidget);
      expect(find.byType(QChatKeypad), findsOneWidget);
      expect(find.text('OK'), findsOneWidget);

      for (final key in ['5', '0', '0', '0']) {
        await tester.tap(find.byKey(ValueKey('keypad-$key')));
      }
      await tester.pump();
      expect(find.text('₫5.000'), findsOneWidget);
      expect(find.text('5.000'), findsOneWidget);

      // The amount row toggles the keypad, like the transfer screen.
      await tester.tap(find.text('Số tiền'));
      await tester.pump();
      expect(find.byType(QChatKeypad), findsNothing);
      await tester.tap(find.text('Số tiền'));
      await tester.pump();
      expect(find.byType(QChatKeypad), findsOneWidget);
    },
  );
}
