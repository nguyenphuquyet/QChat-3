import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/features/chats/red_packet_design.dart';
import 'package:qchat/features/payments/red_packet_cover_preview_screen.dart';

import 'test_app.dart';

void main() {
  const cover = RedPacketCoverData(
    id: 'cover-1',
    name: 'Mai vÃ ng',
    design: CoverDesign(),
  );

  Future<void> open(WidgetTester tester) async {
    await tester.tap(find.byKey(const ValueKey('open-preview')));
    await tester.pump(); // build the route; its post-frame callback starts the clock
    await tester.pump(); // the controller's first tick lands at t = 0
  }

  Widget harness() => ProviderScope(
    child: qchatHarness(
      Builder(
        builder: (c) => GestureDetector(
          key: const ValueKey('open-preview'),
          behavior: HitTestBehavior.opaque,
          onTap: () => showRedPacketCoverPreview(c, cover),
          child: const SizedBox.expand(),
        ),
      ),
    ),
  );

  double cardOpacity(WidgetTester tester) {
    final fade = tester.widget<FadeTransition>(
      find.byKey(const ValueKey('cover-preview-fade')),
    );
    return fade.opacity.value;
  }

  double veilTint(WidgetTester tester) {
    final box = tester.widget<ColoredBox>(
      find
          .descendant(
            of: find.byType(BackdropFilter),
            matching: find.byType(ColoredBox),
          )
          .first,
    );
    return box.color.a;
  }

  testWidgets('the frosted veil grows in instead of snapping on', (
    tester,
  ) async {
    await tester.pumpWidget(harness());
    await open(tester);

    // The veil must be animated on its own layer. An opacity ancestor has no
    // backdrop to blur, so the frost appeared in one frame once the entrance
    // finished, which read as a jerk.
    expect(find.byKey(const ValueKey('cover-preview-fade')), findsOneWidget);
    expect(
      find.descendant(
        of: find.byKey(const ValueKey('cover-preview-fade')),
        matching: find.byType(BackdropFilter),
      ),
      findsNothing,
    );

    await tester.pump(const Duration(milliseconds: 80));
    final tint = veilTint(tester);
    expect(tint, greaterThan(0.01));
    expect(tint, lessThan(0.36));
    final opacity = cardOpacity(tester);
    expect(opacity, greaterThan(0));
    expect(opacity, lessThan(1));

    await tester.pump(const Duration(milliseconds: 400));
    expect(veilTint(tester), closeTo(0.46, 0.001));
    expect(cardOpacity(tester), 1);
  });

  testWidgets('tapping the frosted backdrop fades the preview out', (
    tester,
  ) async {
    await tester.pumpWidget(harness());
    await open(tester);
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.byType(RedPacketCoverPreviewScreen), findsOneWidget);

    // Tap the frosted backdrop, well away from the card in the middle.
    await tester.tapAt(const Offset(8, 8));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 80));

    // The scrim must already be visibly clearing. With an ease-out curve on
    // both directions it sat near-opaque here and then vanished at the end,
    // which read as "no animation".
    expect(cardOpacity(tester), lessThan(.6));
    expect(veilTint(tester), lessThan(0.2));
    expect(find.byType(RedPacketCoverPreviewScreen), findsOneWidget);

    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump(const Duration(milliseconds: 20));
    expect(find.byType(RedPacketCoverPreviewScreen), findsNothing);
  });
}
