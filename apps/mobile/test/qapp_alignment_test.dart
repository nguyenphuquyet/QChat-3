import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/features/miniapps/qapp/qapp_renderer.dart';
import 'package:qchat/features/miniapps/qapp/qapp_style.dart';
import 'package:qchat/features/miniapps/qapp/qapp_tree.dart';
import 'test_app.dart';

QappNode node(
  String id,
  String type, {
  Map<String, dynamic> props = const {},
  List<String> events = const [],
  List<QappNode> children = const [],
}) {
  return QappNode(
    id: id,
    type: type,
    props: props,
    events: events.toSet(),
    children: children,
    style: QappStyle.fromMap(props['style']),
  );
}

Widget host(QappNode root) {
  return qchatHarness(
    QappRenderer(
      root: root,
      onEvent: (_, _, _) {},
      loadAsset: (_) async => null,
    ),
  );
}

/// The y of a label's baseline, from the line box it was given.
///
/// Flutter's test font puts three quarters of its line box above the baseline
/// and fills the ascent with ink, so a label's caps start at the top of its line
/// box. Deriving the baseline from the measured rect keeps this independent of
/// the style a control passes down, and sees any paint-time lift, because a
/// `Transform` moves the rect too.
double baselineOf(Rect lineBox) => lineBox.top + lineBox.height * .75;

/// Where a cap-centred label's baseline belongs in [box].
///
/// A control is centred when its *caps* are, not its line box: Flutter's
/// `height` multiplier adds its leading above the glyphs, so a centred line box
/// paints low — which is what `QappRenderer._labelLift` corrects. A cap is about
/// 0.7 of the font size, and half of it hangs above the middle.
double centredBaseline(Rect box, double fontSize) =>
    box.center.dy + .35 * fontSize;

void main() {
  group('text centring', () {
    test('a styled line height keeps its ink in the middle of the line box', () {
      final style = QappStyle.fromMap({
        'fontSize': 16,
        'lineHeight': 32,
      }).toTextStyle();
      expect(style.height, 2);
      // Flutter's default (`proportional`) grows the ascent more than the
      // descent, so a tall line drops the glyphs below the middle of their own
      // line box. `even` is the distribution that would centre them; this
      // build of Flutter still splits a `height` multiplier proportionally, so
      // the renderer does the centring itself (see `_labelLift`). The intent
      // stays declared in the style for hosts that honour it.
      expect(style.leadingDistribution, TextLeadingDistribution.even);
    });

    test('a frame without a line height inherits the host distribution', () {
      final style = QappStyle.fromMap({'fontSize': 16}).toTextStyle();
      expect(style.height, isNull);
      expect(style.leadingDistribution, isNull);
    });

    testWidgets('a Button keeps its label in the middle of a tall box', (
      tester,
    ) async {
      final root = node(
        'root',
        'View',
        props: {
          'style': {'flex': 1},
        },
        children: [
          node(
            'b1',
            'Button',
            props: {
              'style': {
                'width': 160,
                'height': 44,
                'fontSize': 16,
                'lineHeight': 32,
              },
            },
            children: [
              node('t1', '#text', props: {'text': 'Trước'}),
            ],
          ),
        ],
      );
      await tester.pumpWidget(host(root));

      final box = tester.getRect(find.byKey(const ValueKey('b1')));
      final label = find.text('Trước');
      expect(box.height, 44);
      // TDesign's own inset is computed from its 16/24 token, which would leave
      // the app's 32-point line 4 points low in a 44-point box.
      expect(
        baselineOf(tester.getRect(label)),
        closeTo(centredBaseline(box, 16), 0.6),
        reason: 'label ${tester.getRect(label)} is not centred in $box',
      );
    });

    testWidgets('an unstyled Button keeps TDesign metrics', (tester) async {
      final root = node(
        'root',
        'View',
        props: {
          'style': {'flex': 1},
        },
        children: [
          node(
            'b1',
            'Button',
            children: [
              node('t1', '#text', props: {'text': 'Lưu'}),
            ],
          ),
        ],
      );
      await tester.pumpWidget(host(root));

      final box = tester.getRect(find.byKey(const ValueKey('b1')));
      final label = find.text('Lưu');
      expect(box.height, 40, reason: 'the contract keeps the 40-point target');
      // No app style: TDesign's 16-point label, in a 40-point box.
      expect(
        baselineOf(tester.getRect(label)),
        closeTo(centredBaseline(box, 16), 0.6),
      );
    });

    testWidgets('a TextField draws one box and centres the editor in it', (
      tester,
    ) async {
      final root = node(
        'root',
        'View',
        props: {
          'style': {'flex': 1},
        },
        children: [
          node(
            'f1',
            'TextField',
            props: {
              'placeholder': 'Ghi chú',
              'style': {
                'width': 240,
                'height': 48,
                'padding': 10,
                'backgroundColor': '#ffffff',
                'borderWidth': 1,
                'borderColor': '#dcdcdc',
                'borderRadius': 8,
                'fontSize': 15,
                'lineHeight': 22,
              },
            },
          ),
        ],
      );
      await tester.pumpWidget(host(root));

      final box = tester.getRect(find.byKey(const ValueKey('f1')));
      final editor = tester.getRect(find.byType(EditableText));
      expect(
        editor.height,
        closeTo(22, 0.5),
        reason: 'TDesign\'s 16-point inset must be gone: $editor',
      );
      // The hint is what a reader sees in an empty field, and TDesign gives it
      // its own 14-point style.
      final hint = find.text('Ghi chú');
      final hintSize = tester.widget<Text>(hint).style!.fontSize!;
      expect(
        baselineOf(tester.getRect(hint)),
        closeTo(centredBaseline(box, hintSize), 0.6),
      );
      expect(editor.center.dy, closeTo(box.center.dy, 2));
      // The app's own padding is the only horizontal inset, plus the 1-point
      // border the app asked for (padding sits inside the border).
      expect(editor.left - box.left, closeTo(11, 0.5));
    });

    testWidgets('an unstyled TextField still looks and measures like a field', (
      tester,
    ) async {
      final root = node(
        'root',
        'View',
        props: {
          'style': {'flex': 1},
        },
        children: [
          node('f1', 'TextField', props: {'placeholder': 'Ghi chú'}),
        ],
      );
      await tester.pumpWidget(host(root));

      final box = tester.getRect(find.byKey(const ValueKey('f1')));
      final editor = tester.getRect(find.byType(EditableText));
      expect(box.height, 48);
      final hint = find.text('Ghi chú');
      final hintSize = tester.widget<Text>(hint).style!.fontSize!;
      expect(
        baselineOf(tester.getRect(hint)),
        closeTo(centredBaseline(box, hintSize), 0.6),
      );
      expect(editor.center.dy, closeTo(box.center.dy, 2));
      expect(editor.left - box.left, closeTo(12, 0.5));
    });

    testWidgets(
      'a tinted TextField without a height still gets a field height',
      (tester) async {
        final root = node(
          'root',
          'View',
          props: {
            'style': {'flex': 1},
          },
          children: [
            node(
              'f1',
              'TextField',
              props: {
                'placeholder': 'Ghi chú',
                'style': {
                  'backgroundColor': '#ffffff',
                  'borderWidth': 1,
                  'padding': 10,
                },
              },
            ),
          ],
        );
        await tester.pumpWidget(host(root));

        final box = tester.getRect(find.byKey(const ValueKey('f1')));
        final editor = tester.getRect(find.byType(EditableText));
        expect(box.height, 48);
        final hint = find.text('Ghi chú');
        final hintSize = tester.widget<Text>(hint).style!.fontSize!;
        expect(
          baselineOf(tester.getRect(hint)),
          closeTo(centredBaseline(box, hintSize), 0.6),
        );
        expect(editor.center.dy, closeTo(box.center.dy, 2));
        // The app set its own 10-point padding (plus the 1-point border), so the
        // host's 12-point inset must not be added on top.
        expect(editor.left - box.left, closeTo(11, 0.5));
      },
    );
  });
}
