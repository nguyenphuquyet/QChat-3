import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/features/chats/cover_media_frame.dart';

import 'test_app.dart';

void main() {
  test('a picture that already fills the frame has no room to move', () {
    final limits = coverMediaLimits(const Size(100, 100), 1, 1);
    expect(limits.x, 0);
    expect(limits.y, 0);
  });

  test(
    'a wide picture slides sideways at rest and needs zoom to move down',
    () {
      final limits = coverMediaLimits(const Size(100, 100), 1, 2);
      expect(limits.x, closeTo(.5, 1e-9));
      expect(limits.y, 0);

      final zoomed = coverMediaLimits(const Size(100, 100), 2, 2);
      expect(zoomed.x, closeTo(1.5, 1e-9));
      expect(zoomed.y, closeTo(.5, 1e-9));
    },
  );

  test('a portrait picture in a wide bubble can drift vertically', () {
    // Frame 200x100, picture 1:1: cover makes it 200x200, so it already
    // overflows above and below by 50px each.
    final limits = coverMediaLimits(const Size(200, 100), 1, 1);
    expect(limits.x, 0);
    expect(limits.y, closeTo(.5, 1e-9));
  });

  test('unknown geometry only allows movement once zoomed in', () {
    final rest = coverMediaLimits(const Size(120, 80), 1, null);
    expect(rest.x, 0);
    expect(rest.y, 0);

    final zoomed = coverMediaLimits(const Size(120, 80), 2, null);
    expect(zoomed.x, closeTo(.5, 1e-9));
    expect(zoomed.y, closeTo(.5, 1e-9));
  });

  test('an unlaid-out box reports no movement', () {
    final limits = coverMediaLimits(Size.zero, 2, 1);
    expect(limits.x, 0);
    expect(limits.y, 0);
  });

  testWidgets('dragging the gesture surface pans the picture', (tester) async {
    double? offsetX;
    double? offsetY;
    await tester.pumpWidget(
      qchatHarness(
        Center(
          child: SizedBox(
            width: 200,
            height: 100,
            child: CoverMediaGesture(
              id: 'not-loaded-yet',
              scale: 2,
              offsetX: 0,
              offsetY: 0,
              onChanged: (scale, x, y) {
                offsetX = x;
                offsetY = y;
              },
            ),
          ),
        ),
      ),
    );

    await tester.pump();
    await tester.drag(find.byType(CoverMediaGesture), const Offset(-20, 10));
    await tester.pump();

    // 20px of a 200px frame and 10px of a 100px frame, in either direction the
    // picture had room for before the drag began.
    expect(offsetX, isNotNull);
    expect(offsetX!, lessThan(0));
    expect(offsetY, isNotNull);
    expect(offsetY!, greaterThan(0));
  });
}
