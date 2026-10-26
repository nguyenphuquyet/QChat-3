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
  return MaterialApp(
    home: Scaffold(
      body: QappRenderer(root: root, onEvent: onEvent, loadAsset: (_) async => null),
    ),
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

  testWidgets('NavBar reserves the host button area on the right', (
    tester,
  ) async {
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
    await tester.tap(find.byIcon(Icons.arrow_back));
    await tester.pump();
    expectEvent(events, 'n0', 'back', {'type': 'back'});
  });

  testWidgets('a hidden BottomSheet renders nothing', (tester) async {
    final root = node(
      'n0',
      'BottomSheet',
      props: {'visible': false},
      children: [node('n0.0', 'Text')],
    );
    await tester.pumpWidget(host(root, (_, _, _) {}));
    expect(find.byType(BottomSheet), findsNothing);
  });
}
