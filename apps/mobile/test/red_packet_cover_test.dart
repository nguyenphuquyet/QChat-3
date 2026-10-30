import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/features/chats/money_message.dart';
import 'package:qchat/features/chats/red_packet_cover.dart';
import 'package:qchat/features/chats/red_packet_design.dart';

import 'test_app.dart';

void main() {
  testWidgets(
    'cover keeps the top and bottom halves separate around the arch',
    (tester) async {
      var opened = 0;
      await tester.pumpWidget(
        qchatHarness(
          RedPacketCover(
            sender: const {'nickname': 'Cương'},
            senderName: 'Cương',
            greeting: 'Best wishes',
            mine: false,
            opening: false,
            onOpen: () => opened++,
          ),
        ),
      );
      await tester.pump();

      final top = find.byKey(const ValueKey('red-packet-cover-top'));
      final bottom = find.byKey(const ValueKey('red-packet-cover-bottom'));
      expect(top, findsOneWidget);
      expect(bottom, findsOneWidget);
      expect(
        tester.getTopLeft(bottom).dy,
        greaterThan(tester.getTopLeft(top).dy),
      );

      expect(find.text('Đã gửi bởi Cương'), findsOneWidget);
      expect(find.text('Best wishes'), findsOneWidget);
      expect(find.text('Mở'), findsOneWidget);
      expect(
        find.byKey(const ValueKey('red-packet-cover-seam')),
        findsOneWidget,
      );

      // The open button straddles the seam: its centre is the lowest point of
      // the arch, which is also the bottom edge of the top half.
      final seam = tester.getBottomLeft(top).dy;
      final button = tester.getCenter(
        find.byKey(const ValueKey('red-packet-cover-open')),
      );
      expect(button.dy, moreOrLessEquals(seam, epsilon: .5));

      await tester.tap(find.byKey(const ValueKey('red-packet-cover-open')));
      expect(opened, 1);
    },
  );

  testWidgets('the designer can hide the seam and keep a flat cover', (
    tester,
  ) async {
    await tester.pumpWidget(
      qchatHarness(
        RedPacketCover(
          design: const CoverDesign(archLine: false),
          sender: const {'nickname': 'Cương'},
          senderName: 'Cương',
          greeting: 'Hồng bao',
          mine: false,
          opening: false,
        ),
      ),
    );
    await tester.pump();

    expect(find.byKey(const ValueKey('red-packet-cover-seam')), findsNothing);
    expect(find.byKey(const ValueKey('red-packet-cover-top')), findsOneWidget);
  });

  testWidgets('sender sees the sent state instead of the open button', (
    tester,
  ) async {
    await tester.pumpWidget(
      qchatHarness(
        RedPacketCover(
          sender: const {'nickname': 'Cương'},
          senderName: 'Cương',
          greeting: 'Best wishes',
          mine: true,
          opening: false,
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Đã gửi'), findsOneWidget);
    expect(find.text('Mở'), findsNothing);
  });

  testWidgets('a packet without a greeting is called Hồng bao', (tester) async {
    await tester.pumpWidget(
      qchatHarness(
        MoneyMessageCard(
          message: const {
            'kind': 'RED_PACKET',
            'text': '{"amount":1000,"note":""}',
          },
          mine: false,
          onTap: () {},
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Hồng bao'), findsOneWidget);
    expect(find.text('Chúc mừng năm mới'), findsNothing);
  });
}
