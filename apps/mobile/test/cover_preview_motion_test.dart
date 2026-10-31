import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/features/chats/red_packet_design.dart';
import 'package:qchat/features/payments/red_packet_cover_preview_screen.dart';

import 'test_app.dart';

void main() {
  testWidgets('tapping the frosted backdrop fades the preview out', (
    tester,
  ) async {
    const cover = RedPacketCoverData(
      id: 'cover-1',
      name: 'Mai vàng',
      design: CoverDesign(),
    );
    await tester.pumpWidget(
      ProviderScope(
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
      ),
    );

    await tester.tap(find.byKey(const ValueKey('open-preview')));
    await tester.pumpAndSettle();
    expect(find.byType(RedPacketCoverPreviewScreen), findsOneWidget);

    // Tap the frosted backdrop, well away from the card in the middle.
    await tester.tapAt(const Offset(8, 8));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 80));

    // The scrim must already be visibly fading. With an ease-out curve on both
    // directions it sat near-opaque here and then vanished at the end, which
    // read as "no animation".
    final opacities = tester
        .widgetList<FadeTransition>(
          find.ancestor(
            of: find.byType(RedPacketCoverPreviewScreen),
            matching: find.byType(FadeTransition),
          ),
        )
        .map((fade) => fade.opacity.value)
        .toList();
    expect(opacities, isNotEmpty);
    expect(opacities.any((value) => value < .6), isTrue);
    expect(find.byType(RedPacketCoverPreviewScreen), findsOneWidget);

    await tester.pump(const Duration(milliseconds: 400));
    expect(find.byType(RedPacketCoverPreviewScreen), findsNothing);
  });
}
