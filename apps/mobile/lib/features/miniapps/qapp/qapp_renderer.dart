import 'dart:convert';

import 'package:flutter/cupertino.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/services.dart';

import '../../../core/design_system/components.dart';
import '../../../core/localization/strings.dart';
import 'qapp_custom_paint.dart';
import 'qapp_style.dart';
import 'qapp_tree.dart';

typedef QappEventHandler =
    void Function(String nodeId, String event, Object? payload);
typedef QappAssetLoader = Future<Uint8List?> Function(String path);

/// Turns a validated virtual tree produced by the TSX runtime into real
/// Flutter widgets. Every node type is mapped to a widget the app already
/// trusts; nothing in the package can instantiate arbitrary Dart code.
class QappRenderer extends StatelessWidget {
  const QappRenderer({
    super.key,
    required this.root,
    required this.onEvent,
    required this.loadAsset,
  });

  final QappNode? root;
  final QappEventHandler onEvent;
  final QappAssetLoader loadAsset;

  @override
  Widget build(BuildContext context) {
    final node = root;
    if (node == null) return const SizedBox.shrink();
    return _QappNodeView(
      node: node,
      onEvent: onEvent,
      loadAsset: loadAsset,
      insideFlex: false,
    );
  }
}

class _QappNodeView extends StatelessWidget {
  const _QappNodeView({
    required this.node,
    required this.onEvent,
    required this.loadAsset,
    required this.insideFlex,
    this.insideWrap = false,
    this.placedInStack = false,
  });

  final QappNode node;
  final QappEventHandler onEvent;
  final QappAssetLoader loadAsset;
  final bool insideFlex;

  /// True when this node is an item of a wrapping flex. Such an item is sized
  /// by its own content, so its children must not be stretched across a width
  /// the item has not earned yet.
  final bool insideWrap;

  /// True when a `Stack` already positioned this node. Its `left`/`top` are
  /// applied by `Positioned`, so the fallback translation must not run again.
  final bool placedInStack;

  @override
  Widget build(BuildContext context) {
    final style = node.style;
    var child = _content(context);
    child = _decorate(context, child);
    if (style.isAbsolute && !placedInStack) {
      // Positioned only makes sense inside a Stack; standalone nodes simply
      // keep their declared offsets as a translation.
      if (style.left != null || style.top != null) {
        child = Transform.translate(
          offset: Offset(style.left ?? 0, style.top ?? 0),
          child: child,
        );
      }
    }
    if (style.rotate != 0) {
      child = Transform.rotate(angle: style.rotate, child: child);
    }
    if (style.scale != 1) {
      child = Transform.scale(scale: style.scale, child: child);
    }
    if (style.translateX != 0 || style.translateY != 0) {
      child = Transform.translate(
        offset: Offset(style.translateX, style.translateY),
        child: child,
      );
    }
    if (style.opacity < 1) {
      child = Opacity(opacity: style.opacity, child: child);
    }
    // Base props every component inherits from the contract.
    if (node.props['pointerEvents'] == 'none') {
      child = IgnorePointer(child: child);
    }
    final label = node.props['accessibleLabel'];
    // `Button` builds its own semantics node from the same label, so wrapping
    // it again would make a screen reader announce the label twice.
    if (label is String && label.isNotEmpty && node.type != 'Button') {
      // A label is a boundary of its own, so a screen reader does not read it
      // glued to the child paragraph ("Greeting text\nHello").
      //
      // A plain text leaf has nothing to add to the label, so its text is
      // dropped instead of being read twice. An interactive node (or one with
      // richer children) keeps its subtree: dropping it would also drop the
      // tap action a `Pressable` or `Link` needs.
      final replacesText =
          node.events.isEmpty &&
          node.children.every((child) => child.type == '#text');
      child = Semantics(
        container: true,
        label: label,
        excludeSemantics: replacesText,
        child: child,
      );
    }
    final testID = node.props['testID'];
    return KeyedSubtree(
      key: ValueKey(testID is String && testID.isNotEmpty ? testID : node.id),
      child: child,
    );
  }

  Widget _content(BuildContext context) {
    final style = node.style;
    switch (node.type) {
      case '#text':
        return Text(
          node.text,
          style: style.toTextStyle(
            fallbackColor: ink(context),
            fallbackSize: 15,
          ),
        );
      case 'Text':
        return _text(context);
      case 'RichText':
        return _richText(context);
      case 'Link':
        return _link(context);
      case 'Badge':
        return _badge(context);
      case 'Tag':
        return _tag(context);
      case 'Avatar':
        return _avatar(context);
      case 'View':
        return _flex(context);
      case 'Row':
        return _flex(context, forceRow: true);
      case 'Column':
        return _flex(context, forceRow: false);
      case 'ScrollView':
        return _scroll(context);
      case 'ListView':
      case 'GridView':
        return _lazyList(context);
      case 'Modal':
        return _modal(context);
      case 'BottomSheet':
        return _bottomSheet(context);
      case 'Dialog':
        return _dialog(context);
      case 'NavBar':
        return _navBar(context);
      case 'TabBar':
        return _tabBar(context);
      case 'Stack':
        return _stack(context);
      case 'Positioned':
        return _positionedContent(context);
      case 'Button':
        return _button(context);
      case 'Pressable':
        return _pressable(context);
      case 'Image':
        return _image(context);
      case 'Icon':
        return _icon();
      case 'TextField':
        return _textField(context);
      case 'Checkbox':
        return _checkbox(context);
      case 'Switch':
        return _switch(context);
      case 'Slider':
        return _slider(context);
      case 'Spacer':
        return _spacer(context);
      case 'Divider':
        return _divider(context);
      case 'ActivityIndicator':
        return _activityIndicator();
      case 'SafeArea':
        return _safeArea(context);
      case 'AnimatedView':
        return _animated(context);
      case 'CustomPaint':
        return _customPaint();
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _text(BuildContext context) {
    final style = node.style;
    final raw = qappTextContent(node);
    final content = _transform(raw, style.textTransform);
    final textStyle = style.toTextStyle(
      fallbackColor: ink(context),
      fallbackSize: 15,
    );
    final maxLines = node.props['numberOfLines'];
    final lines = maxLines is num
        ? maxLines.round()
        : style.numberOfLines;
    final text = Text(
      content,
      maxLines: lines,
      overflow: lines == null ? TextOverflow.clip : TextOverflow.ellipsis,
      style: textStyle,
      textAlign: style.textAlign,
    );
    // Real text selection with a QChat copy bubble. `SelectionArea` lives in
    // Material, so the renderer builds the widgets-level `SelectableRegion`
    // itself and supplies its own toolbar.
    if (node.props['selectable'] == true) {
      return _selectable(context, text);
    }
    return text;
  }

  /// Inline text with mixed styles.
  ///
  /// `RichText` never receives HTML: its children are the same `Text`, `Link`
  /// and `#text` nodes as everywhere else, and each one contributes a span with
  /// its own style. Links become tappable spans, so the paragraph still wraps
  /// and aligns as one run of text.
  Widget _richText(BuildContext context) {
    final maxLines = node.props['numberOfLines'];
    return _QappRichText(
      key: ValueKey('${node.id}:rich'),
      node: node,
      onEvent: onEvent,
      baseStyle: node.style.toTextStyle(
        fallbackColor: ink(context),
        fallbackSize: 15,
      ),
      maxLines: maxLines is num ? maxLines.round() : node.style.numberOfLines,
      textAlign: node.style.textAlign,
      selectable: node.props['selectable'] == true,
    );
  }

  Widget _link(BuildContext context) {
    final disabled = node.props['disabled'] == true;
    final style = node.style.toTextStyle(
      fallbackColor: disabled ? qchatMuted(context) : QChatColors.green,
      fallbackSize: 15,
    );
    final text = Text(
      qappTextContent(node),
      maxLines: node.style.numberOfLines,
      style: style.copyWith(
        decoration: style.decoration ?? TextDecoration.underline,
      ),
      textAlign: node.style.textAlign,
    );
    if (disabled || !node.hasEvent('press')) return text;
    return Semantics(
      link: true,
      label: node.props['accessibleLabel']?.toString(),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => onEvent(node.id, 'press', _linkPayload(node)),
        child: text,
      ),
    );
  }

  static Map<String, Object?> _linkPayload(QappNode link) {
    final href = link.props['href'];
    return {
      'type': 'press',
      'href': href is String ? href : '',
      'external': link.props['external'] == true,
    };
  }

  Widget _badge(BuildContext context) {
    final children = _childWidgets(context);
    final anchor = children.isEmpty
        ? null
        : children.length == 1
        ? children.first
        : _stretchColumn(children);
    if (node.props['visible'] == false) {
      return anchor ?? const SizedBox.shrink();
    }
    final dot = node.props['dot'] == true;
    final count = _number(node.props['count']);
    final label = dot ? '' : _badgeCount(count, node.props['max']);
    if (!dot && label.isEmpty) {
      return anchor ?? const SizedBox.shrink();
    }
    final color = _toneColor(context, node.props['tone']?.toString());
    final pill = dot
        ? Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          )
        : Container(
            constraints: const BoxConstraints(minWidth: 18),
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(9),
            ),
            alignment: Alignment.center,
            child: Text(
              label,
              maxLines: 1,
              style: const TextStyle(
                fontSize: 11,
                height: 1.2,
                fontWeight: FontWeight.w600,
                color: QChatColors.white,
              ),
            ),
          );
    if (anchor == null) return pill;
    return Stack(
      clipBehavior: Clip.none,
      alignment: Alignment.center,
      children: [
        anchor,
        Positioned(top: -6, right: -6, child: pill),
      ],
    );
  }

  /// `count` clamped to a sane range; anything past `max` is shown as `max+`.
  static String _badgeCount(double? count, Object? rawMax) {
    if (count == null || count <= 0) return '';
    final max = (_number(rawMax) ?? 99).clamp(1, 999);
    final value = count.floor();
    return value > max ? '${max.round()}+' : '$value';
  }

  Widget _tag(BuildContext context) {
    final tone = node.props['tone']?.toString() ?? 'neutral';
    final size = node.props['size']?.toString() ?? 'md';
    final (fontSize, horizontal, vertical) = switch (size) {
      'sm' => (11.0, 6.0, 1.0),
      'lg' => (14.0, 10.0, 4.0),
      _ => (12.0, 8.0, 2.0),
    };
    final foreground = tone == 'neutral'
        ? qchatInk(context)
        : _toneColor(context, tone);
    final background =
        node.style.backgroundColor ??
        (tone == 'neutral'
            ? qchatFill(context)
            : foreground.withValues(alpha: .14));
    return Container(
      padding: EdgeInsets.symmetric(horizontal: horizontal, vertical: vertical),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        qappTextContent(node),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: node.style
            .toTextStyle(fallbackColor: foreground, fallbackSize: fontSize)
            .copyWith(fontWeight: node.style.fontWeight ?? FontWeight.w500),
      ),
    );
  }

  Widget _avatar(BuildContext context) {
    final size = (_number(node.props['size']) ?? node.style.width ?? 40).clamp(
      16.0,
      160.0,
    );
    final name = node.props['name']?.toString() ?? '';
    final src = node.props['src']?.toString() ?? '';
    final initials = _avatarInitials(name, size);
    final body = src.isEmpty
        ? initials
        : _imageBody(
            context,
            src,
            BoxFit.cover,
            size,
            size,
            placeholder: initials,
          );
    final radius = node.props['shape'] == 'rounded'
        ? BorderRadius.circular(size * .28)
        : BorderRadius.circular(size / 2);
    return SizedBox(
      width: size,
      height: size,
      child: ClipRRect(borderRadius: radius, child: body),
    );
  }

  Widget _avatarInitials(String name, double size) {
    final initials = _initials(name);
    return Container(
      color: QChatColors.green.withValues(alpha: .16),
      alignment: Alignment.center,
      child: initials.isEmpty
          ? QChatIcon('user', size: size * .5, color: QChatColors.green)
          : Text(
              initials,
              maxLines: 1,
              style: TextStyle(
                fontSize: size * .38,
                fontWeight: FontWeight.w600,
                color: QChatColors.green,
              ),
            ),
    );
  }

  /// First letter of the first two words, which is what a chat avatar shows
  /// when it has no picture.
  static String _initials(String name) {
    final words = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((word) => word.isNotEmpty)
        .take(2)
        .toList(growable: false);
    if (words.isEmpty) return '';
    return words.map((word) => String.fromCharCode(word.runes.first)).join().toUpperCase();
  }

  Widget _flex(BuildContext context, {bool? forceRow}) {
    final isRow = forceRow ?? _isRow(node);
    final reversed = _isReverse(node);
    final wrap =
        node.props['flexWrap'] == 'wrap' || node.style.flexWrap == 'wrap';
    final main = _mainAlignment(node);
    final mainAxisSize = _mainAxisSize;
    final effectiveAxis = isRow ? Axis.horizontal : Axis.vertical;
    // A Column always lays its children out with an unbounded main axis, and a
    // vertical scroller does the same to its content. `stretch`, `spaceBetween`
    // and `Expanded` need a finite extent, so the real constraints decide which
    // of them the node can use.
    return LayoutBuilder(
      builder: (context, constraints) {
        final mainBounded = isRow
            ? constraints.hasBoundedWidth
            : constraints.hasBoundedHeight;
        final crossBounded = isRow
            ? constraints.hasBoundedHeight
            : constraints.hasBoundedWidth;
        final effectiveMain = !mainBounded && main != MainAxisAlignment.start
            ? MainAxisAlignment.start
            : main;
        var cross = _crossAlignment(node);
        // A wrapping flex sizes its items to their own content, the way React
        // Native does: a chip in a `flexWrap: "wrap"` row keeps the width of
        // its label instead of taking the whole row. Flutter hands a `Wrap`
        // child a loose width, and `stretch` against a loose width would make
        // every chip full width and stack the row into a column.
        if (insideWrap && cross == CrossAxisAlignment.stretch) {
          cross = CrossAxisAlignment.start;
        }
        // React Native stretches children across the cross axis by default.
        // Flutter cannot stretch against an infinite constraint (a Row inside
        // a Column, a Column inside a vertical scroller), so fall back to
        // `start` instead of throwing "BoxConstraints forces an infinite
        // height".
        if (cross == CrossAxisAlignment.stretch && !crossBounded) {
          cross = CrossAxisAlignment.start;
        }
        final children = <Widget>[
          for (final child in node.children)
            _buildChild(
              child,
              context,
              parentIsFlex: true,
              allowFlex: mainBounded,
              insideWrap: wrap,
            ),
        ];
        final mainGap = node.style.mainGapFor(isRow);
        final crossGap =
            (isRow ? node.style.rowGap : node.style.columnGap) ??
            node.style.gap;
        if (wrap) {
          return Wrap(
            direction: effectiveAxis,
            alignment: _wrapAlignment(effectiveMain),
            // `alignContent` positions the runs themselves; it falls back to
            // the start of the cross axis, which is what a plain `Wrap` does.
            runAlignment: _wrapAlignment(
              _justifyAlignment(node.style.alignContent),
            ),
            crossAxisAlignment: _wrapCross(cross),
            spacing: mainGap,
            runSpacing: crossGap,
            textDirection: reversed ? TextDirection.rtl : null,
            verticalDirection: reversed && !isRow
                ? VerticalDirection.up
                : VerticalDirection.down,
            children: children,
          );
        }
        return isRow
            ? Row(
                mainAxisAlignment: effectiveMain,
                crossAxisAlignment: cross,
                mainAxisSize: mainAxisSize,
                textDirection: reversed ? TextDirection.rtl : null,
                spacing: mainGap,
                children: children,
              )
            : Column(
                mainAxisAlignment: effectiveMain,
                crossAxisAlignment: cross,
                mainAxisSize: mainAxisSize,
                verticalDirection: reversed && !isRow
                    ? VerticalDirection.up
                    : VerticalDirection.down,
                spacing: mainGap,
                children: children,
              );
      },
    );
  }

  Widget _buildChild(
    QappNode child,
    BuildContext context, {
    required bool parentIsFlex,
    bool allowFlex = true,
    bool insideWrap = false,
  }) {
    Widget widget = _QappNodeView(
      node: child,
      onEvent: onEvent,
      loadAsset: loadAsset,
      insideFlex: parentIsFlex && allowFlex,
      insideWrap: insideWrap,
    );
    if (!parentIsFlex) return widget;
    final style = child.style;
    if (child.type == 'Spacer' &&
        (child.props['size'] == null ||
            (child.props['size'] is num &&
                (child.props['size'] as num) == 0))) {
      // `Spacer` only works when the flex has a finite main axis to share.
      return allowFlex
          ? const Expanded(child: SizedBox.shrink())
          : const SizedBox.shrink();
    }
    // `alignSelf` overrides the parent's cross-axis alignment for one child.
    final alignSelf = style.alignSelf;
    if (alignSelf != null && alignSelf != 'auto') {
      final isRow = _isRow(node);
      if (alignSelf == 'stretch') {
        // React Native stretches the item across the parent's cross axis.
        // Flutter can only do that against a bounded extent, and a Row inside a
        // Column hands its children an unbounded height, so the stretch has to
        // fall back to the item's own size there.
        final item = widget;
        widget = LayoutBuilder(
          builder: (context, constraints) {
            if (isRow) {
              if (!constraints.hasBoundedHeight) return item;
              return SizedBox(height: constraints.maxHeight, child: item);
            }
            if (!constraints.hasBoundedWidth) return item;
            return SizedBox(width: constraints.maxWidth, child: item);
          },
        );
      } else {
        widget = Align(
          alignment: _selfAlignment(alignSelf, isRow),
          widthFactor: isRow ? 1 : null,
          heightFactor: isRow ? null : 1,
          child: widget,
        );
      }
    }
    final basis = style.flexBasis;
    if (basis != null && basis > 0) {
      widget = _isRow(node)
          ? SizedBox(width: basis, child: widget)
          : SizedBox(height: basis, child: widget);
    }
    final flex = style.flex ?? style.flexGrow;
    if (allowFlex && flex != null && flex > 0) {
      return Expanded(flex: flex.round().clamp(1, 1000), child: widget);
    }
    return widget;
  }

  /// A vertical stack that stretches its children across the width — but only
  /// when the host actually hands over a finite width.
  ///
  /// `Pressable`, `SafeArea` and `AnimatedView` default to `stretch`, which is
  /// what lets a button fill its card. The moment one of them is a child of a
  /// `Row`, the cross axis is unbounded, and stretching against infinity makes
  /// the whole subtree infinitely wide: every flex sibling in that row then
  /// receives zero space and its text collapses to one character per line.
  /// `start` keeps the subtree at its natural size instead.
  Widget _stretchColumn(List<Widget> children, {double spacing = 0}) {
    return LayoutBuilder(
      builder: (context, constraints) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: constraints.hasBoundedWidth
            ? CrossAxisAlignment.stretch
            : CrossAxisAlignment.start,
        spacing: spacing,
        children: children,
      ),
    );
  }

  Alignment _selfAlignment(String value, bool isRow) {
    return switch (value) {
      'start' => isRow ? Alignment.topCenter : Alignment.centerLeft,
      'end' => isRow ? Alignment.bottomCenter : Alignment.centerRight,
      // `stretch` never reaches here: it needs the parent's constraints, so
      // `_buildChild` sizes the item itself.
      _ => Alignment.center,
    };
  }

  Widget _scroll(BuildContext context) {
    final horizontal = node.props['horizontal'] == true;
    final grid = node.props['grid'] == true;
    final gap = node.style.gap;
    final padding = node.style.padding;
    final children = <Widget>[
      for (final child in node.children)
        _QappNodeView(
          node: child,
          onEvent: onEvent,
          loadAsset: loadAsset,
          insideFlex: false,
        ),
    ];
    Widget content;
    if (grid) {
      final columns = node.props['numColumns'];
      final count = columns is num ? columns.round().clamp(1, 12) : 2;
      content = GridView.count(
        crossAxisCount: count,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        padding: EdgeInsets.zero,
        mainAxisSpacing: gap,
        crossAxisSpacing: gap,
        childAspectRatio: node.style.aspectRatio ?? 1,
        children: children,
      );
    } else {
      content = horizontal
          ? Flex(
              direction: Axis.horizontal,
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: gap,
              children: children,
            )
          // A vertical scroller nested in a `Row` has no width to stretch to,
          // so the column has to keep its children at their natural size.
          : _stretchColumn(children, spacing: gap);
    }
    // Platform physics, plus `_QappScrollPhysics` so a list that is being
    // dragged never gets corrected under the finger.
    final scroller = SingleChildScrollView(
      scrollDirection: horizontal ? Axis.horizontal : Axis.vertical,
      padding: padding,
      physics: const _QappScrollPhysics(),
      child: content,
    );
    final showsIndicator = node.props['showsScrollIndicator'] != false;
    return _QappScrollEvents(
      nodeId: node.id,
      horizontal: horizontal,
      enabled: node.hasEvent('scroll'),
      onEvent: onEvent,
      child: LayoutBuilder(
        builder: (context, constraints) {
          // A scroller nested in a scroller (or in a Column) with the same
          // direction gets an unbounded main axis, and a Flutter viewport
          // refuses that. Let the outer scroll own the scrolling and render the
          // content directly instead of throwing.
          final unbounded = horizontal
              ? !constraints.hasBoundedWidth
              : !constraints.hasBoundedHeight;
          if (unbounded) {
            return padding == EdgeInsets.zero
                ? content
                : Padding(padding: padding, child: content);
          }
          return ScrollConfiguration(
            behavior: ScrollConfiguration.of(
              context,
            ).copyWith(scrollbars: showsIndicator),
            child: scroller,
          );
        },
      ),
    );
  }

  /// `ListView`/`GridView` keep their own node type so the whole list is not
  /// built at once: the frame carries a window of items, Flutter lays those
  /// rows out lazily, and `_QappEndReached` asks the app for the next window
  /// when the user reaches the end.
  Widget _lazyList(BuildContext context) {
    final horizontal = node.props['horizontal'] == true;
    final showsIndicator = node.props['showsScrollIndicator'] != false;
    final children = _childWidgets(context);
    final padding = node.style.padding;
    return LayoutBuilder(
      builder: (context, constraints) {
        // A list inside a same-direction scroller or a Column has no bounded
        // main axis. A Flutter viewport cannot size itself there, so shrink the
        // window to its content and let the outer scroll own the scrolling.
        final unbounded = horizontal
            ? !constraints.hasBoundedWidth
            : !constraints.hasBoundedHeight;
        // Same rule as `_scroll`: platform physics, kept under the finger while
        // it is dragging, so iOS still bounces at the edges but only settles
        // back after the release.
        final physics = showsIndicator && !unbounded
            ? const _QappScrollPhysics()
            : const NeverScrollableScrollPhysics();
        final Widget list;
        if (node.type == 'GridView') {
          final columns = node.props['numColumns'];
          final count = columns is num ? columns.round().clamp(1, 12) : 2;
          list = GridView.count(
            crossAxisCount: count,
            shrinkWrap: unbounded,
            padding: padding,
            mainAxisSpacing: node.style.gap,
            crossAxisSpacing: node.style.gap,
            childAspectRatio: node.style.aspectRatio ?? 1,
            physics: physics,
            children: children,
          );
        } else {
          list = ListView(
            scrollDirection: horizontal ? Axis.horizontal : Axis.vertical,
            shrinkWrap: unbounded,
            padding: padding,
            physics: physics,
            children: children,
          );
        }
        // A windowed list only holds part of the data, so the host tells the
        // app when the user reaches the end and the next window is sent. A list
        // nested in another scroller cannot scroll on its own, so there is
        // nothing to report there.
        return _QappEndReached(
          nodeId: node.id,
          itemCount: node.children.length,
          enabled: !unbounded && node.hasEvent('endReached'),
          onEvent: onEvent,
          child: list,
        );
      },
    );
  }

  List<Widget> _childWidgets(BuildContext context) => [
    for (final child in node.children)
      _QappNodeView(
        node: child,
        onEvent: onEvent,
        loadAsset: loadAsset,
        insideFlex: false,
      ),
  ];

  Widget _overlay(
    BuildContext context,
    Widget content, {
    String animation = 'none',
  }) {
    return _QappOverlayTransition(
      animation: animation,
      child: Stack(
        children: [
          Positioned.fill(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: node.hasEvent('close')
                  ? () => onEvent(node.id, 'close', {'type': 'close'})
                  : null,
              child: ColoredBox(
                color: QChatColors.black.withValues(alpha: .45),
              ),
            ),
          ),
          content,
        ],
      ),
    );
  }

  Widget _modal(BuildContext context) {
    if (node.props['visible'] != true) return const SizedBox.shrink();
    final animation = node.props['animationType']?.toString() ?? 'none';
    if (node.props['transparent'] == true) {
      return _QappOverlayTransition(
        animation: animation,
        child: Stack(
          children: [
            Positioned.fill(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: node.hasEvent('close')
                    ? () => onEvent(node.id, 'close', {'type': 'close'})
                    : null,
                child: const ColoredBox(color: QChatColors.transparent),
              ),
            ),
            Center(child: _sheetColumn(context)),
          ],
        ),
      );
    }
    return _overlay(
      context,
      Center(child: _sheetColumn(context)),
      animation: animation,
    );
  }

  Widget _bottomSheet(BuildContext context) {
    if (node.props['visible'] != true) return const SizedBox.shrink();
    final height = _number(node.props['height']);
    return _overlay(
      context,
      Align(
        alignment: Alignment.bottomCenter,
        child: Container(
          width: double.infinity,
          height: height,
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
          decoration: BoxDecoration(
            color: surface(context),
            borderRadius: const BorderRadius.vertical(
              top: Radius.circular(18),
            ),
          ),
          child: SingleChildScrollView(child: _sheetColumn(context)),
        ),
      ),
    );
  }

  Widget _dialog(BuildContext context) {
    if (node.props['visible'] != true) return const SizedBox.shrink();
    final title = node.props['title']?.toString() ?? '';
    final confirmText = node.props['confirmText']?.toString() ?? '';
    final cancelText = node.props['cancelText']?.toString() ?? '';
    final hasActions = confirmText.isNotEmpty || cancelText.isNotEmpty;
    return _overlay(
      context,
      Center(
        child: Container(
          constraints: const BoxConstraints(maxWidth: 320),
          margin: const EdgeInsets.symmetric(horizontal: 24),
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: surface(context),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (title.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ..._childWidgets(context),
              if (hasActions)
                Padding(
                  padding: const EdgeInsets.only(top: 14),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      if (cancelText.isNotEmpty)
                        _textAction(
                          context,
                          cancelText,
                          node.hasEvent('close')
                              ? () => onEvent(
                                  node.id,
                                  'close',
                                  {'type': 'close'},
                                )
                              : null,
                        ),
                      if (confirmText.isNotEmpty)
                        _textAction(
                          context,
                          confirmText,
                          node.hasEvent('confirm')
                              ? () => onEvent(
                                  node.id,
                                  'confirm',
                                  {'type': 'confirm'},
                                )
                              : null,
                        ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _sheetColumn(BuildContext context) {
    return _stretchColumn(_childWidgets(context));
  }

  /// The header a Mini App owns, built from the QChat header standard so it
  /// lines up with the capsule the host floats on the right.
  ///
  /// `children` are the header's lower rows (a search field, tabs, a banner…)
  /// and sit under the title bar inside the same surface. `transparent` lets
  /// the page artwork run under the header.
  Widget _navBar(BuildContext context) {
    final title = node.props['title']?.toString() ?? '';
    final subtitle = node.props['subtitle']?.toString() ?? '';
    final showBack = node.props['showBack'] == true;
    final safeArea = node.props['safeArea'] != false;
    final transparent = node.props['transparent'] == true;
    final blur = node.props['blur'] == true;
    // A solid surface needs a hairline, otherwise it blends into the first
    // card of a white page and the content looks cut off mid-sentence.
    final border = node.props['border'] != false;
    final reserveRight =
        (_number(node.props['reserveRight']) ?? kQChatCapsuleWidth + 14).clamp(
          0.0,
          240.0,
        );
    final children = _childWidgets(context);
    final back = showBack && node.hasEvent('back')
        ? GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => onEvent(node.id, 'back', {'type': 'back'}),
            child: const SizedBox(
              width: 44,
              height: kQChatHeaderHeight,
              child: Center(child: QChatIcon('arrowLeft', size: 22)),
            ),
          )
        : null;
    return QChatHeader(
      title: title.isEmpty ? null : title,
      subtitle: subtitle.isEmpty ? null : subtitle,
      titleStyle: node.style
          .toTextStyle(fallbackColor: ink(context), fallbackSize: 17)
          .copyWith(fontWeight: FontWeight.w600),
      background: node.style.backgroundColor,
      transparent: transparent,
      blur: blur,
      border: border && !transparent,
      safeArea: safeArea,
      reserveLeading: 56,
      reserveTrailing: reserveRight,
      leading: back,
      bottom: children.isEmpty
          ? null
          : Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: children,
            ),
    );
  }

  Widget _tabBar(BuildContext context) {
    final rawTabs = node.props['tabs'];
    final tabs = rawTabs is List
        ? rawTabs.whereType<Map>().toList(growable: false)
        : const <Map>[];
    final activeKey = node.props['activeKey']?.toString();
    final rawActive = node.props['activeIndex'];
    var activeIndex = rawActive is num ? rawActive.round() : -1;
    if (activeKey != null) {
      final found = tabs.indexWhere(
        (tab) => tab['key']?.toString() == activeKey,
      );
      if (found >= 0) activeIndex = found;
    }
    if (activeIndex < 0) activeIndex = 0;
    final safeArea = node.props['safeArea'] != false;
    final bottomInset = safeArea ? MediaQuery.of(context).padding.bottom : 0.0;
    Widget bar() => _tabBarSurface(context, tabs, activeIndex, bottomInset);
    // The host shrinks the whole mini program when a field takes focus, so a tab
    // bar that stayed mounted would be lifted off the bottom edge and float right
    // above the keys. It steps aside instead, like a native tab bar, and the page
    // gets the space to scroll its focused field into view.
    if (node.props['hideOnKeyboard'] == false) return bar();
    return _QappKeyboardFooter(builder: (_) => bar());
  }

  Widget _tabBarSurface(
    BuildContext context,
    List<Map> tabs,
    int activeIndex,
    double bottomInset,
  ) {
    return Container(
      color: node.style.backgroundColor ?? surface(context),
      padding: EdgeInsets.only(bottom: bottomInset),
      child: SizedBox(
        height: 56,
        child: Row(
          children: [
            for (var index = 0; index < tabs.length; index++)
              Expanded(
                child: _tabButton(
                  context,
                  tabs[index],
                  index,
                  index == activeIndex,
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _tabButton(
    BuildContext context,
    Map tab,
    int index,
    bool active,
  ) {
    final key = tab['key']?.toString() ?? '';
    final label = tab['label']?.toString() ?? '';
    final icon = tab['icon']?.toString();
    final badge = tab['badge']?.toString();
    final color = active ? QChatColors.green : QChatColors.muted;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: node.hasEvent('change')
          ? () => onEvent(node.id, 'change', {
              'type': 'change',
              'index': index,
              'key': key,
              'value': {'index': index, 'key': key, 'value': key},
            })
          : null,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (icon != null && icon.isNotEmpty)
            Stack(
              children: [
                QChatIcon(icon, size: 22, color: color),
                if (badge != null && badge.isNotEmpty)
                  Positioned(
                    right: 0,
                    top: 0,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xffe5484d),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        badge,
                        style: const TextStyle(
                          fontSize: 9,
                          color: QChatColors.white,
                        ),
                      ),
                    ),
                  ),
              ],
            )
          else
            const SizedBox.square(dimension: 22),
          const SizedBox(height: 2),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 11,
              fontWeight: active ? FontWeight.w600 : FontWeight.w400,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _stack(BuildContext context) {
    final children = <Widget>[];
    // Stack paints in list order; `zIndex` reorders while keeping equal
    // indices stable.
    final ordered = node.children.asMap().entries.toList()
      ..sort((a, b) {
        final byZ = a.value.style.zIndex.compareTo(b.value.style.zIndex);
        return byZ != 0 ? byZ : a.key.compareTo(b.key);
      });
    for (final entry in ordered) {
      final child = entry.value;
      // Overlays paint a barrier over the whole stack; a Stack only sizes a
      // child to its own content, so they must fill the stack explicitly or
      // the barrier would cover just the sheet.
      final isOverlay =
          child.type == 'Modal' ||
          child.type == 'BottomSheet' ||
          child.type == 'Dialog';
      if (isOverlay) {
        children.add(
          Positioned.fill(
            child: _QappNodeView(
              node: child,
              onEvent: onEvent,
              loadAsset: loadAsset,
              insideFlex: false,
            ),
          ),
        );
      } else if (child.type == 'Positioned' || child.style.isAbsolute) {
        final style = child.style;
        final content = _QappNodeView(
          node: child,
          onEvent: onEvent,
          loadAsset: loadAsset,
          insideFlex: false,
          placedInStack: true,
        );
        children.add(
          Positioned(
            top: style.top,
            right: style.right,
            bottom: style.bottom,
            left: style.left,
            child: content,
          ),
        );
      } else {
        children.add(
          _QappNodeView(
            node: child,
            onEvent: onEvent,
            loadAsset: loadAsset,
            insideFlex: false,
          ),
        );
      }
    }
    return Stack(
      alignment: _stackAlignment(node.props['alignment']),
      children: children,
    );
  }

  Widget _positionedContent(BuildContext context) {
    final children = <Widget>[
      for (final child in node.children)
        _QappNodeView(
          node: child,
          onEvent: onEvent,
          loadAsset: loadAsset,
          insideFlex: false,
        ),
    ];
    if (children.length == 1) return children.first;
    return Stack(children: children);
  }

  Widget _button(BuildContext context) {
    final disabled = node.props['disabled'] == true;
    final loading = node.props['loading'] == true;
    final variant = node.props['variant']?.toString() ?? 'primary';
    final label = qappTextContent(node);
    final radius = BorderRadius.circular(
      node.style.borderRadius == BorderRadius.zero
          ? 8
          : node.style.borderRadius.topLeft.x,
    );
    final (minHeight, horizontal, vertical, fontSize, iconSize) =
        switch (node.props['size']) {
          'sm' => (32.0, 12.0, 5.0, 13.0, 14.0),
          'lg' => (48.0, 22.0, 12.0, 16.0, 20.0),
          _ => (40.0, 16.0, 9.0, 15.0, 17.0),
        };
    final (background, foreground, borderColor) = switch (variant) {
      'secondary' => (qchatFill(context), ink(context), null),
      'outline' => (QChatColors.transparent, QChatColors.green, QChatColors.green),
      'text' => (QChatColors.transparent, QChatColors.green, null),
      'danger' => (const Color(0xffe5484d), QChatColors.white, null),
      _ => (QChatColors.green, QChatColors.white, null),
    };
    final buttonStyle = styleToTextStyle(
      context,
      fallbackColor: foreground,
      fallbackSize: fontSize,
    );
    final content = loading
        ? QChatLoading(size: iconSize, color: foreground)
        : Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            spacing: 6,
            children: [
              if (node.props['icon'] is String)
                QChatIcon(
                  node.props['icon'] as String,
                  size: iconSize,
                  color: foreground,
                ),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: buttonStyle,
                ),
              ),
            ],
          );
    final border = node.style.borderWidth > 0
        ? Border.all(
            color: node.style.borderColor ?? background,
            width: node.style.borderWidth,
          )
        : borderColor == null
        ? null
        : Border.all(color: borderColor);
    final button = AnimatedOpacity(
      duration: const Duration(milliseconds: 120),
      opacity: disabled ? .45 : 1,
      child: Container(
        constraints: BoxConstraints(minHeight: minHeight, minWidth: 64),
        padding: node.style.padding == EdgeInsets.zero
            ? EdgeInsets.symmetric(horizontal: horizontal, vertical: vertical)
            : node.style.padding,
        decoration: BoxDecoration(
          color: background,
          borderRadius: radius,
          border: border,
        ),
        alignment: Alignment.center,
        child: content,
      ),
    );
    if (disabled) return button;
    final accessibleLabel = node.props['accessibleLabel'];
    return Semantics(
      button: true,
      label: accessibleLabel is String && accessibleLabel.isNotEmpty
          ? accessibleLabel
          : label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => onEvent(node.id, 'press', null),
        onLongPress: node.hasEvent('longPress')
            ? () => onEvent(node.id, 'longPress', null)
            : null,
        child: button,
      ),
    );
  }

  Widget _pressable(BuildContext context) {
    return _Pressable(
      key: ValueKey(node.id),
      enabled: node.props['disabled'] != true,
      hasPress: node.hasEvent('press'),
      hasLongPress: node.hasEvent('longPress'),
      onPress: () => onEvent(node.id, 'press', null),
      onLongPress: () => onEvent(node.id, 'longPress', null),
      // A `Pressable` is a `View` with a tap handler, so it has to lay its
      // children out with the same flex rules. Forcing a column here turned
      // every horizontal row (a cell, a drink row, a size button) into a
      // vertical stack, and left `justifyContent`/`alignItems` unread, which
      // is why a `−`/`+` glyph sat in a corner instead of the middle.
      child: node.children.isEmpty
          ? const SizedBox.shrink()
          : _flex(context),
    );
  }

  Widget _image(BuildContext context) {
    final src = node.props['src']?.toString() ?? '';
    final width = _number(node.props['width']) ?? node.style.width;
    final height = _number(node.props['height']) ?? node.style.height;
    final radius = _number(node.props['borderRadius']) ?? 0;
    final fit = switch (node.props['fit']) {
      'contain' => BoxFit.contain,
      'fill' => BoxFit.fill,
      'fitWidth' => BoxFit.fitWidth,
      'fitHeight' => BoxFit.fitHeight,
      _ => BoxFit.cover,
    };
    var body = _imageBody(context, src, fit, width, height);
    if (radius > 0) {
      body = ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: body,
      );
    }
    if (node.hasEvent('press')) {
      return GestureDetector(
        onTap: () => onEvent(node.id, 'press', null),
        child: body,
      );
    }
    return body;
  }

  /// The one place that turns an image reference into a widget, so `Image` and
  /// `Avatar` follow the same asset policy: `data:` URLs, packaged `assets/`
  /// paths and HTTPS URLs only.
  Widget _imageBody(
    BuildContext context,
    String src,
    BoxFit fit,
    double? width,
    double? height, {
    Widget? placeholder,
  }) {
    final fallback = placeholder ?? _imageFallback(context, width, height);
    if (src.startsWith('data:')) {
      final bytes = _decodeDataUrl(src);
      if (bytes == null) return fallback;
      return Image.memory(
        bytes,
        fit: fit,
        width: width,
        height: height,
        gaplessPlayback: true,
        errorBuilder: (_, _, _) => fallback,
      );
    }
    if (src.startsWith('assets/')) {
      return _QappAssetImage(
        key: ValueKey('${node.id}:image'),
        loader: loadAsset,
        path: src,
        fit: fit,
        width: width,
        height: height,
        placeholder: placeholder,
      );
    }
    if (_isRemoteImageUri(src)) {
      return Image.network(
        src,
        fit: fit,
        width: width,
        height: height,
        errorBuilder: (_, _, _) => fallback,
      );
    }
    return fallback;
  }

  Widget _imageFallback(BuildContext context, double? width, double? height) =>
      Container(
        width: width,
        height: height ?? 48,
        color: qchatFill(context),
        alignment: Alignment.center,
        child: const QChatIcon('image', size: 20, color: QChatColors.muted),
      );

  Widget _icon() {
    final size = _number(node.props['size']) ?? node.style.fontSize ?? 22;
    final color = qappColor(node.props['color']) ?? node.style.color;
    return QChatIcon(
      node.props['name']?.toString() ?? 'miniApps',
      size: size,
      color: color ?? const Color(0xff191919),
    );
  }

  Widget _textField(BuildContext context) {
    return _QappTextField(key: ValueKey(node.id), node: node, onEvent: onEvent);
  }

  Widget _checkbox(BuildContext context) {
    return _QappCheckbox(key: ValueKey(node.id), node: node, onEvent: onEvent);
  }

  Widget _switch(BuildContext context) {
    return _QappSwitch(key: ValueKey(node.id), node: node, onEvent: onEvent);
  }

  Widget _slider(BuildContext context) {
    return _QappSlider(key: ValueKey(node.id), node: node, onEvent: onEvent);
  }

  Widget _spacer(BuildContext context) {
    // A negative or absurd `size` must not overflow the layout: the host clamps
    // it, and a zero-size spacer still expands when it sits in a flex.
    final size = (_number(node.props['size']) ?? 0).clamp(0.0, 400.0);
    if (size > 0) {
      return SizedBox(height: size, width: size);
    }
    if (insideFlex) return const Expanded(child: SizedBox.shrink());
    return const SizedBox(height: 8);
  }

  Widget _textAction(
    BuildContext context,
    String label,
    VoidCallback? onTap,
  ) => GestureDetector(
    behavior: HitTestBehavior.opaque,
    onTap: onTap,
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w500,
          color: onTap == null ? qchatMuted(context) : QChatColors.green,
        ),
      ),
    ),
  );

  Widget _divider(BuildContext context) {
    final color = qappColor(node.props['color']) ?? node.style.color;
    final thickness = (_number(node.props['thickness']) ?? 1).clamp(0.5, 24.0);
    final inset = (_number(node.props['inset']) ?? 0).clamp(0.0, 400.0);
    final lineColor = color ?? qchatLine(context);
    if (node.props['vertical'] == true) {
      return LayoutBuilder(
        builder: (context, constraints) {
          // A rule inside a `Row` has no bounded height; fall back to a short
          // one instead of handing `double.infinity` to a `SizedBox`.
          final height =
              node.style.height ??
              (constraints.hasBoundedHeight ? constraints.maxHeight : 24.0);
          return Padding(
            padding: EdgeInsets.only(top: inset),
            child: SizedBox(
              width: thickness,
              height: height,
              child: ColoredBox(color: lineColor),
            ),
          );
        },
      );
    }
    return Padding(
      padding: EdgeInsets.only(left: inset),
      child: Container(height: thickness, color: lineColor),
    );
  }

  Widget _activityIndicator() {
    final size = _number(node.props['size']) ?? 20;
    final color = qappColor(node.props['color']);
    return QChatLoading(size: size, color: color ?? QChatColors.green);
  }

  Widget _safeArea(BuildContext context) {
    final raw = node.props['edges'];
    final edges = raw is List
        ? raw.map((edge) => edge.toString()).toSet()
        : const {'top', 'right', 'bottom', 'left'};
    return SafeArea(
      top: edges.contains('top'),
      right: edges.contains('right'),
      bottom: edges.contains('bottom'),
      left: edges.contains('left'),
      child: _stretchColumn([
        for (final child in node.children)
          _QappNodeView(
            node: child,
            onEvent: onEvent,
            loadAsset: loadAsset,
            insideFlex: false,
          ),
      ]),
    );
  }

  Widget _animated(BuildContext context) {
    final duration = _number(node.props['duration']) ?? 220;
    final animate = node.props['animate']?.toString() ?? 'fadeIn';
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: duration.round().clamp(0, 2000)),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) {
        final content = child!;
        return switch (animate) {
          'slideUp' => Opacity(
            opacity: value,
            child: Transform.translate(
              offset: Offset(0, (1 - value) * 20),
              child: content,
            ),
          ),
          'scaleIn' => Opacity(
            opacity: value,
            child: Transform.scale(scale: .92 + value * .08, child: content),
          ),
          _ => Opacity(opacity: value, child: content),
        };
      },
      child: _stretchColumn([
        for (final child in node.children)
          _QappNodeView(
            node: child,
            onEvent: onEvent,
            loadAsset: loadAsset,
            insideFlex: false,
          ),
      ]),
    );
  }

  Widget _customPaint() {
    final width = _number(node.props['width']) ?? node.style.width ?? 100;
    final height = _number(node.props['height']) ?? node.style.height ?? 100;
    return SizedBox(
      width: width,
      height: height,
      child: CustomPaint(
        painter: QappPathPainter(node.props['draw']?.toString() ?? ''),
        size: Size(width, height),
      ),
    );
  }

  Widget _decorate(BuildContext context, Widget child) {
    final style = node.style;
    final border = style.boxBorder();
    final shadows = style.boxShadows;
    final hasRadius = style.borderRadius != BorderRadius.zero;
    final hasDecoration =
        style.backgroundColor != null ||
        style.gradient != null ||
        border != null ||
        shadows.isNotEmpty;
    var content = child;
    if (hasDecoration) {
      final padding = style.padding == EdgeInsets.zero ? null : style.padding;
      final color = style.gradient == null ? style.backgroundColor : null;
      final shadow = shadows.isEmpty ? null : shadows;
      if (hasRadius && border != null && !_borderFitsRadius(border)) {
        // Flutter can only paint a per-edge border together with a corner
        // radius while every visible edge shares one colour, and it refuses to
        // paint a zero-width edge as soon as a radius is present. Keep the
        // rounded shape with a clipped, straight border instead: the outer box
        // owns the radius, the background and the shadow, and the box inside
        // the clip paints the border.
        content = Container(
          decoration: BoxDecoration(
            color: color,
            gradient: style.gradient,
            borderRadius: style.borderRadius,
            boxShadow: shadow,
          ),
          child: ClipRRect(
            borderRadius: style.borderRadius,
            child: Container(
              padding: padding,
              decoration: BoxDecoration(border: border),
              child: content,
            ),
          ),
        );
      } else {
        content = Container(
          padding: padding,
          decoration: BoxDecoration(
            color: color,
            gradient: style.gradient,
            borderRadius: hasRadius ? style.borderRadius : null,
            border: border,
            boxShadow: shadow,
          ),
          child: content,
        );
      }
    } else if (style.padding != EdgeInsets.zero) {
      content = Padding(padding: style.padding, child: content);
    }
    if (style.clipsContent) {
      content = hasRadius
          ? ClipRRect(borderRadius: style.borderRadius, child: content)
          : ClipRect(child: content);
    }
    content = _constrain(context, content);
    if (style.margin != EdgeInsets.zero) {
      content = Padding(padding: style.margin, child: content);
    }
    return content;
  }

  /// Whether Flutter can draw this border with the style's corner radius: only
  /// edges that paint something count, and they must all share one colour.
  bool _borderFitsRadius(Border border) {
    final colors = <Color>{
      if (border.top.style != BorderStyle.none) border.top.color,
      if (border.right.style != BorderStyle.none) border.right.color,
      if (border.bottom.style != BorderStyle.none) border.bottom.color,
      if (border.left.style != BorderStyle.none) border.left.color,
    };
    return colors.length <= 1;
  }

  Widget _constrain(BuildContext context, Widget child) {
    final style = node.style;
    final hasMin = style.minWidth != null || style.minHeight != null;
    final hasMax = style.maxWidth != null || style.maxHeight != null;
    if (hasMin || hasMax) {
      child = ConstrainedBox(
        constraints: BoxConstraints(
          minWidth: style.minWidth ?? 0,
          minHeight: style.minHeight ?? 0,
          maxWidth: style.maxWidth ?? double.infinity,
          maxHeight: style.maxHeight ?? double.infinity,
        ),
        child: child,
      );
    }
    final widthFactor = style.widthFactor;
    final heightFactor = style.heightFactor;
    if (widthFactor == null && heightFactor == null) {
      if (style.width == null && style.height == null) return child;
      return SizedBox(width: style.width, height: style.height, child: child);
    }
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = widthFactor != null
            ? (constraints.hasBoundedWidth
                  ? constraints.maxWidth * widthFactor
                  : null)
            : style.width;
        final height = heightFactor != null
            ? (constraints.hasBoundedHeight
                  ? constraints.maxHeight * heightFactor
                  : null)
            : style.height;
        if (width == null && height == null) return child;
        return SizedBox(width: width, height: height, child: child);
      },
    );
  }

  TextStyle styleToTextStyle(
    BuildContext context, {
    required Color fallbackColor,
    required double fallbackSize,
  }) => node.style.toTextStyle(
    fallbackColor: fallbackColor,
    fallbackSize: fallbackSize,
  );

  /// A flex box hugs its content unless it is told to grow, like React Native.
  ///
  /// Flutter's `Row` and `Column` default to `MainAxisSize.max`, which fills a
  /// loose parent. A `View` without `flex` inside a centred `Stack` therefore
  /// covered the whole stack and its children stuck to the top instead of
  /// sitting in the middle — that is what put the "82%" label of a ring gauge
  /// in its upper-left corner. A tight constraint (an `Expanded` from `flex: 1`,
  /// a fixed `height`) still fills, so growing nodes keep the old behaviour.
  MainAxisSize get _mainAxisSize {
    final grow = node.style.flex ?? 0;
    final flexGrow = node.style.flexGrow ?? 0;
    return grow > 0 || flexGrow > 0 ? MainAxisSize.max : MainAxisSize.min;
  }

  bool _isRow(QappNode value) =>
      value.style.flexDirection == 'row' ||
      value.style.flexDirection == 'row-reverse';
  bool _isReverse(QappNode value) =>
      value.style.flexDirection == 'row-reverse' ||
      value.style.flexDirection == 'column-reverse';

  MainAxisAlignment _mainAlignment(QappNode value) {
    return _justifyAlignment(value.style.justifyContent);
  }

  MainAxisAlignment _justifyAlignment(String? value) {
    return switch (value) {
      'end' => MainAxisAlignment.end,
      'center' => MainAxisAlignment.center,
      'spaceBetween' => MainAxisAlignment.spaceBetween,
      'spaceAround' => MainAxisAlignment.spaceAround,
      'spaceEvenly' => MainAxisAlignment.spaceEvenly,
      _ => MainAxisAlignment.start,
    };
  }

  CrossAxisAlignment _crossAlignment(QappNode value) {
    return switch (value.style.alignItems) {
      'start' => CrossAxisAlignment.start,
      'end' => CrossAxisAlignment.end,
      'center' => CrossAxisAlignment.center,
      'baseline' => CrossAxisAlignment.baseline,
      _ => CrossAxisAlignment.stretch,
    };
  }

  WrapAlignment _wrapAlignment(MainAxisAlignment value) {
    return switch (value) {
      MainAxisAlignment.end => WrapAlignment.end,
      MainAxisAlignment.center => WrapAlignment.center,
      MainAxisAlignment.spaceBetween => WrapAlignment.spaceBetween,
      MainAxisAlignment.spaceAround => WrapAlignment.spaceAround,
      MainAxisAlignment.spaceEvenly => WrapAlignment.spaceEvenly,
      _ => WrapAlignment.start,
    };
  }

  WrapCrossAlignment _wrapCross(CrossAxisAlignment value) {
    return switch (value) {
      CrossAxisAlignment.start => WrapCrossAlignment.start,
      CrossAxisAlignment.end => WrapCrossAlignment.end,
      CrossAxisAlignment.center => WrapCrossAlignment.center,
      _ => WrapCrossAlignment.center,
    };
  }

  Alignment _stackAlignment(Object? value) => switch (value) {
    'topLeft' => Alignment.topLeft,
    'topCenter' => Alignment.topCenter,
    'topRight' => Alignment.topRight,
    'center' => Alignment.center,
    'centerLeft' => Alignment.centerLeft,
    'centerRight' => Alignment.centerRight,
    'bottomLeft' => Alignment.bottomLeft,
    'bottomCenter' => Alignment.bottomCenter,
    'bottomRight' => Alignment.bottomRight,
    // React Native stacks align non-positioned children at the top left.
    _ => Alignment.topLeft,
  };

  /// Accent colour for a `Tag` or `Badge` tone. Neutral resolves through the
  /// theme so it stays readable in dark mode.
  Color _toneColor(BuildContext context, String? tone) => switch (tone) {
    'success' => QChatColors.green,
    'warning' => const Color(0xfff5a524),
    'danger' => const Color(0xffe5484d),
    'info' => const Color(0xff3b82f6),
    _ => qchatMuted(context),
  };

  /// Remote images are allowed from any HTTPS host: a mini program does not
  /// declare a host allowlist, the `network` permission covers them all.
  bool _isRemoteImageUri(String value) {
    final uri = Uri.tryParse(value);
    return uri != null && uri.scheme == 'https' && uri.host.isNotEmpty;
  }

  static double? _number(Object? value) {
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value);
    return null;
  }

  static Uint8List? _decodeDataUrl(String value) {
    final comma = value.indexOf(',');
    if (comma < 0 || !value.substring(0, comma).contains(';base64')) {
      return null;
    }
    try {
      return base64Decode(value.substring(comma + 1));
    } catch (_) {
      return null;
    }
  }

  static String _transform(String value, String mode) => switch (mode) {
    'uppercase' => value.toUpperCase(),
    'lowercase' => value.toLowerCase(),
    'capitalize' =>
      value.isEmpty ? value : '${value[0].toUpperCase()}${value.substring(1)}',
    _ => value,
  };
}

/// One paragraph built from inline `Text`, `Link` and `#text` children.
///
/// A `TextSpan` recogniser must be disposed with the widget, so the spans are
/// rebuilt by a `State` that owns them instead of a `StatelessWidget`.
class _QappRichText extends StatefulWidget {
  const _QappRichText({
    super.key,
    required this.node,
    required this.onEvent,
    required this.baseStyle,
    required this.maxLines,
    required this.textAlign,
    required this.selectable,
  });

  final QappNode node;
  final QappEventHandler onEvent;
  final TextStyle baseStyle;
  final int? maxLines;
  final TextAlign? textAlign;
  final bool selectable;

  @override
  State<_QappRichText> createState() => _QappRichTextState();
}

class _QappRichTextState extends State<_QappRichText> {
  final List<TapGestureRecognizer> _recognizers = [];

  @override
  void dispose() {
    _disposeRecognizers();
    super.dispose();
  }

  void _disposeRecognizers() {
    for (final recognizer in _recognizers) {
      recognizer.dispose();
    }
    _recognizers.clear();
  }

  TapGestureRecognizer _recognizerFor(QappNode link) {
    final recognizer = TapGestureRecognizer()
      ..onTap = () => widget.onEvent(
        link.id,
        'press',
        _QappNodeView._linkPayload(link),
      );
    _recognizers.add(recognizer);
    return recognizer;
  }

  /// Flattens the inline nodes into spans. A `Link` passes its recogniser down
  /// to its own text, so a link made of several spans stays one tappable run.
  void _walk(
    QappNode current,
    TextStyle inherited,
    List<InlineSpan> spans, {
    GestureRecognizer? recognizer,
  }) {
    if (current.type == '#text') {
      if (current.text.isEmpty) return;
      spans.add(
        TextSpan(
          text: current.text,
          style: inherited,
          recognizer: recognizer,
        ),
      );
      return;
    }
    final style = inherited.merge(current.style.toTextStyle());
    final isLink = current.type == 'Link';
    // A link keeps the paragraph's metrics but is green and underlined unless
    // the node asked for something else.
    final effective = isLink
        ? style.copyWith(
            color: current.style.color ?? QChatColors.green,
            decoration:
                current.style.textDecoration ?? TextDecoration.underline,
          )
        : style;
    final active = isLink ? _recognizerFor(current) : recognizer;
    if (current.children.isEmpty) {
      final text = current.text;
      if (text.isNotEmpty) {
        spans.add(TextSpan(text: text, style: effective, recognizer: active));
      }
      return;
    }
    for (final child in current.children) {
      _walk(child, effective, spans, recognizer: active);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Every build replaces the spans, so the recognisers from the previous
    // build are released first instead of leaking one per frame.
    _disposeRecognizers();
    final spans = <InlineSpan>[];
    for (final child in widget.node.children) {
      _walk(child, widget.baseStyle, spans);
    }
    final paragraph = Text.rich(
      TextSpan(style: widget.baseStyle, children: spans),
      maxLines: widget.maxLines,
      overflow: widget.maxLines == null
          ? TextOverflow.clip
          : TextOverflow.ellipsis,
      textAlign: widget.textAlign,
    );
    return widget.selectable ? _selectable(context, paragraph) : paragraph;
  }
}

/// Wraps a paragraph in a selectable region with the QChat copy bubble.
///
/// `SelectionArea` is a Material widget, so the runtime uses the underlying
/// `SelectableRegion` with Cupertino handles and a toolbar drawn from the
/// design system instead.
Widget _selectable(BuildContext context, Widget child) {
  return _QappSelectable(child: child);
}

class _QappSelectable extends StatefulWidget {
  const _QappSelectable({required this.child});

  final Widget child;

  @override
  State<_QappSelectable> createState() => _QappSelectableState();
}

class _QappSelectableState extends State<_QappSelectable> {
  /// `SelectableRegionState` exposes the selection only through its callback,
  /// so the toolbar reads the text captured here.
  String _selectedText = '';

  @override
  Widget build(BuildContext context) {
    return SelectableRegion(
      selectionControls: cupertinoTextSelectionControls,
      onSelectionChanged: (content) =>
          _selectedText = content?.plainText ?? '',
      contextMenuBuilder: (context, state) =>
          _QappCopyToolbar(state: state, text: _selectedText),
      child: widget.child,
    );
  }
}

class _QappCopyToolbar extends StatelessWidget {
  const _QappCopyToolbar({required this.state, required this.text});

  final SelectableRegionState state;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: qchatInk(context),
        borderRadius: BorderRadius.circular(8),
      ),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () {
          if (text.isNotEmpty) {
            Clipboard.setData(ClipboardData(text: text));
          }
          state.hideToolbar();
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Text(
            tr(context, 'copy'),
            style: TextStyle(
              color: qchatSurface(context),
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }
}

/// Keeps a footer (the `TabBar`) out of the keyboard's way while it is open and
/// brings it back the moment the keyboard starts to close.
///
/// `MediaQuery.viewInsetsOf` keeps reporting the keyboard while it animates out
/// and only drops to zero once it is fully gone, so testing `inset > 0` made the
/// bar pop in a beat after the keys had left the screen. Comparing against the
/// previous inset tells us which way the keyboard is moving, so the bar reappears
/// on the first frame the inset shrinks and rides down with the keys. The short
/// fade keeps that reveal from popping.
class _QappKeyboardFooter extends StatefulWidget {
  const _QappKeyboardFooter({required this.builder});

  final WidgetBuilder builder;

  @override
  State<_QappKeyboardFooter> createState() => _QappKeyboardFooterState();
}

class _QappKeyboardFooterState extends State<_QappKeyboardFooter> {
  double? _lastInset;
  bool _steppedAside = false;

  @override
  Widget build(BuildContext context) {
    final inset = MediaQuery.viewInsetsOf(context).bottom;
    final previous = _lastInset;
    _lastInset = inset;
    // Opening, or already open: stay out of the way. A closing keyboard counts as
    // closing on every frame, because the inset keeps shrinking until it is 0.
    final closing = previous != null && inset < previous;
    if (inset > 0 && !closing) {
      _steppedAside = true;
      return const SizedBox.shrink();
    }
    final bar = widget.builder(context);
    // A page that simply opens has nothing to fade: only the bar that comes back
    // from under the keyboard eases in.
    if (!_steppedAside) return bar;
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0, end: 1),
      duration: const Duration(milliseconds: 160),
      curve: Curves.easeOut,
      builder: (context, value, child) =>
          Opacity(opacity: value, child: child),
      child: bar,
    );
  }
}

/// Fades or slides an overlay in the first time it mounts.
///
/// The contract declares `Modal.animationType` (`none`, `fade`, `slide`) but the
/// renderer used to ignore it, so an overlay appeared instantly whatever the
/// app asked for. The animation only runs on mount, so a later rebuild of the
/// same overlay (a keystroke, a scroll) does not replay it.
class _QappOverlayTransition extends StatefulWidget {
  const _QappOverlayTransition({required this.animation, required this.child});

  final String animation;
  final Widget child;

  @override
  State<_QappOverlayTransition> createState() => _QappOverlayTransitionState();
}

class _QappOverlayTransitionState extends State<_QappOverlayTransition> {
  static const _duration = Duration(milliseconds: 180);

  late bool _shown = widget.animation == 'none';

  @override
  void initState() {
    super.initState();
    if (_shown) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() => _shown = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (widget.animation == 'none') return widget.child;
    Widget child = AnimatedOpacity(
      opacity: _shown ? 1 : 0,
      duration: _duration,
      child: widget.child,
    );
    if (widget.animation == 'slide') {
      child = AnimatedSlide(
        offset: _shown ? Offset.zero : const Offset(0, .06),
        duration: _duration,
        curve: Curves.easeOut,
        child: child,
      );
    }
    return child;
  }
}

class _Pressable extends StatefulWidget {
  const _Pressable({
    super.key,
    required this.enabled,
    required this.hasPress,
    required this.hasLongPress,
    required this.onPress,
    required this.onLongPress,
    required this.child,
  });

  final bool enabled;
  final bool hasPress;
  final bool hasLongPress;
  final VoidCallback onPress;
  final VoidCallback onLongPress;
  final Widget child;

  @override
  State<_Pressable> createState() => _PressableState();
}

class _PressableState extends State<_Pressable> {
  bool _pressed = false;

  void _setPressed(bool value) {
    if (widget.enabled && _pressed != value) setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    final child = AnimatedOpacity(
      duration: const Duration(milliseconds: 90),
      opacity: _pressed ? .6 : 1,
      child: widget.child,
    );
    if (!widget.enabled) return child;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => _setPressed(true),
      onTapUp: (_) => _setPressed(false),
      onTapCancel: () => _setPressed(false),
      onTap: widget.hasPress ? widget.onPress : null,
      onLongPress: widget.hasLongPress ? widget.onLongPress : null,
      child: child,
    );
  }
}

class _QappAssetImage extends StatefulWidget {
  const _QappAssetImage({
    super.key,
    required this.loader,
    required this.path,
    required this.fit,
    required this.width,
    required this.height,
    this.placeholder,
  });

  final QappAssetLoader loader;
  final String path;
  final BoxFit fit;
  final double? width;
  final double? height;

  /// Shown while the asset is loading. `Avatar` passes its initials so the
  /// image fades in over a stable surface instead of a spinner.
  final Widget? placeholder;

  @override
  State<_QappAssetImage> createState() => _QappAssetImageState();
}

class _QappAssetImageState extends State<_QappAssetImage> {
  late final Future<Uint8List?> _future = widget.loader(widget.path);

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Uint8List?>(
      future: _future,
      builder: (context, snapshot) {
        final bytes = snapshot.data;
        if (bytes == null || bytes.isEmpty) {
          final placeholder = widget.placeholder;
          if (placeholder != null) return placeholder;
          return SizedBox(
            width: widget.width,
            height: widget.height ?? 48,
            child: const Center(
              child: QChatLoading(size: 14),
            ),
          );
        }
        return Image.memory(
          bytes,
          fit: widget.fit,
          width: widget.width,
          height: widget.height,
          gaplessPlayback: true,
          errorBuilder: (_, _, _) =>
              widget.placeholder ??
              SizedBox(
                width: widget.width,
                height: widget.height ?? 48,
                child: const QChatIcon(
                  'image',
                  size: 20,
                  color: QChatColors.muted,
                ),
              ),
        );
      },
    );
  }
}

class _QappTextField extends StatefulWidget {
  const _QappTextField({super.key, required this.node, required this.onEvent});

  final QappNode node;
  final QappEventHandler onEvent;

  @override
  State<_QappTextField> createState() => _QappTextFieldState();
}

class _QappTextFieldState extends State<_QappTextField> {
  late final TextEditingController _controller = TextEditingController(
    text: widget.node.props['value']?.toString() ?? '',
  );
  late final FocusNode _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _focus.addListener(_reportFocus);
    if (widget.node.props['autoFocus'] == true) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _focus.requestFocus();
      });
    }
  }

  /// The contract declares `focus`/`blur`, so a form can react to the field
  /// being entered or left. They were never emitted before, which made
  /// `onFocus`/`onBlur` a silent no-op.
  void _reportFocus() {
    final node = widget.node;
    final event = _focus.hasFocus ? 'focus' : 'blur';
    if (node.hasEvent(event)) {
      widget.onEvent(node.id, event, {'type': event});
    }
  }

  @override
  void didUpdateWidget(_QappTextField oldWidget) {
    super.didUpdateWidget(oldWidget);
    final value = widget.node.props['value']?.toString() ?? '';
    if (value != _controller.text && _focus.hasFocus == false) {
      _controller.text = value;
    }
  }

  @override
  void dispose() {
    _focus.removeListener(_reportFocus);
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final node = widget.node;
    final style = node.style;
    final editable = node.props['editable'] != false;
    final maxLength = node.props['maxLength'];
    final limit = maxLength is num ? maxLength.round() : null;
    final multiline = node.props['multiline'] == true;
    final keyboard = switch (node.props['keyboardType']) {
      'number' => TextInputType.number,
      'email' => TextInputType.emailAddress,
      'phone' => TextInputType.phone,
      'url' => TextInputType.url,
      _ => TextInputType.text,
    };
    final radius = style.borderRadius == BorderRadius.zero
        ? BorderRadius.circular(8)
        : style.borderRadius;
    return Container(
      decoration: BoxDecoration(
        color: style.backgroundColor ?? QChatColors.transparent,
        borderRadius: radius,
        border: Border.all(
          color: style.borderColor ?? const Color(0xffdcdcdc),
          width: style.borderWidth > 0 ? style.borderWidth : 1,
        ),
      ),
      child: CupertinoTextField(
        controller: _controller,
        focusNode: _focus,
        enabled: editable,
        obscureText: node.props['secureTextEntry'] == true,
        maxLines: multiline ? null : 1,
        minLines: multiline ? 3 : 1,
        maxLength: limit,
        keyboardType: multiline ? TextInputType.multiline : keyboard,
        style: style.toTextStyle(
          fallbackColor: ink(context),
          fallbackSize: 15,
        ),
        textAlign: style.textAlign ?? TextAlign.start,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
        placeholder: node.props['placeholder']?.toString() ?? '',
        placeholderStyle: const TextStyle(
          color: QChatColors.muted,
          fontSize: 15,
        ),
        decoration: null,
        onChanged: (value) {
          if (node.hasEvent('input')) {
            widget.onEvent(node.id, 'input', value);
          }
          if (node.hasEvent('change')) {
            widget.onEvent(node.id, 'change', {
              'type': 'change',
              'value': value,
              'text': value,
            });
          }
        },
        onSubmitted: (value) {
          if (node.hasEvent('submit')) {
            widget.onEvent(node.id, 'submit', {
              'type': 'submit',
              'value': value,
              'text': value,
            });
          }
        },
      ),
    );
  }
}

class _QappCheckbox extends StatefulWidget {
  const _QappCheckbox({super.key, required this.node, required this.onEvent});

  final QappNode node;
  final QappEventHandler onEvent;

  @override
  State<_QappCheckbox> createState() => _QappCheckboxState();
}

class _QappCheckboxState extends State<_QappCheckbox> {
  late bool _checked = widget.node.props['checked'] == true;
  late bool _prop = _checked;

  @override
  void didUpdateWidget(_QappCheckbox oldWidget) {
    super.didUpdateWidget(oldWidget);
    final prop = widget.node.props['checked'] == true;
    if (prop != _prop) {
      _prop = prop;
      _checked = prop;
    }
  }

  @override
  Widget build(BuildContext context) {
    final node = widget.node;
    final label = node.props['label']?.toString() ?? '';
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: node.props['disabled'] == true
          ? null
          : () {
              final next = !_checked;
              setState(() => _checked = next);
              widget.onEvent(node.id, 'change', {
                'type': 'change',
                'value': next,
              });
            },
      child: Row(
        mainAxisSize: MainAxisSize.min,
        spacing: 8,
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 120),
            width: 20,
            height: 20,
            decoration: BoxDecoration(
              color: _checked ? QChatColors.green : QChatColors.transparent,
              borderRadius: BorderRadius.circular(5),
              border: Border.all(
                color: _checked ? QChatColors.green : const Color(0xffb8b8b8),
                width: 1.5,
              ),
            ),
            child: _checked
                ? const QChatIcon(
                    'check',
                    size: 13,
                    color: QChatColors.white,
                  )
                : null,
          ),
          if (label.isNotEmpty)
            Flexible(
              child: Text(
                label,
                style: node.style.toTextStyle(
                  fallbackColor: ink(context),
                  fallbackSize: 15,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _QappSwitch extends StatefulWidget {
  const _QappSwitch({super.key, required this.node, required this.onEvent});

  final QappNode node;
  final QappEventHandler onEvent;

  @override
  State<_QappSwitch> createState() => _QappSwitchState();
}

class _QappSwitchState extends State<_QappSwitch> {
  late bool _value = widget.node.props['value'] == true;
  late bool _prop = _value;

  @override
  void didUpdateWidget(_QappSwitch oldWidget) {
    super.didUpdateWidget(oldWidget);
    final prop = widget.node.props['value'] == true;
    // Only a changed prop wins over the local state; a re-render that repeats
    // the old value must not undo what the user just tapped.
    if (prop != _prop) {
      _prop = prop;
      _value = prop;
    }
  }

  @override
  Widget build(BuildContext context) {
    final node = widget.node;
    return QChatSwitch(
      value: _value,
      activeColor: QChatColors.green,
      onChanged: node.props['disabled'] == true
          ? null
          : (value) {
              setState(() => _value = value);
              if (node.hasEvent('change')) {
                widget.onEvent(node.id, 'change', {
                  'type': 'change',
                  'value': value,
                });
              }
              if (node.hasEvent('valueChange')) {
                widget.onEvent(node.id, 'valueChange', {
                  'type': 'valueChange',
                  'value': value,
                });
              }
            },
    );
  }
}

class _QappSlider extends StatefulWidget {
  const _QappSlider({super.key, required this.node, required this.onEvent});

  final QappNode node;
  final QappEventHandler onEvent;

  @override
  State<_QappSlider> createState() => _QappSliderState();
}

class _QappSliderState extends State<_QappSlider> {
  late double _value = _valueOf(widget.node);
  late double _prop = _value;

  static double _valueOf(QappNode node) {
    final value = node.props['value'];
    return value is num ? value.toDouble() : 0;
  }

  @override
  void didUpdateWidget(_QappSlider oldWidget) {
    super.didUpdateWidget(oldWidget);
    final prop = _valueOf(widget.node);
    // Adopt the app's value only when the app actually sent a new one. A
    // re-render that repeats the previous value (a timer, a scroll handler,
    // any unrelated state) used to snap the thumb back while it was being
    // dragged, which read as a violent jitter under the finger.
    if (prop != _prop) {
      _prop = prop;
      _value = prop;
    }
  }

  @override
  Widget build(BuildContext context) {
    final node = widget.node;
    final min = node.props['min'];
    final max = node.props['max'];
    final step = node.props['step'];
    final lower = min is num ? min.toDouble() : 0.0;
    final upper = max is num ? max.toDouble() : 1.0;
    final value = _value.clamp(lower, upper).toDouble();
    double snap(double next) {
      if (step is! num || step <= 0) return next;
      final stepped = (next / step).round() * step;
      return stepped.clamp(lower, upper).toDouble();
    }

    return QChatSlider(
      value: value,
      min: lower,
      max: upper > lower ? upper : lower + 1,
      activeColor: QChatColors.green,
      onChanged: (next) => setState(() => _value = snap(next)),
      onChangeEnd: (next) {
        final snapped = snap(next);
        if (node.hasEvent('change')) {
          widget.onEvent(node.id, 'change', {
            'type': 'change',
            'value': snapped,
          });
        }
        if (node.hasEvent('valueChange')) {
          widget.onEvent(node.id, 'valueChange', {
            'type': 'valueChange',
            'value': snapped,
          });
        }
      },
    );
  }
}

/// Reports a `ScrollView`'s offset to the mini program while the finger moves.
///
/// Waiting for `ScrollEndNotification` alone made the header surface stale for
/// the whole drag: the page only learned its offset once the list settled, so
/// a transparent header jumped to solid a second late and flickered back and
/// forth around the threshold. Updates are throttled by time and distance, so
/// a fast flick does not rebuild the tree on every frame, and the final offset
/// is always sent so the state is exact when the finger lifts.
class _QappScrollEvents extends StatefulWidget {
  const _QappScrollEvents({
    required this.nodeId,
    required this.horizontal,
    required this.enabled,
    required this.onEvent,
    required this.child,
  });

  final String nodeId;
  final bool horizontal;
  final bool enabled;
  final QappEventHandler onEvent;
  final Widget child;

  @override
  State<_QappScrollEvents> createState() => _QappScrollEventsState();
}

class _QappScrollEventsState extends State<_QappScrollEvents> {
  static const _minInterval = Duration(milliseconds: 60);
  static const _minDelta = 24.0;

  double? _sentPixels;
  DateTime? _sentAt;

  bool _handle(ScrollNotification notification) {
    if (!widget.enabled || notification.depth != 0) return false;
    final settled = notification is ScrollEndNotification;
    if (!settled && notification is! ScrollUpdateNotification) return false;
    final pixels = notification.metrics.pixels;
    final now = DateTime.now();
    final last = _sentPixels;
    final lastAt = _sentAt;
    final due =
        settled ||
        last == null ||
        lastAt == null ||
        now.difference(lastAt) >= _minInterval ||
        (pixels - last).abs() >= _minDelta;
    if (!due) return false;
    _sentPixels = pixels;
    _sentAt = now;
    final x = widget.horizontal ? pixels : 0.0;
    final y = widget.horizontal ? 0.0 : pixels;
    widget.onEvent(widget.nodeId, 'scroll', {
      'type': 'scroll',
      'x': x,
      'y': y,
      'value': {'x': x, 'y': y},
    });
    return false;
  }

  @override
  Widget build(BuildContext context) => NotificationListener<ScrollNotification>(
    onNotification: _handle,
    child: widget.child,
  );
}

/// Reports `endReached` when a windowed list is scrolled near its end.
///
/// A `ListView`/`GridView` frame only carries a window of items, so the host
/// has to ask for the next one: the framework widens the window and the app's
/// own `onEndReached` runs with it. The event fires once per window: the latch
/// is released when the window grows (a new frame arrived) or when the user
/// scrolls back up, so a list that never grows cannot spam the app, and a list
/// that does grow reports the next window only after the user has scrolled
/// away from the end again.
class _QappEndReached extends StatefulWidget {
  const _QappEndReached({
    required this.nodeId,
    required this.itemCount,
    required this.enabled,
    required this.onEvent,
    required this.child,
  });

  final String nodeId;
  final int itemCount;
  final bool enabled;
  final QappEventHandler onEvent;
  final Widget child;

  @override
  State<_QappEndReached> createState() => _QappEndReachedState();
}

class _QappEndReachedState extends State<_QappEndReached> {
  /// How close to the end counts as "reached": enough slack that the next
  /// window is already there before the user hits the bottom.
  static const _threshold = 240.0;

  bool _latched = false;

  @override
  void didUpdateWidget(_QappEndReached oldWidget) {
    super.didUpdateWidget(oldWidget);
    // A new window means the list can ask for another one later.
    if (widget.nodeId != oldWidget.nodeId ||
        widget.itemCount > oldWidget.itemCount) {
      _latched = false;
    }
  }

  void _check(ScrollMetrics metrics, {bool rearm = true}) {
    if (!widget.enabled) return;
    if (metrics.maxScrollExtent - metrics.pixels > _threshold) {
      // Scrolled away from the end: arm the next report. A metrics
      // notification carries the values from layout time, so it may be stale
      // by the time the next frame runs; only a real scroll may re-arm.
      if (rearm) _latched = false;
      return;
    }
    if (_latched) return;
    _latched = true;
    widget.onEvent(widget.nodeId, 'endReached', {'type': 'endReached'});
  }

  bool _onScroll(ScrollNotification notification) {
    if (notification.depth != 0) return false;
    _check(notification.metrics);
    return false;
  }

  bool _onMetrics(ScrollMetricsNotification notification) {
    if (notification.depth != 0) return false;
    // Metrics are reported during layout, and reporting the event would
    // rebuild the tree in the middle of one, so it waits for the next frame.
    final metrics = notification.metrics;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _check(metrics, rearm: false);
    });
    return false;
  }

  @override
  Widget build(BuildContext context) =>
      NotificationListener<ScrollMetricsNotification>(
        onNotification: _onMetrics,
        child: NotificationListener<ScrollNotification>(
          onNotification: _onScroll,
          child: widget.child,
        ),
      );
}

/// Mini program scroll physics: the list stays exactly where the finger put it.
///
/// The platform physics carries `RangeMaintainingScrollPhysics`, which pulls an
/// overscrolled list back into range as soon as its content extent changes, an
/// image finishing its load, or the app painting a new render frame. That reads
/// as the list springing back while the finger is still down. A mini program may
/// only settle back after the release, where the ballistic activity takes over,
/// so while a drag or fling is running the position is left untouched. Every
/// other behaviour still comes from the platform physics (iOS bounce included).
class _QappScrollPhysics extends ScrollPhysics {
  const _QappScrollPhysics({super.parent});

  @override
  _QappScrollPhysics applyTo(ScrollPhysics? ancestor) =>
      _QappScrollPhysics(parent: buildParent(ancestor));

  @override
  double adjustPositionForNewDimensions({
    required ScrollMetrics oldPosition,
    required ScrollMetrics newPosition,
    required bool isScrolling,
    required double velocity,
  }) {
    if (isScrolling) return newPosition.pixels;
    return super.adjustPositionForNewDimensions(
      oldPosition: oldPosition,
      newPosition: newPosition,
      isScrolling: isScrolling,
      velocity: velocity,
    );
  }
}
