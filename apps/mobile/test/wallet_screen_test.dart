import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/app/providers.dart';
import 'package:qchat/core/design_system/components.dart';
import 'package:qchat/core/network/client.dart';
import 'package:qchat/features/payments/wallet_screen.dart';

import 'test_app.dart';

class _WalletClient extends QChatClient {
  @override
  Future<dynamic> get(String path, {bool cached = true}) async {
    if (path != '/wallet') return const {};
    return {
      'balance': 120000,
      'transactions': [
        {
          'id': 'tx1',
          'amount': 20000,
          'direction': 'in',
          'kind': 'transfer',
          'peerName': 'Cương',
          'note': '',
          'createdAt': '2026-11-01T09:30:00.000Z',
        },
      ],
    };
  }
}

/// The pill behind a tab is the `Container` inside the tappable area.
BoxDecoration _pill(WidgetTester tester, String key) {
  final container = tester.widget<Container>(
    find.descendant(
      of: find.byKey(ValueKey(key)),
      matching: find.byType(Container),
    ),
  );
  return container.decoration! as BoxDecoration;
}

Future<void> _mount(WidgetTester tester) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [clientProvider.overrideWithValue(_WalletClient())],
      child: qchatHarness(const WalletScreen(), locale: const Locale('vi')),
    ),
  );
  await tester.pump();
}

void main() {
  testWidgets('wallet tabs switch at once, leaving one pill', (tester) async {
    await _mount(tester);

    expect(find.text('Ví'), findsOneWidget);
    expect(find.text('Giao dịch'), findsOneWidget);
    expect(_pill(tester, 'wallet-tab-balance').color, QChatColors.white);
    expect(_pill(tester, 'wallet-tab-history').color, QChatColors.transparent);

    await tester.tap(find.byKey(const ValueKey('wallet-tab-history')));
    // One frame is enough: the pill never fades, so the old tab cannot stay
    // highlighted (or halfway to grey) while the new one lights up.
    await tester.pump();

    expect(_pill(tester, 'wallet-tab-balance').color, QChatColors.transparent);
    expect(_pill(tester, 'wallet-tab-history').color, QChatColors.white);

    // Switching back is just as immediate.
    await tester.tap(find.byKey(const ValueKey('wallet-tab-balance')));
    await tester.pump();

    expect(_pill(tester, 'wallet-tab-balance').color, QChatColors.white);
    expect(_pill(tester, 'wallet-tab-history').color, QChatColors.transparent);
  });
}
