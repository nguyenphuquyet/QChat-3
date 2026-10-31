import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/app/providers.dart';
import 'package:qchat/core/design_system/components.dart';
import 'package:qchat/core/network/client.dart';
import 'package:qchat/features/payments/transfer_screen.dart';

import 'test_app.dart';

/// The send sheet asks for the account's active cover; tests answer with an
/// empty gallery so no real request leaves the widget tree.
class _CoversClient extends QChatClient {
  @override
  Future<dynamic> get(String path, {bool cached = true}) async =>
      path == '/wallet/covers' ? {'items': <dynamic>[]} : {};
}

void main() {
  testWidgets('transfer screen shows the recipient, card and keypad', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [clientProvider.overrideWithValue(_CoversClient())],
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
        overrides: [clientProvider.overrideWithValue(_CoversClient())],
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
          overrides: [clientProvider.overrideWithValue(_CoversClient())],
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

  testWidgets('a group red packet offers both split modes and the refund rule', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [clientProvider.overrideWithValue(_CoversClient())],
        child: qchatHarness(
          const TransferScreen(
            to: 'zyg0978',
            name: 'Cương',
            redPacket: true,
            group: true,
          ),
          locale: const Locale('vi'),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Cách chia'), findsOneWidget);
    expect(find.text('Chia đều'), findsOneWidget);
    expect(find.text('Chia ngẫu nhiên'), findsOneWidget);
    expect(find.textContaining('tự động hoàn về người gửi sau 24 giờ'), findsOneWidget);

    await tester.tap(find.text('Chia đều'));
    await tester.pump();
    expect(find.textContaining('Mỗi người nhận số tiền bằng nhau'), findsOneWidget);

    await tester.tap(find.text('Chia ngẫu nhiên'));
    await tester.pump();
    expect(find.textContaining('Số tiền mỗi người khác nhau'), findsOneWidget);
  });

  testWidgets('a one-to-one red packet has no split choice', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [clientProvider.overrideWithValue(_CoversClient())],
        child: qchatHarness(
          const TransferScreen(to: 'zyg0978', name: 'Cương', redPacket: true),
          locale: const Locale('vi'),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Cách chia'), findsNothing);
    expect(find.text('Chia đều'), findsNothing);
  });
}
