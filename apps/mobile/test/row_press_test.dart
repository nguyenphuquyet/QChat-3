import 'package:flutter/gestures.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/core/design_system/components.dart';
import 'package:qchat/core/design_system/dialogs.dart';

import 'test_app.dart';

/// Reads the background the row's [QChatPressable] is painting. It is the
/// first `DecoratedBox` under the row, before avatars and icons.
Color _rowColor(WidgetTester tester, Type row) {
  final box = tester.widget<DecoratedBox>(
    find
        .descendant(of: find.byType(row), matching: find.byType(DecoratedBox))
        .first,
  );
  return (box.decoration as BoxDecoration).color!;
}

/// Reads the colour painted by the [QChatPressable] around [label]. Overlay
/// rows pass a transparent background, so the sheet or card surface shows
/// through until the row is pressed.
Color _pressableColor(WidgetTester tester, Finder label) {
  final row = find.ancestor(of: label, matching: find.byType(QChatPressable));
  final box = tester.widget<DecoratedBox>(
    find.descendant(of: row, matching: find.byType(DecoratedBox)).first,
  );
  return (box.decoration as BoxDecoration).color!;
}

const _surface = Color(0xffffffff);
const _press = Color(0xffe5e5e5);

void main() {
  testWidgets('a row turns grey while held and back when released', (
    tester,
  ) async {
    var taps = 0;
    await tester.pumpWidget(
      qchatHarness(
        ListView(
          children: [
            QChatListTile(
              title: 'Quyết',
              subtitle: 'qchat',
              onTap: () => taps++,
            ),
          ],
        ),
      ),
    );

    expect(_rowColor(tester, QChatListTile), _surface);

    final hold = await tester.startGesture(
      tester.getCenter(find.text('Quyết')),
    );
    await tester.pump();
    // The highlight lands on touch-down, not after the tap timeout.
    expect(_rowColor(tester, QChatListTile), _press);

    await hold.up();
    await tester.pump();
    expect(_rowColor(tester, QChatListTile), _surface);
    await tester.pump();
    expect(taps, 1);
  });

  testWidgets('a drag is a scroll and drops the highlight', (tester) async {
    await tester.pumpWidget(
      qchatHarness(
        ListView(
          children: [
            QChatConversationTile(
              name: 'Nhóm WeChat',
              preview: 'hello',
              onTap: () {},
            ),
          ],
        ),
      ),
    );

    final drag = await tester.startGesture(
      tester.getCenter(find.text('Nhóm WeChat')),
    );
    await tester.pump();
    expect(_rowColor(tester, QChatConversationTile), _press);

    await drag.moveBy(const Offset(0, -40));
    await tester.pump();
    expect(_rowColor(tester, QChatConversationTile), _surface);

    await drag.up();
    await tester.pump();
  });

  testWidgets('hovering with a mouse lights the row, leaving clears it', (
    tester,
  ) async {
    await tester.pumpWidget(
      qchatHarness(
        Column(
          children: [
            QChatCell(
              title: const Text('Khoảnh khắc'),
              arrow: true,
              onTap: () {},
            ),
          ],
        ),
      ),
    );

    final mouse = await tester.createGesture(kind: PointerDeviceKind.mouse);
    await mouse.addPointer(location: const Offset(1, 1));
    await mouse.moveTo(tester.getCenter(find.text('Khoảnh khắc')));
    await tester.pump();
    expect(_rowColor(tester, QChatCell), _press);

    await mouse.moveTo(const Offset(1, 300));
    await tester.pump();
    expect(_rowColor(tester, QChatCell), _surface);
    await mouse.removePointer();
  });

  testWidgets('a row without a tap action never lights up', (tester) async {
    await tester.pumpWidget(
      qchatHarness(const Column(children: [QChatCell(title: Text('Static'))])),
    );

    final hold = await tester.startGesture(
      tester.getCenter(find.text('Static')),
    );
    await tester.pump();
    expect(_rowColor(tester, QChatCell), _surface);
    await hold.up();
  });

  testWidgets('dark mode uses its own grey instead of the light one', (
    tester,
  ) async {
    await tester.pumpWidget(
      qchatHarness(
        dark: true,
        ListView(
          children: [QChatListTile(title: 'Quyết', onTap: () {})],
        ),
      ),
    );

    expect(_rowColor(tester, QChatListTile), const Color(0xff202020));
    final hold = await tester.startGesture(
      tester.getCenter(find.text('Quyết')),
    );
    await tester.pump();
    expect(_rowColor(tester, QChatListTile), const Color(0xff2c2c2c));
    await hold.up();
  });

  testWidgets('an action sheet row lights the sheet while held', (tester) async {
    await tester.pumpWidget(
      qchatHarness(
        Align(
          alignment: Alignment.bottomCenter,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              QChatOverlayAction(
                label: 'Bỏ khỏi mục yêu thích',
                onTap: () {},
              ),
              QChatOverlayAction(label: 'Hủy', onTap: () {}),
            ],
          ),
        ),
      ),
    );

    final row = find.text('Bỏ khỏi mục yêu thích');
    expect(_pressableColor(tester, row), QChatColors.transparent);

    final hold = await tester.startGesture(tester.getCenter(row));
    await tester.pump();
    expect(_pressableColor(tester, row), _press);

    await hold.up();
    await tester.pump();
    expect(_pressableColor(tester, row), QChatColors.transparent);
  });

  testWidgets('a dialog button lights the card while held', (tester) async {
    await tester.pumpWidget(
      qchatHarness(
        Builder(
          builder: (c) => GestureDetector(
            onTap: () => showQChatDialog<void>(
              c,
              message: 'Xoá cuộc trò chuyện này?',
              actions: const [
                QChatDialogAction(label: 'Hủy'),
                QChatDialogAction(label: 'Xác nhận', primary: true),
              ],
            ),
            behavior: HitTestBehavior.opaque,
            child: const SizedBox.expand(child: Text('open')),
          ),
        ),
      ),
    );

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    final confirm = find.text('Xác nhận');
    expect(confirm, findsOneWidget);
    expect(_pressableColor(tester, confirm), QChatColors.transparent);

    final hold = await tester.startGesture(tester.getCenter(confirm));
    await tester.pump();
    expect(_pressableColor(tester, confirm), _press);

    await hold.up();
    await tester.pumpAndSettle();
    expect(confirm, findsNothing);
  });
}
