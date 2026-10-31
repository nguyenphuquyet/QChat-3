import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/features/chats/red_packet_design.dart';
import 'package:qchat/features/payments/red_packet_cover_preview_screen.dart';

import 'test_app.dart';

void main() {
  const cover = RedPacketCoverData(
    id: 'cover-1',
    name: 'Mai vàng',
    design: CoverDesign(),
  );

  Future<void> open(WidgetTester tester) async {
    await tester.tap(find.byKey(const ValueKey('open-preview')));
    await tester
        .pump(); // builds the route; its post-frame callback starts the clock
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

  double cardOpacity(WidgetTester tester) => tester
      .widget<FadeTransition>(find.byKey(const ValueKey('cover-preview-fade')))
      .opacity
      .value;

  double scrimOpacity(WidgetTester tester) => tester
      .widget<FadeTransition>(find.byKey(const ValueKey('cover-preview-scrim')))
      .opacity
      .value;

  testWidgets('the scrim fades in instead of snapping on', (tester) async {
    await tester.pumpWidget(harness());
    await open(tester);

    // The overlay is a plain scrim: no backdrop filter, which used to drop
    // frames while its radius animated and made the veil appear in one step.
    expect(find.byType(BackdropFilter), findsNothing);
    expect(find.byKey(const ValueKey('cover-preview-scrim')), findsOneWidget);

    await tester.pump(const Duration(milliseconds: 80));
    expect(scrimOpacity(tester), greaterThan(0.02));
    expect(scrimOpacity(tester), lessThan(0.6));
    final opacity = cardOpacity(tester);
    expect(opacity, greaterThan(0));
    expect(opacity, lessThan(1));

    await tester.pump(const Duration(milliseconds: 400));
    expect(scrimOpacity(tester), 1);
    expect(cardOpacity(tester), 1);
  });

  testWidgets('tapping the scrim fades the preview out', (tester) async {
    await tester.pumpWidget(harness());
    await open(tester);
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.byType(RedPacketCoverPreviewScreen), findsOneWidget);

    // Tap the scrim, well away from the card in the middle.
    await tester.tapAt(const Offset(8, 8));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 80));

    // The scrim must already be visibly clearing. With an ease-out curve on
    // both directions it sat near-opaque here and then vanished at the end,
    // which read as "no animation".
    expect(cardOpacity(tester), lessThan(.6));
    expect(scrimOpacity(tester), lessThan(.6));
    expect(find.byType(RedPacketCoverPreviewScreen), findsOneWidget);

    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump(const Duration(milliseconds: 20));
    expect(find.byType(RedPacketCoverPreviewScreen), findsNothing);
  });
}
