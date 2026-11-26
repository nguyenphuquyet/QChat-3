import 'package:flutter/cupertino.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/features/miniapps/qapp/qapp_screen_transition.dart';
import 'test_app.dart';

/// A screen whose label sits at the very top-left corner, so its global offset
/// is the offset the transition moved the whole screen by.
Widget screen(String label) =>
    Align(alignment: Alignment.topLeft, child: Text(label));

/// A screen that counts its own taps: if the transition rebuilds the live
/// screen instead of moving it, the count is lost.
class Tally extends StatefulWidget {
  const Tally({super.key});

  @override
  State<Tally> createState() => TallyState();
}

class TallyState extends State<Tally> {
  int count = 0;

  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.topLeft,
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => setState(() => count += 1),
      child: Text('tap $count'),
    ),
  );
}

Widget host(
  AnimationController nav,
  int direction, {
  Widget? live,
  Widget? outgoing,
}) => qchatHarness(
  QappScreenTransition(
    animation: nav,
    direction: direction,
    live: live ?? screen('live'),
    outgoing: outgoing,
  ),
);

void main() {
  late AnimationController nav;

  setUp(() {
    nav = AnimationController(
      vsync: const TestVSync(),
      duration: const Duration(milliseconds: 400),
    );
  });

  tearDown(() => nav.dispose());

  Future<void> sized(WidgetTester tester, Widget child) async {
    tester.view.physicalSize = const Size(400, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(child);
  }

  double dxOf(WidgetTester tester, String label) =>
      tester.getTopLeft(find.text(label)).dx;

  testWidgets('at rest the live screen sits at the origin', (tester) async {
    nav.value = 1;
    await sized(tester, host(nav, 0));
    expect(dxOf(tester, 'live'), 0);
    expect(find.byType(CupertinoPageTransition), findsOneWidget);
  });

  testWidgets('a push slides the new screen in from the right', (tester) async {
    nav.value = 0;
    await sized(tester, host(nav, 1, outgoing: screen('old')));
    // Fully covered: the new screen waits one full width to the right, over the
    // screen it is about to cover.
    expect(dxOf(tester, 'live'), 400);
    expect(dxOf(tester, 'old'), 0);

    nav.value = .5;
    await tester.pump();
    expect(dxOf(tester, 'live'), greaterThan(0));
    expect(dxOf(tester, 'live'), lessThan(400));
    // The screen underneath drifts left by at most a third of the width.
    expect(dxOf(tester, 'old'), lessThan(0));
    expect(dxOf(tester, 'old'), greaterThan(-400 / 3 - 1));

    nav.value = 1;
    await tester.pump();
    expect(dxOf(tester, 'live'), 0);
  });

  testWidgets('a pop slides the covered screen away to the right', (
    tester,
  ) async {
    nav.value = 1;
    await sized(tester, host(nav, -1, live: screen('parent'), outgoing: screen('old')));
    // The screen being left is still on top; the parent waits a third of the
    // width to the left, exactly where the push left it.
    expect(dxOf(tester, 'old'), 0);
    expect(dxOf(tester, 'parent'), closeTo(-400 / 3, .01));

    nav.value = .5;
    await tester.pump();
    expect(dxOf(tester, 'old'), greaterThan(0));
    expect(dxOf(tester, 'parent'), greaterThan(-400 / 3));
    expect(dxOf(tester, 'parent'), lessThan(0));
    nav.value = 0;
    await tester.pump();
    expect(dxOf(tester, 'parent'), 0);
    expect(dxOf(tester, 'old'), 400);
  });

  testWidgets('the live screen keeps its state when the layers swap', (
    tester,
  ) async {
    nav.value = 1;
    await sized(tester, host(nav, 0, live: const Tally()));
    await tester.tap(find.text('tap 0'));
    await tester.pump();
    expect(find.text('tap 1'), findsOneWidget);

    // Push: the live screen becomes the top layer.
    await tester.pumpWidget(host(nav, 1, live: const Tally(), outgoing: screen('old')));
    await tester.pump();
    expect(find.text('tap 1'), findsOneWidget);

    // Pop: the live screen moves under the outgoing one.
    await tester.pumpWidget(
      host(nav, -1, live: const Tally(), outgoing: screen('old')),
    );
    await tester.pump();
    expect(find.text('tap 1'), findsOneWidget);
  });

  testWidgets('a transition without an outgoing screen never doubles up', (
    tester,
  ) async {
    nav.value = 0;
    await sized(tester, host(nav, 1));
    expect(find.byType(CupertinoPageTransition), findsOneWidget);
    expect(find.text('old'), findsNothing);
  });
}
