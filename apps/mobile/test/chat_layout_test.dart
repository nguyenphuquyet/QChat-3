import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/core/design_system/components.dart';
import 'test_app.dart';

void main() {
  testWidgets('single line bubbles align with avatars and longer text grows', (
    tester,
  ) async {
    for (final mine in [true, false]) {
      for (final text in ['ghg', 'đ', 'Xin chào\nDòng thứ hai']) {
        await tester.pumpWidget(
          qchatHarness(
            QChatChatBubble(
              mine: mine,
              name: 'Quyết',
              avatar: const SizedBox(
                key: Key('avatar'),
                width: 42,
                height: 42,
              ),
              bubbleWrapper: (bubble) =>
                  SizedBox(key: const Key('bubble'), child: bubble),
              child: Text(text),
            ),
          ),
        );
        final avatar = tester.getRect(find.byKey(const Key('avatar')));
        final bubble = tester.getRect(find.byKey(const Key('bubble')));
        expect(bubble.top, avatar.top);
        if (!text.contains('\n')) {
          expect(bubble.bottom, closeTo(avatar.bottom, .01));
        } else {
          expect(bubble.height, greaterThan(avatar.height));
        }
        expect(tester.takeException(), isNull);
      }
    }
  });
  testWidgets(
    'conversation timestamp shares title row and preview uses full width',
    (tester) async {
      await tester.pumpWidget(
        qchatHarness(
          SizedBox(
            width: 320,
            child: QChatConversationTile(
              name: 'Quyết',
              preview: 'Tin nhắn gần nhất',
              time: 'Hôm qua 14:42',
              onTap: () {},
            ),
          ),
        ),
      );
      final time = tester.getRect(find.text('Hôm qua 14:42'));
      final name = tester.getRect(find.text('Quyết').last);
      final preview = tester.getRect(find.text('Tin nhắn gần nhất'));
      expect(time.top, lessThan(name.bottom));
      expect(time.bottom, lessThan(preview.top));
      expect(tester.takeException(), isNull);
    },
  );
}
