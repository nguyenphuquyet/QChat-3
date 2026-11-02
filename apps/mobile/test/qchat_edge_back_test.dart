import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/core/design_system/components.dart';
import 'test_app.dart';

Widget _host({required VoidCallback onBack, required VoidCallback onTap}) =>
    qchatHarness(
      Stack(
        children: [
          Positioned.fill(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: onTap,
            ),
          ),
          Positioned(
            top: 0,
            left: 0,
            bottom: 0,
            child: QChatEdgeBack(onBack: onBack),
          ),
        ],
      ),
    );

void main() {
  void sized(WidgetTester tester) {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
  }

  testWidgets('a rightward drag from the left edge goes back', (tester) async {
    sized(tester);
    var backs = 0;
    await tester.pumpWidget(_host(onBack: () => backs += 1, onTap: () {}));
    await tester.dragFrom(const Offset(2, 400), const Offset(90, 0));
    await tester.pumpAndSettle();
    expect(backs, 1);
  });

  testWidgets('a short drag does not go back', (tester) async {
    sized(tester);
    var backs = 0;
    await tester.pumpWidget(_host(onBack: () => backs += 1, onTap: () {}));
    await tester.dragFrom(const Offset(2, 400), const Offset(18, 0));
    await tester.pumpAndSettle();
    expect(backs, 0);
  });

  testWidgets('a leftward drag does not go back', (tester) async {
    sized(tester);
    var backs = 0;
    await tester.pumpWidget(_host(onBack: () => backs += 1, onTap: () {}));
    await tester.dragFrom(const Offset(18, 400), const Offset(-90, 0));
    await tester.pumpAndSettle();
    expect(backs, 0);
  });

  testWidgets('a drag that reverses cancels the swipe', (tester) async {
    sized(tester);
    var backs = 0;
    await tester.pumpWidget(_host(onBack: () => backs += 1, onTap: () {}));
    final swipe = await tester.startGesture(const Offset(2, 400));
    await swipe.moveBy(const Offset(80, 0));
    await tester.pump();
    await swipe.moveBy(const Offset(-80, 0));
    await swipe.up();
    await tester.pumpAndSettle();
    expect(backs, 0);
  });

  testWidgets('the strip lets taps through to the page', (tester) async {
    sized(tester);
    var taps = 0;
    await tester.pumpWidget(
      _host(
        onBack: () => fail('a tap must not trigger the back swipe'),
        onTap: () => taps += 1,
      ),
    );
    await tester.tapAt(const Offset(8, 400));
    await tester.pumpAndSettle();
    expect(taps, 1);
  });
}
