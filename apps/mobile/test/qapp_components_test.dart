import 'package:flutter/gestures.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/core/design_system/components.dart';
import 'package:qchat/core/design_system/qchat_glass.dart';
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

QappTree tree(QappNode root) => QappTree(
  version: 1,
  appId: 'mp_test',
  root: root,
  revision: 1,
  nodeCount: 1,
);

/// Records compare their fields with `==`, which is identity for a map, so a
/// record built from a map literal never equals the received one. Compare the
/// payload on its own instead, where `equals` walks the map by content.
void expectEvent(
  List<(String, String, Object?)> events,
  String id,
  String event,
  Object? payload,
) {
  final matches = events
      .where((entry) => entry.$1 == id && entry.$2 == event)
      .toList();
  expect(matches, isNotEmpty, reason: 'no $event event for $id in $events');
  expect(matches.last.$3, payload);
}

Widget host(QappNode root, void Function(String, String, Object?) onEvent) {
  return qchatHarness(
    QappRenderer(root: root, onEvent: onEvent, loadAsset: (_) async => null),
  );
}

void main() {
  test('parses the new component types from a frame', () {
    final parsed = QappTree.fromJson({
      'v': 1,
      'appId': 'mp_test',
      'revision': 3,
      'root': {
        'id': 'n0',
        'type': 'NavBar',
        'props': {'title': 'Home'},
        'events': ['back'],
        'children': [
          {
            'id': 'n0.0',
            'type': 'TabBar',
            'props': {
              'activeIndex': 0,
              'tabs': [
                {'key': 'home', 'label': 'Home', 'icon': 'home'},
              ],
            },
            'events': ['change'],
          },
          {
            'id': 'n0.1',
            'type': 'Dialog',
            'props': {'visible': false, 'title': 'Sure?'},
            'events': ['close', 'confirm'],
          },
          {
            'id': 'n0.2',
            'type': 'ListView',
            'props': {'totalCount': 2},
            'children': [
              {
                'id': 'n0.2.0',
                'type': 'Text',
                'children': [
                  {'id': 'n0.2.0.0', 'type': '#text', 'props': {'text': 'row'}},
                ],
              },
            ],
          },
        ],
      },
    });
    expect(parsed.root!.type, 'NavBar');
    expect(parsed.root!.children.map((child) => child.type), [
      'TabBar',
      'Dialog',
      'ListView',
    ]);
    expect(parsed.root!.children[1].hasEvent('confirm'), isTrue);
  });

  test('rejects an event name that is not in the contract', () {
    expect(
      () => QappTree.fromJson({
        'v': 1,
        'appId': 'mp_test',
        'revision': 1,
        'root': {
          'id': 'n0',
          'type': 'View',
          'props': {},
          'events': ['teleport'],
        },
      }),
      throwsA(isA<QappTreeException>()),
    );
  });

  testWidgets('renders a lazy ListView with its items', (tester) async {
    final root = node(
      'n0',
      'ListView',
      props: {'totalCount': 3},
      children: [
        for (var index = 0; index < 3; index++)
          node(
            'n0.$index',
            'Text',
            children: [
              node('n0.$index.0', '#text', props: {'text': 'row $index'}),
            ],
          ),
      ],
    );
    await tester.pumpWidget(host(root, (_, _, _) {}));
    expect(find.byType(ListView), findsOneWidget);
    expect(find.text('row 0'), findsOneWidget);
    expect(find.text('row 2'), findsOneWidget);
  });

  testWidgets('renders a TabBar and reports the tapped tab', (tester) async {
    final events = <(String, String, Object?)>[];
    final root = node(
      'n0',
      'TabBar',
      props: {
        'activeIndex': 0,
        'tabs': [
          {'key': 'home', 'label': 'Home', 'icon': 'home'},
          {'key': 'jobs', 'label': 'Jobs', 'icon': 'briefcase'},
        ],
      },
      events: const ['change'],
    );
    await tester.pumpWidget(
      host(root, (id, event, payload) => events.add((id, event, payload))),
    );
    await tester.tap(find.text('Jobs'));
    await tester.pump();
    expectEvent(events, 'n0', 'change', {
      'type': 'change',
      'index': 1,
      'key': 'jobs',
      'value': {'index': 1, 'key': 'jobs', 'value': 'jobs'},
    });
  });

  testWidgets('shows and dismisses a Dialog', (tester) async {
    final events = <(String, String, Object?)>[];
    final root = node(
      'n0',
      'Dialog',
      props: {
        'visible': true,
        'title': 'Delete chat?',
        'confirmText': 'Delete',
        'cancelText': 'Cancel',
      },
      events: const ['close', 'confirm'],
      children: [
        node(
          'n0.0',
          'Text',
          children: [node('n0.0.0', '#text', props: {'text': 'This cannot be undone'})],
        ),
      ],
    );
    await tester.pumpWidget(
      host(root, (id, event, payload) => events.add((id, event, payload))),
    );
    expect(find.text('Delete chat?'), findsOneWidget);
    await tester.tap(find.text('Delete'));
    await tester.pump();
    expectEvent(events, 'n0', 'confirm', {'type': 'confirm'});
    await tester.tap(find.text('Cancel'));
    await tester.pump();
    expectEvent(events, 'n0', 'close', {'type': 'close'});
  });

  testWidgets('NavBar reports back from its leading arrow', (tester) async {
    final events = <(String, String, Object?)>[];
    final root = node(
      'n0',
      'NavBar',
      props: {'title': 'Inbox', 'showBack': true, 'safeArea': false},
      events: const ['back'],
    );
    await tester.pumpWidget(
      host(root, (id, event, payload) => events.add((id, event, payload))),
    );
    expect(find.text('Inbox'), findsOneWidget);
    await tester.tap(
      find.byWidgetPredicate(
        (w) => w is QChatIcon && w.name == 'arrowLeft',
      ),
    );
    await tester.pump();
    expectEvent(events, 'n0', 'back', {'type': 'back'});
  });

  testWidgets('NavBar centres its title on the header line', (tester) async {
    final root = node(
      'n0',
      'NavBar',
      props: {'title': 'Inbox', 'showBack': true, 'safeArea': false},
      events: const ['back'],
    );
    await tester.pumpWidget(host(root, (_, _, _) {}));
    final header = tester.getRect(find.byType(QChatHeader));
    final title = tester.getCenter(find.text('Inbox'));
    expect(title.dx, closeTo(header.center.dx, .01));
    // The title sits on the 44 pt bar, not somewhere below it.
    expect(title.dy, closeTo(header.top + kQChatHeaderHeight / 2, .01));
  });

  testWidgets('NavBar children become the rows under the title bar', (
    tester,
  ) async {
    final root = node(
      'n0',
      'NavBar',
      props: {'title': 'Inbox', 'safeArea': false},
      children: [node('n0.0', 'Text', props: {'testID': 'row'}, children: [
        node('n0.0.0', '#text', props: {'text': 'Rows'}),
      ])],
    );
    await tester.pumpWidget(host(root, (_, _, _) {}));
    final header = tester.getRect(find.byType(QChatHeader));
    final row = tester.getRect(find.text('Rows'));
    expect(row.top, greaterThanOrEqualTo(header.top + kQChatHeaderHeight));
    expect(header.height, greaterThan(kQChatHeaderHeight));
  });

  testWidgets('a transparent NavBar paints no surface', (tester) async {
    final root = node(
      'n0',
      'NavBar',
      props: {'title': 'Inbox', 'safeArea': false, 'transparent': true},
    );
    await tester.pumpWidget(host(root, (_, _, _) {}));
    expect(find.text('Inbox'), findsOneWidget);
    expect(
      find.descendant(
        of: find.byType(QChatHeader),
        matching: find.byType(DecoratedBox),
      ),
      findsNothing,
    );
  });

  testWidgets('a blurred NavBar uses the glass surface', (tester) async {
    final root = node(
      'n0',
      'NavBar',
      props: {'title': 'Inbox', 'safeArea': false, 'blur': true},
    );
    await tester.pumpWidget(host(root, (_, _, _) {}));
    expect(find.text('Inbox'), findsOneWidget);
    expect(
      find.descendant(
        of: find.byType(QChatHeader),
        matching: find.byType(QChatGlass),
      ),
      findsOneWidget,
    );
  });

  testWidgets('a hidden BottomSheet renders nothing', (tester) async {
    final root = node(
      'n0',
      'BottomSheet',
      props: {'visible': false},
      children: [node('n0.0', 'Text')],
    );
    await tester.pumpWidget(host(root, (_, _, _) {}));
    expect(find.byType(SingleChildScrollView), findsNothing);
  });

  testWidgets('RichText merges inline styles and links report press', (
    tester,
  ) async {
    final events = <(String, String, Object?)>[];
    final root = node(
      'n0',
      'RichText',
      props: {'numberOfLines': 2},
      children: [
        node(
          'n0.0',
          'Text',
          props: {
            'style': {'fontWeight': 'bold'},
          },
          children: [node('n0.0.0', '#text', props: {'text': 'Bold'})],
        ),
        node('n0.1', '#text', props: {'text': ' and '}),
        node(
          'n0.2',
          'Link',
          props: {'href': '/details'},
          events: const ['press'],
          children: [node('n0.2.0', '#text', props: {'text': 'more'})],
        ),
      ],
    );
    await tester.pumpWidget(
      host(root, (id, event, payload) => events.add((id, event, payload))),
    );
    final paragraph = tester.widget<Text>(
      find.byWidgetPredicate((widget) => widget is Text && widget.textSpan != null),
    );
    final span = paragraph.textSpan! as TextSpan;
    expect(paragraph.maxLines, 2);
    expect(span.children!.length, 3);
    final bold = span.children![0] as TextSpan;
    expect(bold.text, 'Bold');
    expect(bold.style?.fontWeight, FontWeight.bold);
    final link = span.children![2] as TextSpan;
    expect(link.text, 'more');
    expect(link.style?.decoration, TextDecoration.underline);
    expect(link.style?.color, QChatColors.green);
    expect(link.recognizer, isA<TapGestureRecognizer>());
    (link.recognizer! as TapGestureRecognizer).onTap!();
    await tester.pump();
    expectEvent(events, 'n0.2', 'press', {
      'type': 'press',
      'href': '/details',
      'external': false,
    });
  });

  testWidgets('Link renders an underlined label and reports its href', (
    tester,
  ) async {
    final events = <(String, String, Object?)>[];
    final root = node(
      'n0',
      'Link',
      props: {'href': '/details'},
      events: const ['press'],
      children: [node('n0.0', '#text', props: {'text': 'Details'})],
    );
    await tester.pumpWidget(
      host(root, (id, event, payload) => events.add((id, event, payload))),
    );
    final label = tester.widget<Text>(find.text('Details'));
    expect(label.style?.decoration, TextDecoration.underline);
    await tester.tap(find.text('Details'));
    await tester.pump();
    expectEvent(events, 'n0', 'press', {
      'type': 'press',
      'href': '/details',
      'external': false,
    });
  });

  testWidgets('a disabled Link is muted and does not react', (tester) async {
    final events = <(String, String, Object?)>[];
    final root = node(
      'n0',
      'Link',
      props: {'href': '/details', 'disabled': true},
      events: const ['press'],
      children: [node('n0.0', '#text', props: {'text': 'Details'})],
    );
    await tester.pumpWidget(
      host(root, (id, event, payload) => events.add((id, event, payload))),
    );
    expect(tester.widget<Text>(find.text('Details')).style?.color, QChatColors.muted);
    await tester.tap(find.text('Details'));
    await tester.pump();
    expect(events, isEmpty);
  });

  testWidgets('Badge caps its count, draws a dot and hides at zero', (
    tester,
  ) async {
    QappNode badge(Map<String, dynamic> props) =>
        node('n0', 'Badge', props: props);

    await tester.pumpWidget(host(badge({'count': 120, 'max': 99}), (_, _, _) {}));
    expect(find.text('99+'), findsOneWidget);

    await tester.pumpWidget(host(badge({'count': 0}), (_, _, _) {}));
    expect(find.byType(Text), findsNothing);

    await tester.pumpWidget(host(badge({'dot': true}), (_, _, _) {}));
    expect(find.byType(Text), findsNothing);
    expect(
      find.byWidgetPredicate(
        (widget) =>
            widget is Container &&
            widget.decoration is BoxDecoration &&
            (widget.decoration! as BoxDecoration).shape == BoxShape.circle,
      ),
      findsOneWidget,
    );

    await tester.pumpWidget(
      host(badge({'count': 5, 'visible': false}), (_, _, _) {}),
    );
    expect(find.byType(Text), findsNothing);
  });

  testWidgets('Badge overlays its child without changing its size', (
    tester,
  ) async {
    final root = node(
      'n0',
      'Badge',
      props: {'count': 3},
      children: [
        node('n0.0', 'Avatar', props: {'name': 'Quyet', 'size': 40}),
      ],
    );
    await tester.pumpWidget(host(root, (_, _, _) {}));
    expect(find.text('3'), findsOneWidget);
    expect(find.byType(Stack), findsOneWidget);
    expect(
      find.byWidgetPredicate(
        (widget) => widget is SizedBox && widget.width == 40 && widget.height == 40,
      ),
      findsOneWidget,
    );
  });

  testWidgets('Tag paints its tone from the design system', (tester) async {
    final root = node(
      'n0',
      'View',
      children: [
        node(
          'n0.0',
          'Tag',
          props: {'tone': 'danger', 'size': 'sm'},
          children: [node('n0.0.0', '#text', props: {'text': 'Hot'})],
        ),
        node(
          'n0.1',
          'Tag',
          props: {'tone': 'success'},
          children: [node('n0.1.0', '#text', props: {'text': 'Done'})],
        ),
      ],
    );
    await tester.pumpWidget(host(root, (_, _, _) {}));
    expect(tester.widget<Text>(find.text('Hot')).style?.color, const Color(0xffe5484d));
    expect(tester.widget<Text>(find.text('Done')).style?.color, QChatColors.green);
  });

  testWidgets('Avatar falls back to initials and honours its shape', (
    tester,
  ) async {
    final root = node(
      'n0',
      'Avatar',
      props: {'name': 'quyet guic', 'size': 40, 'shape': 'rounded'},
    );
    await tester.pumpWidget(host(root, (_, _, _) {}));
    expect(find.text('QG'), findsOneWidget);
    final clip = tester.widget<ClipRRect>(find.byType(ClipRRect));
    final radius = clip.borderRadius as BorderRadius;
    // `40 * 0.28` is not exactly 11.2 in binary floating point, so compare the
    // radius with a tolerance instead of `BorderRadius.circular(11.2)`.
    expect(radius.topLeft.x, closeTo(11.2, 0.001));
    expect(radius.topRight.x, closeTo(11.2, 0.001));
    expect(
      find.byWidgetPredicate(
        (widget) => widget is SizedBox && widget.width == 40 && widget.height == 40,
      ),
      findsOneWidget,
    );
  });

  testWidgets('Avatar shows an icon when it has neither image nor name', (
    tester,
  ) async {
    final root = node('n0', 'Avatar', props: {'size': 32});
    await tester.pumpWidget(host(root, (_, _, _) {}));
    expect(
      find.byWidgetPredicate(
        (widget) => widget is QChatIcon && widget.name == 'user',
      ),
      findsOneWidget,
    );
  });

  testWidgets('Button supports the outline variant and every size', (
    tester,
  ) async {
    final events = <(String, String, Object?)>[];
    final root = node(
      'n0',
      'Button',
      props: {'variant': 'outline', 'size': 'sm'},
      events: const ['press'],
      children: [node('n0.0', '#text', props: {'text': 'Add'})],
    );
    await tester.pumpWidget(
      host(root, (id, event, payload) => events.add((id, event, payload))),
    );
    final container = tester.widget<Container>(
      find.ancestor(of: find.text('Add'), matching: find.byType(Container)).first,
    );
    final decoration = container.decoration! as BoxDecoration;
    expect(decoration.color, QChatColors.transparent);
    expect(decoration.border, isNotNull);
    expect(container.constraints, const BoxConstraints(minHeight: 32, minWidth: 64));
    await tester.tap(find.text('Add'));
    await tester.pump();
    expectEvent(events, 'n0', 'press', null);
  });

  testWidgets('Divider draws a vertical rule with a leading inset', (
    tester,
  ) async {
    final root = node(
      'n0',
      'Row',
      children: [
        node(
          'n0.0',
          'Divider',
          props: {'vertical': true, 'thickness': 2, 'inset': 8},
        ),
      ],
    );
    await tester.pumpWidget(host(root, (_, _, _) {}));
    expect(
      find.byWidgetPredicate(
        (widget) => widget is SizedBox && widget.width == 2,
      ),
      findsOneWidget,
    );
    final padding = tester.widget<Padding>(
      find.ancestor(
        of: find.byWidgetPredicate(
          (widget) => widget is SizedBox && widget.width == 2,
        ),
        matching: find.byType(Padding),
      ).first,
    );
    expect(padding.padding, const EdgeInsets.only(top: 8));
  });

  testWidgets('Spacer clamps an invalid size instead of overflowing', (
    tester,
  ) async {
    final root = node('n0', 'View', children: [node('n0.0', 'Spacer', props: {'size': -40})]);
    await tester.pumpWidget(host(root, (_, _, _) {}));
    expect(tester.takeException(), isNull);
  });

  testWidgets('base props map to keys, semantics and pointer events', (
    tester,
  ) async {
    final handle = tester.ensureSemantics();
    final root = node(
      'n0',
      'Text',
      props: {
        'testID': 'greeting',
        'accessibleLabel': 'Greeting text',
        'pointerEvents': 'none',
      },
      children: [node('n0.0', '#text', props: {'text': 'Hello'})],
    );
    await tester.pumpWidget(host(root, (_, _, _) {}));
    final keyed = find.byKey(const ValueKey('greeting'));
    expect(keyed, findsOneWidget);
    expect(find.bySemanticsLabel('Greeting text'), findsOneWidget);
    expect(
      find.descendant(of: keyed, matching: find.byType(IgnorePointer)),
      findsOneWidget,
    );
    handle.dispose();
  });

  testWidgets('selectable text opts into native selection', (tester) async {
    final plain = node(
      'n0',
      'Text',
      children: [node('n0.0', '#text', props: {'text': 'Plain'})],
    );
    await tester.pumpWidget(host(plain, (_, _, _) {}));
    expect(find.byType(SelectableRegion), findsNothing);

    final selectable = node(
      'n0',
      'Text',
      props: {'selectable': true},
      children: [node('n0.0', '#text', props: {'text': 'Copy me'})],
    );
    await tester.pumpWidget(host(selectable, (_, _, _) {}));
    expect(find.byType(SelectableRegion), findsOneWidget);
  });
}
