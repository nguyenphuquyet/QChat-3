import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/app/providers.dart';
import 'package:qchat/core/network/client.dart';
import 'package:qchat/features/payments/red_packet_cover_studio_screen.dart';

import 'test_app.dart';

/// The studio only reads the designer profile on open, so the rest of the
/// client is never touched by these tests.
class _StudioClient extends QChatClient {
  @override
  Future<dynamic> get(String path, {bool cached = true}) async => {
    'designer': {'userId': 'designer-1', 'displayName': 'Lan'},
  };
}

void main() {
  testWidgets('the video pill turns the flap into a clip', (tester) async {
    tester.view.physicalSize = const Size(1200, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [clientProvider.overrideWithValue(_StudioClient())],
        child: qchatHarness(const RedPacketCoverStudioScreen()),
      ),
    );
    await tester.pump();

    await tester.ensureVisible(find.text('Video'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Video'));
    await tester.pumpAndSettle();

    // A selected video with no clip yet must still ask for a video, not a photo.
    expect(find.text('Choose an MP4 video'), findsOneWidget);
    expect(find.text('Choose a photo'), findsNothing);
    expect(
      find.text('Photos fill the whole top; an MP4 video loops automatically.'),
      findsOneWidget,
    );
  });
}
