import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/core/design_system/components.dart';
import 'package:qchat/core/design_system/qchat_glass.dart';
import 'test_app.dart';

void main() {
  group('QChatCapsule', () {
    testWidgets('draws the menu and close halves with their own actions', (
      tester,
    ) async {
      final taps = <String>[];
      await tester.pumpWidget(
        qchatHarness(
          Center(
            child: QChatCapsule(
              menuLabel: 'More',
              closeLabel: 'Close',
              onMenu: () => taps.add('menu'),
              onClose: () => taps.add('close'),
            ),
          ),
        ),
      );
      expect(
        tester.getSize(find.byType(QChatCapsule)),
        const Size(kQChatCapsuleWidth, kQChatCapsuleHeight),
      );
      await tester.tapAt(
        tester.getCenter(find.byType(QChatCapsule)) - const Offset(20, 0),
      );
      await tester.pump();
      await tester.tapAt(
        tester.getCenter(find.byType(QChatCapsule)) + const Offset(20, 0),
      );
      await tester.pump();
      expect(taps, ['menu', 'close']);
    });

    testWidgets('exposes one accessibility button per half', (tester) async {
      final handle = tester.ensureSemantics();
      await tester.pumpWidget(
        qchatHarness(
          Center(
            child: QChatCapsule(
              menuLabel: 'More',
              closeLabel: 'Close',
              onMenu: () {},
              onClose: () {},
            ),
          ),
        ),
      );
      expect(find.bySemanticsLabel('More'), findsOneWidget);
      expect(find.bySemanticsLabel('Close'), findsOneWidget);
      handle.dispose();
    });

    testWidgets('the pill is a translucent frosted surface', (tester) async {
      await tester.pumpWidget(
        qchatHarness(
          const Center(child: QChatCapsule(menuLabel: 'More', closeLabel: 'Close')),
        ),
      );
      expect(
        find.descendant(
          of: find.byType(QChatCapsule),
          matching: find.byType(BackdropFilter),
        ),
        findsOneWidget,
      );
      final fill = tester
          .widgetList<DecoratedBox>(
            find.descendant(
              of: find.byType(QChatCapsule),
              matching: find.byType(DecoratedBox),
            ),
          )
          .map((box) => box.decoration)
          .whereType<BoxDecoration>()
          .map((decoration) => decoration.color)
          .whereType<Color>()
          .firstWhere((color) => color.a < 1);
      // The page behind the capsule has to show through it.
      expect(fill.a, greaterThan(.3));
      expect(fill.a, lessThan(1));
    });

    testWidgets('the close half is a ring with a dot, the menu half has three', (
      tester,
    ) async {
      await tester.pumpWidget(
        qchatHarness(
          const Center(child: QChatCapsule(menuLabel: 'More', closeLabel: 'Close')),
        ),
      );
      // Three dots plus the ring's inner dot.
      final dots = find.byWidgetPredicate((widget) {
        if (widget is! Container) return false;
        final decoration = widget.decoration;
        return decoration is BoxDecoration &&
            decoration.shape == BoxShape.circle &&
            decoration.border == null;
      });
      expect(dots, findsNWidgets(4));
      // The ring itself is a bordered circle.
      expect(
        find.byWidgetPredicate(
          (widget) =>
              widget is Container &&
              widget.decoration is BoxDecoration &&
              (widget.decoration! as BoxDecoration).border != null,
        ),
        findsWidgets,
      );
    });
  });

  group('QChatHeader', () {
    /// The header sits at the top of a page, so give it loose vertical
    /// constraints here instead of letting the harness stretch it full height.
    Widget top(Widget child) => Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [child],
    );

    testWidgets('centres the title on the capsule line', (tester) async {
      await tester.pumpWidget(
        qchatHarness(
          top(
            QChatHeader(
              title: 'Inbox',
              safeArea: false,
              reserveLeading: 56,
              reserveTrailing: kQChatCapsuleWidth + 14,
              leading: const SizedBox(width: 44, height: 44),
              trailing: QChatCapsule(menuLabel: 'More', closeLabel: 'Close'),
            ),
          ),
        ),
      );
      final title = tester.getCenter(find.text('Inbox'));
      final capsule = tester.getCenter(find.byType(QChatCapsule));
      expect(title.dy, closeTo(capsule.dy, .01));
      expect(
        title.dx,
        closeTo(tester.getCenter(find.byType(QChatHeader)).dx, .01),
      );
      expect(tester.getSize(find.byType(QChatHeader)).height, kQChatHeaderHeight);
      expect(
        tester.getSize(find.byType(QChatCapsule)).height,
        kQChatCapsuleHeight,
      );
    });

    testWidgets('a lower row extends the header downwards', (tester) async {
      await tester.pumpWidget(
        qchatHarness(
          top(
            QChatHeader(
              title: 'Inbox',
              safeArea: false,
              bottom: const SizedBox(height: 40, child: Text('Rows')),
            ),
          ),
        ),
      );
      final header = tester.getSize(find.byType(QChatHeader));
      expect(header.height, kQChatHeaderHeight + 40);
      expect(tester.getTopLeft(find.text('Rows')).dy, kQChatHeaderHeight);
    });

    testWidgets('a transparent header paints no surface', (tester) async {
      await tester.pumpWidget(
        qchatHarness(
          const QChatHeader(title: 'Inbox', safeArea: false, transparent: true),
        ),
      );
      expect(
        find.descendant(
          of: find.byType(QChatHeader),
          matching: find.byType(DecoratedBox),
        ),
        findsNothing,
      );
      expect(find.byType(QChatGlass), findsNothing);
    });

    testWidgets('a solid header paints the surface and its hairline', (
      tester,
    ) async {
      await tester.pumpWidget(
        qchatHarness(
          const QChatHeader(title: 'Inbox', safeArea: false, border: true),
        ),
      );
      final box = tester.widget<DecoratedBox>(
        find
            .descendant(
              of: find.byType(QChatHeader),
              matching: find.byType(DecoratedBox),
            )
            .first,
      );
      final decoration = box.decoration as BoxDecoration;
      expect(decoration.color, isNotNull);
      expect(decoration.border, isNotNull);
    });

    testWidgets('a blurred header uses the glass surface', (tester) async {
      await tester.pumpWidget(
        qchatHarness(
          const QChatHeader(title: 'Inbox', safeArea: false, blur: true),
        ),
      );
      expect(find.byType(QChatGlass), findsOneWidget);
    });
  });
}
