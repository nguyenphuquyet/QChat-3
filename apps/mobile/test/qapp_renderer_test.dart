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
      body: QappRenderer(
        root: root,
        onEvent: onEvent,
        loadAsset: (_) async => null,
      ),
    ),
  );
}

void main() {
  testWidgets('renders text and dispatches button presses', (tester) async {
    final events = <(String, String, Object?)>[];
    final root = node(
      'n0',
      'View',
      props: {
        'style': {'flexDirection': 'column', 'gap': 8},
      },
      children: [
        node(
          'n0.0',
          'Text',
          children: [
            node('n0.0.0', '#text', props: {'text': 'Hello native'}),
          ],
        ),
        node(
          'n0.1',
          'Button',
          props: {'variant': 'primary'},
          events: const ['press'],
          children: [
            node('n0.1.0', '#text', props: {'text': 'Tap me'}),
          ],
        ),
      ],
    );
    await tester.pumpWidget(
      host(root, (id, event, payload) => events.add((id, event, payload))),
    );
    expect(find.text('Hello native'), findsOneWidget);
    await tester.tap(find.text('Tap me'));
    await tester.pump();
    expect(events, contains(('n0.1', 'press', null)));
  });

  testWidgets('text fields, checkboxes and switches emit state changes', (
    tester,
  ) async {
    final events = <(String, String, Object?)>[];
    final root = node(
      'n0',
      'View',
      props: {
        'style': {'flexDirection': 'column', 'gap': 8},
      },
      children: [
        node(
          'n0.0',
          'TextField',
          props: {'value': '', 'placeholder': 'Name'},
          events: const ['input', 'submit'],
        ),
        node(
          'n0.1',
          'Checkbox',
          props: {'checked': false, 'label': 'Agree'},
          events: const ['change'],
        ),
        node(
          'n0.2',
          'Switch',
          props: {'value': false},
          events: const ['valueChange'],
        ),
      ],
    );
    await tester.pumpWidget(
      host(root, (id, event, payload) => events.add((id, event, payload))),
    );
    await tester.enterText(find.byType(TextField), 'Ada');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pump();
    expectEvent(events, 'n0.0', 'input', 'Ada');
    expectEvent(events, 'n0.0', 'submit', {
      'type': 'submit',
      'value': 'Ada',
      'text': 'Ada',
    });

    await tester.tap(find.text('Agree'));
    await tester.pumpAndSettle();
    expectEvent(events, 'n0.1', 'change', {'type': 'change', 'value': true});

    await tester.tap(find.byType(Switch));
    await tester.pumpAndSettle();
    expectEvent(events, 'n0.2', 'valueChange', {
      'type': 'valueChange',
      'value': true,
    });
  });

  testWidgets('renders stacks, scroll views, sliders and custom paint', (
    tester,
  ) async {
    final events = <(String, String, Object?)>[];
    final root = node(
      'n0',
      'Stack',
      props: {'alignment': 'center'},
      children: [
        node(
          'n0.0',
          'ScrollView',
          props: {'vertical': true},
          children: [
            node(
              'n0.0.0',
              'Text',
              children: [
                node('n0.0.0.0', '#text', props: {'text': 'Scrolled'}),
              ],
            ),
          ],
        ),
        node(
          'n0.1',
          'Positioned',
          props: {
            'style': {'position': 'absolute', 'top': 4, 'right': 4},
          },
          children: [
            node(
              'n0.1.0',
              'Slider',
              props: {'value': 2, 'min': 0, 'max': 10, 'step': 1},
              events: const ['valueChange'],
            ),
          ],
        ),
        node(
          'n0.2',
          'CustomPaint',
          props: {'draw': 'fill:#07c160 M 0 0 L 20 0 L 10 20 Z'},
        ),
      ],
    );
    await tester.pumpWidget(
      host(root, (id, event, payload) => events.add((id, event, payload))),
    );
    expect(find.text('Scrolled'), findsOneWidget);
    expect(find.byType(Slider), findsOneWidget);
    expect(find.byType(CustomPaint), findsWidgets);
    await tester.tap(find.byType(Slider));
    await tester.pump();
  });
}
