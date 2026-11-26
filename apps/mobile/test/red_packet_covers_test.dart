import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/app/providers.dart';
import 'package:qchat/core/network/client.dart';
import 'package:qchat/features/payments/red_packet_cover_ui.dart';
import 'package:qchat/features/payments/red_packet_covers_screen.dart';

import 'test_app.dart';

class CoversClient extends QChatClient {
  final calls = <String>[];

  @override
  Future<dynamic> get(String path, {bool cached = true}) async {
    calls.add(path);
    if (path == '/wallet/covers') {
      return {
        'items': [
          {
            'id': 'cover-1',
            'name': 'Mai vàng',
            'status': 'PUBLISHED',
            'claimCount': 4,
            'selected': false,
            'owned': true,
            'design': {
              'topHeight': .7,
              'decorations': [
                {'id': 'blossom', 'value': '🌸', 'x': .5, 'y': .3, 'size': .2},
              ],
            },
            'designer': {
              'userId': 'designer-1',
              'displayName': 'Lan',
              'user': {'qchatId': 'lan01'},
            },
          },
        ],
      };
    }
    return {};
  }
}

Future<void> mount(
  WidgetTester tester,
  CoversClient client,
  Widget screen,
) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [clientProvider.overrideWithValue(client)],
      child: qchatHarness(screen, locale: const Locale('vi')),
    ),
  );
  // Cover artwork keeps a repeating decoration clock, so the screen never
  // settles. Two pumps are enough to resolve the network future.
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 80));
}

void main() {
  testWidgets('my covers lists the default and owned covers with actions', (
    tester,
  ) async {
    final client = CoversClient();
    await mount(tester, client, const RedPacketCoversScreen());

    expect(find.text('Vỏ hồng bao của tôi'), findsOneWidget);
    expect(find.text('Mặc định'), findsOneWidget);
    expect(find.text('Mai vàng'), findsOneWidget);
    expect(find.text('Tạo vỏ của tôi'), findsOneWidget);
    expect(find.text('Nhận vỏ'), findsOneWidget);
    expect(find.text('Không còn vỏ nào nữa, đi nhận'), findsOneWidget);
    expect(find.text('Vỏ đã hết hạn'), findsOneWidget);
    expect(client.calls, contains('/wallet/covers'));
  });

  testWidgets('pick mode offers the use action for every cover', (
    tester,
  ) async {
    await mount(
      tester,
      CoversClient(),
      const RedPacketCoversScreen(pick: true),
    );

    // Default cover and the owned cover are both pickable from the send sheet,
    // even when one of them is already the active cover.
    expect(find.text('Sử dụng'), findsNWidgets(2));
    expect(find.text('Đang dùng'), findsNothing);
  });

  testWidgets('a cover preview opens over a dimmed gallery', (tester) async {
    await mount(tester, CoversClient(), const RedPacketCoversScreen());

    await tester.tap(find.byType(CoverThumb).last);
    await tester.pump();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 320));

    expect(find.byKey(const ValueKey('cover-preview-close')), findsOneWidget);
    expect(find.byKey(const ValueKey('cover-preview-scrim')), findsOneWidget);
    // The gallery stays mounted behind the dialog instead of being replaced.
    expect(find.text('Vỏ hồng bao của tôi'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('cover-preview-close')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 340));
    expect(find.byKey(const ValueKey('cover-preview-close')), findsNothing);
  });
}
