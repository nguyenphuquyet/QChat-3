import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/features/miniapps/qapp/qapp_renderer.dart';
import 'package:qchat/features/miniapps/qapp/qapp_style.dart';
import 'package:qchat/features/miniapps/qapp/qapp_tree.dart';

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
  return MaterialApp(
    home: Scaffold(
      body: QappRenderer(
        root: root,
        onEvent: (_, _, _) {},
        loadAsset: (_) async => null,
      ),
    ),
  );
}

Map<String, dynamic> treeWithStyle(Map<String, dynamic> style) => {
  'v': 1,
  'appId': 'mp_test',
  'revision': 1,
  'root': {
    'id': 'n0',
    'type': 'View',
    'props': {'style': style},
  },
};

void main() {
  test('rejects an unknown style key', () {
    expect(
      () => QappTree.fromJson(treeWithStyle({'totallyUnknown': 1})),
      throwsA(
        isA<QappTreeException>().having(
          (error) => error.code,
          'code',
          'STYLE_KEY_UNKNOWN',
        ),
      ),
    );
  });

  test('rejects an invalid enum value', () {
    expect(
      () => QappTree.fromJson(treeWithStyle({'justifyContent': 'sideways'})),
      throwsA(
        isA<QappTreeException>().having(
          (error) => error.code,
          'code',
          'STYLE_VALUE_INVALID',
        ),
      ),
    );
  });

  test('normalizes CSS enum aliases in one place', () {
    final style = QappStyle.fromMap({
      'justifyContent': 'space-between',
      'alignItems': 'flex-start',
      'textAlign': 'start',
    });
    expect(style.justifyContent, 'spaceBetween');
    expect(style.alignItems, 'start');
    expect(style.textAlign, TextAlign.left);
  });

  test('accepts every border, layout and text key from the contract', () {
    final style = QappStyle.fromMap({
      'borderTopWidth': 2,
      'borderTopColor': '#ff0000',
      'borderRightWidth': 1,
      'borderBottomWidth': 3,
      'borderLeftWidth': 0,
      'marginTop': 4,
      'marginRight': 5,
      'marginBottom': 6,
      'marginLeft': 7,
      'flexWrap': 'wrap',
      'flexGrow': 1,
      'flexShrink': 0,
      'flexBasis': 40,
      'minWidth': 10,
      'maxWidth': 200,
      'aspectRatio': 1.5,
      'position': 'absolute',
      'top': 1,
      'right': 2,
      'bottom': 3,
      'left': 4,
      'zIndex': 5,
      'overflow': 'hidden',
      'alignSelf': 'center',
      'textDecoration': 'lineThrough',
      'letterSpacing': 0.5,
      'fontStyle': 'italic',
      'fontFamily': 'QChatSans',
      'numberOfLines': 2,
    });
    expect(style.zIndex, 5);
    expect(style.clipsContent, isTrue);
    expect(style.numberOfLines, 2);
    expect(style.boxBorder(), isNotNull);
    expect(style.boxBorder()!.top.width, 2);
    expect(style.boxBorder()!.bottom.width, 3);
  });

  testWidgets('renders per-edge borders, shadow and a gradient', (tester) async {
    final root = node(
      'n0',
      'View',
      props: {
        'style': {
          'borderTopWidth': 3,
          'borderTopColor': '#ff0000',
          'borderBottomWidth': 1,
          'borderBottomColor': '#00ff00',
          'borderTopLeftRadius': 12,
          'boxShadow': [
            {'color': '#22000000', 'blurRadius': 10, 'offsetY': 4},
          ],
          'gradient': {
            'type': 'linear',
            'angle': 180,
            'stops': [
              {'offset': 0, 'color': '#ffffff'},
              {'offset': 1, 'color': '#000000'},
            ],
          },
        },
      },
      children: [
        node(
          'n0.0',
          'Text',
          props: {
            'style': {'textAlign': 'center', 'fontSize': 16},
          },
          children: [node('n0.0.0', '#text', props: {'text': 'Styled'})],
        ),
      ],
    );
    await tester.pumpWidget(host(root));
    expect(find.text('Styled'), findsOneWidget);
    final decorated = tester.widgetList<Container>(find.byType(Container)).firstWhere(
      (widget) => widget.decoration is BoxDecoration,
    );
    final decoration = decorated.decoration as BoxDecoration;
    expect(decoration.gradient, isNotNull);
    expect(decoration.boxShadow, isNotEmpty);
    final border = decoration.border as Border;
    expect(border.top.width, 3);
    expect(border.bottom.width, 1);
    expect(decoration.borderRadius, isNotNull);
  });

  testWidgets('applies alignSelf and zIndex paint ordering', (tester) async {
    final root = node(
      'n0',
      'Stack',
      children: [
        node(
          'n0.0',
          'View',
          props: {
            'style': {'zIndex': 5, 'backgroundColor': '#ff0000'},
          },
        ),
        node(
          'n0.1',
          'View',
          props: {
            'style': {'zIndex': 1, 'backgroundColor': '#00ff00'},
          },
        ),
        node(
          'n0.2',
          'Row',
          props: {
            'style': {'columnGap': 8, 'justifyContent': 'space-between'},
          },
          children: [
            node(
              'n0.2.0',
              'Text',
              props: {'style': {'alignSelf': 'end'}},
              children: [node('n0.2.0.0', '#text', props: {'text': 'a'})],
            ),
          ],
        ),
      ],
    );
    await tester.pumpWidget(host(root));
    await tester.pumpAndSettle();
    expect(find.text('a'), findsOneWidget);
    expect(find.byType(Align), findsWidgets);
    final painted = tester
        .widgetList<Container>(find.byType(Container))
        .map((container) => container.decoration)
        .whereType<BoxDecoration>()
        .map((decoration) => decoration.color)
        .where(
          (color) =>
              color == const Color(0xff00ff00) || color == const Color(0xffff0000),
        )
        .toList();
    // The lower zIndex paints first.
    expect(painted, const [Color(0xff00ff00), Color(0xffff0000)]);
  });
}
