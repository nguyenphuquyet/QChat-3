import 'qapp_contract.generated.dart';
import 'qapp_style.dart';

/// Node types and event names the Flutter renderer accepts are generated from
/// `packages/contracts/miniapp-ui.contract.json` (see
/// `corepack pnpm contract:generate`), so the TypeScript SDK, this validator and
/// the Studio typings can never disagree. `Row`, `Column`, `ListView` and
/// `GridView` are normalized by the TSX runtime into `View` and `ScrollView` but
/// stay accepted.
///
/// `qappNodeTypes` and `qappEventNames` come from
/// `qapp_contract.generated.dart`.

class QappTreeException implements Exception {
  const QappTreeException(this.code, this.message);

  final String code;
  final String message;

  @override
  String toString() => '$code: $message';
}

class QappTree {
  const QappTree({
    required this.version,
    required this.appId,
    required this.root,
    required this.revision,
    required this.nodeCount,
    this.screen = '',
  });

  final int version;
  final String appId;
  final QappNode? root;
  final int revision;
  final int nodeCount;

  /// Which screen the frame belongs to.
  ///
  /// Node ids are positional (`n0.1.0`), so the same id can name a different
  /// widget in another screen. The runtime sends the component trail that
  /// produced the frame's root node, which is stable while the screen stays
  /// mounted and different for every other screen. The renderer uses it to keep
  /// per-screen widget state apart — a `ScrollView` in one tab must not inherit
  /// the offset of another, and the offset must come back when the user returns.
  ///
  /// Empty when the runtime is too old to send one; every frame then behaves as
  /// one screen, which is the previous behaviour.
  final String screen;

  factory QappTree.fromJson(Map<String, dynamic> json) {
    final budget = _TreeBudget();
    final rootValue = json['root'];
    final root = rootValue == null ? null : _parseNode(rootValue, budget, 0);
    return QappTree(
      version: json['v'] is num ? (json['v'] as num).round() : 1,
      appId: json['appId']?.toString() ?? '',
      screen: json['screen']?.toString() ?? '',
      root: root,
      revision: json['revision'] is num ? (json['revision'] as num).round() : 0,
      nodeCount: budget.nodes,
    );
  }
}

class QappNode {
  QappNode({
    required this.id,
    required this.type,
    required this.props,
    required this.events,
    required this.children,
    required this.style,
  });

  final String id;
  final String type;
  final Map<String, dynamic> props;
  final Set<String> events;
  final List<QappNode> children;
  final QappStyle style;

  bool hasEvent(String event) => events.contains(event);

  String get text => props['text']?.toString() ?? '';
}

class _TreeBudget {
  static const maxNodes = 4000;
  static const maxDepth = 64;
  static const maxStringChars = 8 * 1024 * 1024;
  int nodes = 0;
  int stringChars = 0;

  void countString(Object? value) {
    if (value is String) {
      stringChars += value.length;
      if (stringChars > maxStringChars) {
        throw const QappTreeException(
          'TREE_TOO_LARGE',
          'Render frame is too large',
        );
      }
    }
  }
}

QappNode _parseNode(Object? raw, _TreeBudget budget, int depth) {
  if (raw is! Map) {
    throw const QappTreeException('TREE_INVALID', 'Node must be an object');
  }
  if (depth > _TreeBudget.maxDepth) {
    throw const QappTreeException('TREE_TOO_DEEP', 'Render tree is too deep');
  }
  budget.nodes += 1;
  if (budget.nodes > _TreeBudget.maxNodes) {
    throw const QappTreeException('TREE_TOO_LARGE', 'Too many nodes');
  }
  final type = raw['type'];
  if (type is! String || !qappNodeTypes.contains(type)) {
    throw QappTreeException(
      'UNSUPPORTED_COMPONENT',
      'Unsupported component ${type ?? 'null'}',
    );
  }
  final id = raw['id'];
  if (id is! String || id.isEmpty || id.length > 160) {
    throw const QappTreeException('TREE_INVALID', 'Node id is invalid');
  }
  final rawProps = raw['props'];
  if (rawProps != null && rawProps is! Map) {
    throw const QappTreeException(
      'TREE_INVALID',
      'Node props must be an object',
    );
  }
  final props = <String, dynamic>{};
  if (rawProps is Map) {
    for (final entry in rawProps.entries) {
      final key = entry.key.toString();
      if (key == '__events') continue;
      budget.countString(entry.value);
      props[key] = entry.value;
    }
  }

  final events = <String>{};
  final rawEvents =
      raw['events'] ?? (rawProps is Map ? rawProps['__events'] : null);
  if (rawEvents != null) {
    if (rawEvents is! List) {
      throw const QappTreeException(
        'TREE_INVALID',
        'Node events must be a list',
      );
    }
    for (final event in rawEvents) {
      final name = event?.toString() ?? '';
      if (!qappEventNames.contains(name)) {
        throw QappTreeException('TREE_INVALID', 'Unknown event $name');
      }
      events.add(name);
    }
  }

  final rawChildren = raw['children'];
  if (rawChildren != null && rawChildren is! List) {
    throw const QappTreeException(
      'TREE_INVALID',
      'Node children must be a list',
    );
  }
  if (rawChildren is List && rawChildren.length > 1000) {
    throw const QappTreeException('TREE_TOO_LARGE', 'Too many children');
  }
  final children = <QappNode>[
    if (rawChildren is List)
      for (final child in rawChildren) _parseNode(child, budget, depth + 1),
  ];

  QappStyle style;
  try {
    style = QappStyle.fromMap(props['style']);
  } on QappStyleException catch (error) {
    throw QappTreeException(error.code, error.message);
  }

  return QappNode(
    id: id,
    type: type,
    props: props,
    events: events,
    children: children,
    style: style,
  );
}

/// Collects the text content of a node the same way the TypeScript test
/// harness does, so a `Text` wrapper can render its `#text` descendants.
String qappTextContent(QappNode? node, {int limit = 200000}) {
  if (node == null) return '';
  final buffer = StringBuffer();
  void walk(QappNode current) {
    if (buffer.length >= limit) return;
    if (current.type == '#text') {
      buffer.write(current.text);
      return;
    }
    for (final child in current.children) {
      walk(child);
      if (buffer.length >= limit) return;
    }
  }

  walk(node);
  return buffer.toString();
}
