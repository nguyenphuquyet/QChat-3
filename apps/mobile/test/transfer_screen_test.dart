import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:qchat/app/providers.dart';
import 'package:qchat/core/design_system/components.dart';
import 'package:qchat/core/network/client.dart';
import 'package:qchat/features/payments/transfer_screen.dart';
import 'package:qchat/main.dart';

import 'test_app.dart';

/// The send sheet asks for the account's active cover; tests answer with an
/// empty gallery so no real request leaves the widget tree.
class _CoversClient extends QChatClient {
  @override
  Future<dynamic> get(String path, {bool cached = true}) async =>
      path == '/wallet/covers' ? {'items': <dynamic>[]} : {};
}

/// Accepts the wallet call so the sheet can finish and report success.
class _SendingClient extends _CoversClient {
  final transfers = <Map<String, dynamic>>[];
  @override
  Future<dynamic> post(String path, Object data) async {
    if (path != '/wallet/transfer') return {};
    transfers.add(Map<String, dynamic>.from(data as Map));
    return {'balance': 985000};
  }
}

/// A tiny chat stand-in: tapping it opens the sheet and remembers the result
/// the sheet pops with, which is how the real chat learns that it must refresh.
class _TransferHost extends StatelessWidget {
  const _TransferHost({required this.onResult});
  final void Function(bool?) onResult;
  @override
  Widget build(BuildContext context) => GestureDetector(
    behavior: HitTestBehavior.opaque,
    onTap: () async {
      onResult(
        await context.push<bool>(
          '/payments/transfer?to=zyg0978&name=C%C6%B0%C6%A1ng&red=1',
        ),
      );
    },
    child: const ColoredBox(
      color: QChatColors.background,
      child: SizedBox.expand(),
    ),
  );
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

  testWidgets('a sent red packet tells the chat to refresh', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final client = _SendingClient();
    bool? result;
    final router = GoRouter(
      initialLocation: '/chat',
      routes: [
        qchatRoute(
          path: '/chat',
          builder: (_, _) => _TransferHost(
            onResult: (value) => result = value,
          ),
        ),
        qchatRoute(
          path: '/payments/transfer',
          builder: (_, _) => const TransferScreen(
            to: 'zyg0978',
            name: 'Cương',
            redPacket: true,
          ),
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
    await tester.pumpAndSettle();
    await tester.tap(find.byType(_TransferHost));
    // The transfer sheet keeps a blinking caret alive, so pump the push
    // transition by hand instead of waiting for the tree to settle.
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    for (final key in ['5', '0', '0', '0']) {
      await tester.tap(find.byKey(ValueKey('keypad-$key')));
    }
    await tester.pump();
    await tester.tap(find.text('OK'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(client.transfers.single['kind'], 'RED_PACKET');
    expect(find.text('Đã gửi hồng bao'), findsOneWidget);
    await tester.tap(find.text('Xác nhận'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump(const Duration(milliseconds: 400));
    expect(result, isTrue);
    expect(find.byType(TransferScreen), findsNothing);
  });
}
