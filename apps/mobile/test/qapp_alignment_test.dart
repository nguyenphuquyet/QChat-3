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

/// Vertical distance between two centres, in logical points.
double offCentreBy(Rect outer, Rect inner) =>
    (outer.center.dy - inner.center.dy).abs();

void main() {
  group('text centring', () {
    test('a styled line height centres the ink in its line box', () {
      final style = QappStyle.fromMap({
        'fontSize': 16,
        'lineHeight': 32,
      }).toTextStyle();
      expect(style.height, 2);
      // Flutter's default (`proportional`) grows the ascent far more than the
      // descent, so a tall line drops the glyphs below the middle of their own
      // line box. `even` is what Material uses, and what a QChat frame needs.
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
      final label = tester.getRect(find.text('Trước'));
      expect(box.height, 44);
      // TDesign's own inset is computed from its 16/24 token, which would leave
      // the 32-point line 4 points low in a 44-point box.
      expect(
        offCentreBy(box, label),
        lessThan(0.6),
        reason: 'label $label is not centred in button $box',
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
      final label = tester.getRect(find.text('Lưu'));
      expect(box.height, 40, reason: 'the contract keeps the 40-point target');
      expect(offCentreBy(box, label), lessThan(0.6));
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
      expect(offCentreBy(box, editor), lessThan(0.6));
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
      expect(offCentreBy(box, editor), lessThan(0.6));
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
        expect(offCentreBy(box, editor), lessThan(0.6));
      },
    );
  });
}
