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

QappNode text(String id, String value) => node(
  id,
  'Text',
  children: [
    node('$id.0', '#text', props: {'text': value}),
  ],
);

Widget host(QappNode root, void Function(String, String, Object?) onEvent) {
  return qchatHarness(
    MediaQuery(
      data: const MediaQueryData(size: Size(375, 812)),
      child: QappRenderer(
        root: root,
        onEvent: onEvent,
        loadAsset: (_) async => null,
      ),
    ),
  );
}

/// A 375x812 phone surface, matching the MediaQuery the host reports.
void setPhone(WidgetTester tester) {
  tester.view.physicalSize = const Size(1125, 2436);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
}

void main() {
  testWidgets('a row survives the unbounded main axis of a column', (
    tester,
  ) async {
    setPhone(tester);
    // React Native stacks stretch their children by default, and a Column gives
    // every child an unbounded height. Flutter cannot stretch against infinity,
    // so the renderer has to fall back to `start` instead of throwing.
    final root = node(
      'n0',
      'View',
      props: {
        'style': {'flex': 1},
      },
      children: [
        node(
          'n0.0',
          'Stack',
          props: {
            'style': {'flex': 1},
          },
          children: [
            node(
              'n0.0.0',
              'ScrollView',
              props: {
                'style': {'height': '100%'},
              },
              children: [
                node(
                  'n0.0.0.0',
                  'View',
                  props: {
                    'style': {'padding': 16, 'gap': 12},
                  },
                  children: [
                    node(
                      'n0.0.0.0.0',
                      'View',
                      props: {
                        'style': {
                          'backgroundColor': '#ffffff',
                          'padding': 12,
                          'gap': 8,
                        },
                      },
                      children: [
                        node(
                          'n0.0.0.0.0.0',
                          'View',
                          props: {
                            'style': {
                              'flexDirection': 'row',
                              'justifyContent': 'spaceBetween',
                              'gap': 8,
                            },
                          },
                          children: [
                            text('n0.0.0.0.0.0.0', 'Cài đặt'),
                            node(
                              'n0.0.0.0.0.0.1',
                              'Switch',
                              props: {'value': false},
                            ),
                          ],
                        ),
                        // spaceBetween in a column without a bounded height
                        // must not try to divide infinity.
                        node(
                          'n0.0.0.0.0.1',
                          'View',
                          props: {
                            'style': {
                              'flexDirection': 'column',
                              'justifyContent': 'spaceBetween',
                              'height': 120,
                            },
                          },
                          children: [
                            text('n0.0.0.0.0.1.0', 'Trên'),
                            text('n0.0.0.0.0.1.1', 'Dưới'),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ],
    );

    await tester.pumpWidget(host(root, (_, _, _) {}));

    expect(tester.takeException(), isNull);
    expect(find.text('Cài đặt'), findsOneWidget);
    final scrollable = tester.state<ScrollableState>(
      find.byType(Scrollable).first,
    );
    expect(scrollable.position.viewportDimension, 812);
    expect(scrollable.position.maxScrollExtent.isFinite, isTrue);
  });

  testWidgets('a list nested in a scroller shares the outer scroll', (
    tester,
  ) async {
    setPhone(tester);
    // A vertical viewport cannot live inside another vertical viewport: the
    // inner ListView has to shrink-wrap and leave the scrolling to the page.
    final root = node(
      'n0',
      'ScrollView',
      props: {
        'style': {'height': '100%'},
      },
      children: [
        node(
          'n0.0',
          'View',
          props: {
            'style': {'height': 160},
          },
          children: [
            node(
              'n0.1',
              'ListView',
              props: {'data': const []},
              children: [
                for (var index = 0; index < 3; index++)
                  text('n0.1.$index', 'Dòng $index'),
              ],
            ),
          ],
        ),
      ],
    );

    await tester.pumpWidget(host(root, (_, _, _) {}));

    expect(tester.takeException(), isNull);
    expect(find.text('Dòng 2'), findsOneWidget);
  });

  testWidgets('a modal fills its stack and closes from the barrier', (
    tester,
  ) async {
    setPhone(tester);
    final events = <(String, String, Object?)>[];
    final root = node(
      'n0',
      'Stack',
      children: [
        node(
          'n0.0',
          'View',
          props: {
            'style': {'flex': 1, 'backgroundColor': '#ffffff'},
          },
          children: [text('n0.0.0', 'Nền')],
        ),
        node(
          'n0.1',
          'Modal',
          props: {'visible': true},
          events: const ['close'],
          children: [
            node(
              'n0.1.0',
              'View',
              props: {
                'style': {'padding': 18},
              },
              children: [text('n0.1.0.0', 'Nội dung')],
            ),
          ],
        ),
      ],
    );

    await tester.pumpWidget(
      host(root, (id, event, payload) => events.add((id, event, payload))),
    );

    expect(tester.takeException(), isNull);
    final barrier = find.byWidgetPredicate(
      (widget) =>
          widget is ColoredBox && widget.color.a > 0 && widget.color.a < 1,
    );
    expect(tester.getRect(barrier.first), const Rect.fromLTWH(0, 0, 375, 812));

    await tester.tapAt(const Offset(10, 780));
    await tester.pump();
    final close = events
        .where((entry) => entry.$1 == 'n0.1' && entry.$2 == 'close')
        .toList();
    expect(close, isNotEmpty);
    expect(close.last.$3, {'type': 'close'});
  });

  testWidgets('a pressable inside a row leaves room for its flex sibling', (
    tester,
  ) async {
    setPhone(tester);
    // A Pressable stacks its children in a stretch column, which is what makes
    // a button fill its card. Inside a Row the cross axis is unbounded, and
    // stretching against infinity used to make the pressable infinitely wide:
    // the flex sibling then received zero space and its label collapsed to one
    // character per line.
    final root = node(
      'n0',
      'View',
      props: {
        'style': {'flexDirection': 'row', 'gap': 12, 'padding': 16},
      },
      children: [
        node(
          'n0.0',
          'View',
          props: {
            'style': {'flex': 1},
          },
          children: [text('n0.0.0', 'Notifications')],
        ),
        node(
          'n0.1',
          'Pressable',
          events: const ['press'],
          children: [
            node(
              'n0.1.0',
              'View',
              props: {
                'style': {'width': 38, 'height': 38},
              },
            ),
          ],
        ),
      ],
    );

    await tester.pumpWidget(host(root, (_, _, _) {}));

    expect(tester.takeException(), isNull);
    final label = tester.getSize(find.text('Notifications'));
    expect(label.height, lessThan(40));
    expect(label.width, greaterThan(200));
    expect(tester.getSize(find.byKey(const ValueKey('n0.1'))).width, 38);
  });

  testWidgets('a stack aligns unpositioned children at the top left', (
    tester,
  ) async {    setPhone(tester);
    final root = node(
      'n0',
      'Stack',
      children: [
        node(
          'n0.0',
          'View',
          props: {
            'style': {'width': 40, 'height': 20},
          },
        ),
      ],
    );

    await tester.pumpWidget(host(root, (_, _, _) {}));

    expect(tester.takeException(), isNull);
    expect(tester.getTopLeft(find.byKey(const ValueKey('n0.0'))), Offset.zero);
  });
}
