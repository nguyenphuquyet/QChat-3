import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/app/providers.dart';
import 'package:qchat/core/network/client.dart';
import 'package:qchat/features/payments/red_packet_designer_screen.dart';

import 'test_app.dart';

/// A designer with two covers and two packs, served without a server. The
/// linked QChat name is deliberately long so the hub has to ellipsise it.
class _StudioClient extends QChatClient {
  _StudioClient({this.covers = 2}) {
    userId = 'self';
  }

  final int covers;

  @override
  Future<dynamic> get(String path, {bool cached = true}) async {
    if (path == '/wallet/designer') {
      return {
        'designer': {
          'userId': 'self',
          'displayName': 'Mộc Studio',
          'bio': 'Phong bì đỏ vẽ tay, tối giản.',
          'user': {
            'nickname': 'Nguyễn Phú Quyết Minh Anh',
            'avatarId': '',
            'qchatId': 'qchat',
          },
          'covers': [
            for (var i = 0; i < covers; i++)
              {
                'id': 'c$i',
                'name': 'Phong bì số ${i + 1}',
                'status': i.isEven ? 'PUBLISHED' : 'DRAFT',
                'claimCount': (i + 1) * 7,
                'design': <String, dynamic>{},
              },
          ],
        },
      };
    }
    if (path == '/stickers') {
      return {
        'packs': [
          {
            'id': 'p0',
            'name': 'Bộ mèo lười',
            'mine': true,
            'added': false,
            'published': true,
            'stickers': [
              for (var s = 0; s < 5; s++)
                {
                  'id': 'p0-s$s',
                  'mediaId': '',
                  'label': '',
                  'packId': 'p0',
                  'position': s,
                },
            ],
          },
          {
            'id': 'p1',
            'name': 'Bộ đang vẽ',
            'mine': true,
            'added': false,
            'published': false,
            'stickers': const [],
          },
        ],
        'market': [],
        'recent': [],
      };
    }
    return const {};
  }
}

Future<void> _mount(WidgetTester tester, {int covers = 2}) async {
  final client = _StudioClient(covers: covers);
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [clientProvider.overrideWithValue(client)],
      child: qchatHarness(
        const RedPacketDesignerScreen(),
        locale: const Locale('vi'),
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
}

void main() {
  testWidgets('the hub keeps the profile, covers and sticker rail in view', (
    tester,
  ) async {
    await _mount(tester);
    expect(tester.takeException(), isNull);

    expect(find.text('Mộc Studio'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('designer-cover-menu-c0')),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey('designer-cover-menu-c1')),
      findsOneWidget,
    );

    // The packs live further down, in a rail after the covers.
    await tester.scrollUntilVisible(
      find.byKey(const ValueKey('sticker-workshop-create')),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pump();
    expect(tester.takeException(), isNull);
    expect(find.byKey(const ValueKey('workshop-pack-p0')), findsOneWidget);
    expect(find.byKey(const ValueKey('workshop-pack-p1')), findsOneWidget);
  });

  testWidgets('a cover menu publishes, edits and deletes it', (tester) async {
    await _mount(tester);

    await tester.tap(find.byKey(const ValueKey('designer-cover-menu-c1')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('Đăng'), findsOneWidget);
    expect(find.text('Sửa'), findsOneWidget);
    expect(find.text('Xoá'), findsOneWidget);
    await tester.pump(const Duration(seconds: 1));
  });

  testWidgets('an empty studio still offers the create actions', (
    tester,
  ) async {
    await _mount(tester, covers: 0);
    expect(tester.takeException(), isNull);

    expect(find.text('Chưa có vỏ nào. Hãy tạo vỏ đầu tiên.'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.byKey(const ValueKey('sticker-workshop-create')),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pump();
    expect(tester.takeException(), isNull);
  });
}
