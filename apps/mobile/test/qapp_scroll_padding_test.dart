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

const screen = Rect.fromLTWH(0, 0, 375, 812);

/// Scrolls the first scrollable to its far end and lays the result out.
Future<void> scrollToEnd(WidgetTester tester) async {
  final position = tester
      .state<ScrollableState>(find.byType(Scrollable).first)
      .position;
  position.jumpTo(position.maxScrollExtent);
  await tester.pump();
}

void main() {
  group('scroll padding', () {
    testWidgets('a vertical ScrollView pads inside its viewport', (
      tester,
    ) async {
      setPhone(tester);
      // The shape a discovery page uses: the page body is the scroller, and the
      // padding belongs to the content, not to a frame around the viewport.
      final root = node(
        'n0',
        'ScrollView',
        props: {
          'style': {'flex': 1, 'padding': 16, 'backgroundColor': '#ffffff'},
        },
        children: [
          for (var index = 0; index < 10; index++)
            node(
              'n0.$index',
              'View',
              props: {
                'style': {'height': 100},
              },
            ),
        ],
      );
      await tester.pumpWidget(host(root, (_, _, _) {}));

      // The fill still covers the whole viewport; only the content is inset.
      final surface = find.byWidgetPredicate(
        (widget) =>
            widget is Container &&
            widget.decoration is BoxDecoration &&
            (widget.decoration! as BoxDecoration).color ==
                const Color(0xffffffff),
      );
      expect(tester.getRect(surface.first), screen);

      final viewport = tester.getRect(find.byType(SingleChildScrollView));
      expect(
        viewport,
        screen,
        reason: 'padding must not shrink the scroll viewport',
      );
      final first = tester.getRect(find.byKey(const ValueKey('n0.0')));
      expect(first.left, 16);
      expect(first.top, 16);
      expect(first.width, closeTo(375 - 32, .01));

      await scrollToEnd(tester);
      final last = tester.getRect(find.byKey(const ValueKey('n0.9')));
      expect(
        last.bottom,
        closeTo(812 - 16, .01),
        reason: 'the content scrolls flush with the padded edge',
      );
    });

    testWidgets('a horizontal ScrollView pads with paddingHorizontal', (
      tester,
    ) async {
      setPhone(tester);
      final root = node(
        'n0',
        'ScrollView',
        props: {
          'horizontal': true,
          'style': {'flex': 1, 'paddingHorizontal': 12},
        },
        children: [
          for (var index = 0; index < 10; index++)
            node(
              'n0.$index',
              'View',
              props: {
                'style': {'width': 80, 'height': 40},
              },
            ),
        ],
      );
      await tester.pumpWidget(host(root, (_, _, _) {}));

      final viewport = tester.getRect(find.byType(SingleChildScrollView));
      expect(viewport, screen);
      final first = tester.getRect(find.byKey(const ValueKey('n0.0')));
      expect(first.left, 12);
      expect(
        first.top,
        0,
        reason: 'paddingHorizontal leaves the top edge alone',
      );

      await scrollToEnd(tester);
      final last = tester.getRect(find.byKey(const ValueKey('n0.9')));
      expect(last.right, closeTo(375 - 12, .01));
    });

    testWidgets('a ListView pads inside its viewport', (tester) async {
      setPhone(tester);
      final root = node(
        'n0',
        'ListView',
        props: {
          'style': {'flex': 1, 'padding': 16},
        },
        children: [
          for (var index = 0; index < 10; index++)
            node(
              'n0.$index',
              'View',
              props: {
                'style': {'height': 100},
              },
            ),
        ],
      );
      await tester.pumpWidget(host(root, (_, _, _) {}));

      final viewport = tester.getRect(find.byType(ListView));
      expect(viewport, screen);
      final first = tester.getRect(find.byKey(const ValueKey('n0.0')));
      expect(first.left, 16);
      expect(first.top, 16);

      await scrollToEnd(tester);
      final last = tester.getRect(find.byKey(const ValueKey('n0.9')));
      expect(last.bottom, closeTo(812 - 16, .01));
    });

    testWidgets('a GridView pads inside its viewport', (tester) async {
      setPhone(tester);
      final root = node(
        'n0',
        'GridView',
        props: {
          'numColumns': 2,
          'style': {'flex': 1, 'padding': 16, 'gap': 10, 'aspectRatio': 1},
        },
        children: [
          for (var index = 0; index < 12; index++)
            node(
              'n0.$index',
              'View',
              props: {
                'style': {'backgroundColor': '#ffffff'},
              },
            ),
        ],
      );
      await tester.pumpWidget(host(root, (_, _, _) {}));

      final viewport = tester.getRect(find.byType(GridView));
      expect(viewport, screen);
      final first = tester.getRect(find.byKey(const ValueKey('n0.0')));
      expect(first.left, 16);
      expect(first.top, 16);
      final second = tester.getRect(find.byKey(const ValueKey('n0.1')));
      expect(second.top, closeTo(first.top, .01));
      expect(second.left, closeTo(first.right + 10, .01));
    });

    testWidgets('a ScrollView grid pads inside its viewport', (tester) async {
      setPhone(tester);
      final root = node(
        'n0',
        'ScrollView',
        props: {
          'grid': true,
          'numColumns': 2,
          'style': {'flex': 1, 'padding': 16, 'gap': 10, 'aspectRatio': 1},
        },
        children: [
          for (var index = 0; index < 12; index++)
            node(
              'n0.$index',
              'View',
              props: {
                'style': {'backgroundColor': '#ffffff'},
              },
            ),
        ],
      );
      await tester.pumpWidget(host(root, (_, _, _) {}));

      final viewport = tester.getRect(find.byType(SingleChildScrollView));
      expect(viewport, screen);
      final first = tester.getRect(find.byKey(const ValueKey('n0.0')));
      // One inset, not two: the inner grid must not pad again.
      expect(first.left, 16);
      expect(first.top, 16);
    });

    testWidgets('a page body keeps its header, footer and scroll padding', (
      tester,
    ) async {
      setPhone(tester);
      // The shape `Page` builds in the framework: header, body, footer.
      final root = node(
        'n0',
        'View',
        props: {
          'style': {'flex': 1},
        },
        children: [
          node(
            'n0.0',
            'View',
            props: {
              'style': {'flex': 1},
            },
            children: [
              node(
                'n0.0.0',
                'NavBar',
                props: {'title': 'Khám phá', 'showBack': true},
              ),
              node(
                'n0.0.1',
                'ScrollView',
                props: {
                  'style': {'flex': 1, 'padding': 16, 'gap': 14},
                },
                children: [
                  for (var index = 0; index < 8; index++)
                    node(
                      'n0.0.1.$index',
                      'View',
                      props: {
                        'style': {'height': 100},
                      },
                    ),
                ],
              ),
              node(
                'n0.0.2',
                'TabBar',
                props: {
                  'activeIndex': 0,
                  'tabs': [
                    {'key': 'home', 'label': 'Trang chủ', 'icon': 'home'},
                  ],
                },
              ),
            ],
          ),
        ],
      );
      await tester.pumpWidget(host(root, (_, _, _) {}));

      final header = tester.getRect(find.byKey(const ValueKey('n0.0.0')));
      final body = tester.getRect(find.byType(SingleChildScrollView));
      final footer = tester.getRect(find.byKey(const ValueKey('n0.0.2')));
      expect(body.top, closeTo(header.bottom, .01));
      expect(body.bottom, closeTo(footer.top, .01));
      expect(body.width, 375, reason: 'the body spans the full page width');

      final first = tester.getRect(find.byKey(const ValueKey('n0.0.1.0')));
      expect(first.top, closeTo(header.bottom + 16, .01));

      final position = tester
          .state<ScrollableState>(find.byType(Scrollable).first)
          .position;
      expect(position.viewportDimension, closeTo(body.height, .01));
      position.jumpTo(position.maxScrollExtent);
      await tester.pump();
      final last = tester.getRect(find.byKey(const ValueKey('n0.0.1.7')));
      expect(last.bottom, closeTo(footer.top - 16, .01));
    });

    testWidgets('a nested same-direction list still yields to the page', (
      tester,
    ) async {
      setPhone(tester);
      final root = node(
        'n0',
        'ScrollView',
        props: {
          'style': {'flex': 1, 'padding': 16},
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
                'n0.0.0',
                'ListView',
                props: {
                  'style': {'padding': 8, 'gap': 4},
                },
                children: [
                  for (var index = 0; index < 3; index++)
                    text('n0.0.0.$index', 'Dòng $index'),
                ],
              ),
            ],
          ),
        ],
      );
      await tester.pumpWidget(host(root, (_, _, _) {}));

      expect(tester.takeException(), isNull);
      expect(find.text('Dòng 2'), findsOneWidget);
      final first = tester.getRect(find.byKey(const ValueKey('n0.0.0.0')));
      expect(
        first.top,
        16 + 8,
        reason: 'outer and inner padding each apply once',
      );
    });

    testWidgets('scroll events still fire when a scroller has padding', (
      tester,
    ) async {
      setPhone(tester);
      final events = <(String, String, Object?)>[];
      final root = node(
        'n0',
        'ScrollView',
        props: {
          'showsScrollIndicator': false,
          'style': {'width': 360, 'height': 300, 'padding': 16},
        },
        events: const ['scroll'],
        children: [
          for (var index = 0; index < 20; index++)
            node(
              'n0.$index',
              'View',
              props: {
                'style': {'height': 60},
              },
            ),
        ],
      );
      await tester.pumpWidget(
        host(root, (id, event, payload) => events.add((id, event, payload))),
      );

      final gesture = await tester.startGesture(
        tester.getCenter(find.byType(SingleChildScrollView)),
      );
      await gesture.moveBy(const Offset(0, -80));
      await tester.pump();
      await gesture.up();
      await tester.pumpAndSettle();

      expect(
        events.where((entry) => entry.$1 == 'n0' && entry.$2 == 'scroll'),
        isNotEmpty,
        reason: 'padding must not swallow the scroll notification',
      );
    });

    testWidgets('endReached still fires on a padded ListView', (tester) async {
      setPhone(tester);
      final events = <(String, String, Object?)>[];
      final root = node(
        'n0',
        'ListView',
        props: {
          'style': {'flex': 1, 'padding': 16},
        },
        events: const ['endReached'],
        children: [
          for (var index = 0; index < 20; index++)
            node(
              'n0.$index',
              'View',
              props: {
                'style': {'height': 100},
              },
            ),
        ],
      );
      await tester.pumpWidget(
        host(root, (id, event, payload) => events.add((id, event, payload))),
      );

      await scrollToEnd(tester);
      expect(
        events.where((entry) => entry.$1 == 'n0' && entry.$2 == 'endReached'),
        isNotEmpty,
      );
    });
  });
}
