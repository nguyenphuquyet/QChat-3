import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/core/design_system/components.dart';
import 'test_app.dart';

const _page = Key('page');

Widget _host({required bool Function() onBack}) => qchatHarness(
  QChatBackSwipe(
    onBack: onBack,
    child: const ColoredBox(key: _page, color: QChatColors.white),
  ),
);

void main() {
  void sized(WidgetTester tester) {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
  }

  double pageLeft(WidgetTester tester) =>
      tester.getTopLeft(find.byKey(_page)).dx;

  testWidgets('the page follows the finger while dragging', (tester) async {
    sized(tester);
    await tester.pumpWidget(_host(onBack: () => true));
    final swipe = await tester.startGesture(const Offset(2, 400));
    await swipe.moveBy(const Offset(120, 0));
    await tester.pump();

    expect(pageLeft(tester), moreOrLessEquals(120));
    await swipe.up();
    await tester.pumpAndSettle();
    expect(pageLeft(tester), 0);
  });

  testWidgets('a long swipe hands back to the caller', (tester) async {
    sized(tester);
    var backs = 0;
    await tester.pumpWidget(_host(onBack: () => ++backs > 0 && false));
    await tester.dragFrom(const Offset(2, 400), const Offset(240, 0));
    await tester.pumpAndSettle();
    expect(backs, 1);
  });

  testWidgets('a short swipe settles the page back', (tester) async {
    sized(tester);
    var backs = 0;
    await tester.pumpWidget(_host(onBack: () => ++backs > 0));
    await tester.dragFrom(const Offset(2, 400), const Offset(40, 0));
    await tester.pumpAndSettle();
    expect(backs, 0);
    expect(pageLeft(tester), 0);
  });

  testWidgets('a leftward drag does not swipe', (tester) async {
    sized(tester);
    var backs = 0;
    await tester.pumpWidget(_host(onBack: () => ++backs > 0));
    await tester.dragFrom(const Offset(8, 400), const Offset(-90, 0));
    await tester.pumpAndSettle();
    expect(backs, 0);
    expect(pageLeft(tester), 0);
  });

  testWidgets('a drag that reverses cancels the swipe', (tester) async {
    sized(tester);
    var backs = 0;
    await tester.pumpWidget(_host(onBack: () => ++backs > 0));
    final swipe = await tester.startGesture(const Offset(2, 400));
    await swipe.moveBy(const Offset(200, 0));
    await tester.pump();
    await swipe.moveBy(const Offset(-190, 0));
    await tester.pump();
    expect(pageLeft(tester), lessThan(20));
    await swipe.up();
    await tester.pumpAndSettle();
    expect(backs, 0);
    expect(pageLeft(tester), 0);
  });

  testWidgets('a page that keeps the gesture springs back on screen', (
    tester,
  ) async {
    sized(tester);
    await tester.pumpWidget(_host(onBack: () => true));
    await tester.dragFrom(const Offset(2, 400), const Offset(260, 0));
    await tester.pumpAndSettle();
    expect(pageLeft(tester), 0);
  });

  testWidgets('only the left edge starts a swipe', (tester) async {
    sized(tester);
    var backs = 0;
    await tester.pumpWidget(_host(onBack: () => ++backs > 0));
    await tester.dragFrom(const Offset(200, 400), const Offset(120, 0));
    await tester.pumpAndSettle();
    expect(backs, 0);
    expect(pageLeft(tester), 0);
  });
}
