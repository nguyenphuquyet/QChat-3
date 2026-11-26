import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../../core/design_system/qchat_colors.dart';
import '../../core/design_system/qchat_theme.dart';

/// One entry in the long-press menu for a message.
class MessageAction {
  const MessageAction({
    required this.id,
    required this.icon,
    required this.label,
    required this.onTap,
    this.destructive = false,
  });

  final String id;
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool destructive;
}

/// Opens the long-press menu next to [anchorContext]'s bubble. The panel keeps
/// a margin from the screen edges, aligns to the bubble's side, and animates
/// in from the arrow so it reads as a QChat popover.
Future<void> showMessageActions(
  BuildContext context, {
  required BuildContext anchorContext,
  required List<MessageAction> actions,
}) async {
  if (actions.isEmpty) return;
  final anchor = anchorContext.findRenderObject();
  if (anchor is! RenderBox || !anchor.hasSize) return;
  if (Overlay.maybeOf(anchorContext, rootOverlay: true) == null) return;

  var chosen = -1;
  await _MessageMenuPopover.show(
    anchorContext: anchorContext,
    actions: actions,
    onPick: (index) => chosen = index,
  );
  if (chosen >= 0) actions[chosen].onTap();
}

class _MessageMenuPopover extends StatefulWidget {
  const _MessageMenuPopover({
    required this.anchorContext,
    required this.actions,
    required this.onPick,
    required this.onDismissed,
  });

  final BuildContext anchorContext;
  final List<MessageAction> actions;
  final ValueChanged<int> onPick;
  final VoidCallback onDismissed;

  static Future<void> show({
    required BuildContext anchorContext,
    required List<MessageAction> actions,
    required ValueChanged<int> onPick,
  }) {
    final overlay = Overlay.maybeOf(anchorContext, rootOverlay: true);
    if (overlay == null) return Future<void>.value();
    final completer = Completer<void>();
    var removed = false;
    late final OverlayEntry entry;
    entry = OverlayEntry(
      builder: (_) => _MessageMenuPopover(
        anchorContext: anchorContext,
        actions: actions,
        onPick: onPick,
        onDismissed: () {
          if (removed) return;
          removed = true;
          if (entry.mounted) entry.remove();
          if (!completer.isCompleted) completer.complete();
        },
      ),
    );
    _MessageMenuPopoverState._active?.close();
    overlay.insert(entry);
    return completer.future;
  }

  @override
  State<_MessageMenuPopover> createState() => _MessageMenuPopoverState();
}

class _MessageMenuPopoverState extends State<_MessageMenuPopover>
    with SingleTickerProviderStateMixin {
  /// Only one menu at a time: pressing another bubble closes the open one.
  static _MessageMenuPopoverState? _active;

  static const _rowHeight = 42.0;
  static const _separatorHeight = 8.5;
  static const _gap = 10.0;
  static const _edge = 12.0;
  static const _width = 240.0;

  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 160),
    reverseDuration: const Duration(milliseconds: 130),
  );
  LocalHistoryEntry? _history;
  ScrollPosition? _scrollPosition;
  bool _closing = false;
  bool _anchorCheckScheduled = false;

  @override
  void initState() {
    super.initState();
    _MessageMenuPopoverState._active?.close();
    _active = this;
    _controller.forward();
    ModalRoute.of(widget.anchorContext)?.addLocalHistoryEntry(
      _history = LocalHistoryEntry(onRemove: _handleLocalHistoryRemoved),
    );
    _scheduleAnchorCheck();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _scrollPosition ??= Scrollable.maybeOf(widget.anchorContext)?.position
      ?..addListener(_close);
  }

  @override
  void dispose() {
    _closing = true;
    if (identical(_active, this)) _active = null;
    final history = _history;
    _history = null;
    history?.remove();
    _scrollPosition?.removeListener(_close);
    widget.onDismissed();
    _controller.dispose();
    super.dispose();
  }

  void _handleLocalHistoryRemoved() {
    _history = null;
    _close();
  }

  /// Closes on a tap outside, on the system back gesture, on scroll, and when
  /// the pressed bubble leaves the list.
  void close() => _close();

  void _close() {
    if (_closing || !mounted) return;
    _closing = true;
    final history = _history;
    _history = null;
    history?.remove();
    _controller.reverse().whenComplete(() {
      if (!mounted) return;
      widget.onDismissed();
    });
  }

  void _scheduleAnchorCheck() {
    if (_anchorCheckScheduled || _closing) return;
    _anchorCheckScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _anchorCheckScheduled = false;
      if (!mounted || _closing) return;
      if (!widget.anchorContext.mounted) {
        _close();
        return;
      }
      _scheduleAnchorCheck();
    });
  }

  Rect? _anchorRect() {
    final overlay = Overlay.of(context, rootOverlay: true);
    final overlayBox = overlay.context.findRenderObject();
    final anchorBox = widget.anchorContext.findRenderObject();
    if (overlayBox is! RenderBox ||
        !overlayBox.attached ||
        anchorBox is! RenderBox ||
        !anchorBox.attached ||
        !anchorBox.hasSize) {
      return null;
    }
    return anchorBox.localToGlobal(Offset.zero, ancestor: overlayBox) &
        anchorBox.size;
  }

  @override
  Widget build(BuildContext context) {
    _scheduleAnchorCheck();
    return LayoutBuilder(
      builder: (context, constraints) {
        final rect = _anchorRect();
        if (rect == null) return const SizedBox.shrink();
        final screen = constraints.biggest;
        final mq = MediaQuery.of(context);
        final background = qchatDark(context)
            ? QChatColors.darkSurface
            : QChatColors.white;
        final radius = BorderRadius.circular(12);
        final resolvedRadius = radius.resolve(Directionality.of(context));
        final padding = const EdgeInsets.all(12);
        const shadow = <BoxShadow>[
          BoxShadow(
            color: QChatColors.black12,
            blurRadius: 24,
            offset: Offset(0, 8),
          ),
        ];

        var separators = 0;
        for (var i = 1; i < widget.actions.length; i++) {
          if (widget.actions[i].destructive &&
              !widget.actions[i - 1].destructive) {
            separators++;
          }
        }
        final panelHeight =
            padding.vertical +
            widget.actions.length * _rowHeight +
            separators * _separatorHeight;

        final topInset = mq.padding.top;
        final bottomInset = math.max(mq.padding.bottom, mq.viewInsets.bottom);
        final spaceBelow = screen.height - bottomInset - _edge - (rect.bottom + _gap);
        final spaceAbove = rect.top - _gap - topInset - _edge;
        // Drop the panel under the bubble, or lift it above when the bottom
        // of the screen is too close.
        final below = spaceBelow >= panelHeight || spaceBelow >= spaceAbove;
        // Align to the bubble's side so a right-hand message never leaves the
        // panel glued to the screen edge.
        final alignRight = rect.center.dx > screen.width / 2;

        final top =
            (below ? rect.bottom + _gap : rect.top - _gap - panelHeight)
                .clamp(
                  topInset + _edge,
                  math.max(
                    topInset + _edge,
                    screen.height - bottomInset - _edge - panelHeight,
                  ),
                )
                .toDouble();
        final left = (alignRight ? rect.right - _width : rect.left)
            .clamp(
              _edge,
              math.max(_edge, screen.width - _edge - _width),
            )
            .toDouble();
        final arrowPad = resolvedRadius.topLeft.x + 10;
        final arrowDx = (rect.center.dx - left)
            .clamp(
              arrowPad,
              math.max(arrowPad, _width - arrowPad),
            )
            .toDouble();

        final panel = Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              key: const ValueKey('message-action-menu'),
              width: _width,
              height: panelHeight,
              padding: padding,
              decoration: BoxDecoration(
                color: background,
                borderRadius: radius,
                boxShadow: shadow,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (var i = 0; i < widget.actions.length; i++) ...[
                    if (i > 0 &&
                        widget.actions[i].destructive &&
                        !widget.actions[i - 1].destructive)
                      Container(
                        height: .5,
                        margin: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        color: qchatMuted(context).withValues(alpha: .4),
                      ),
                    _MenuRow(
                      action: widget.actions[i],
                      radius: BorderRadius.circular(10),
                      onTap: () {
                        widget.onPick(i);
                        close();
                      },
                    ),
                  ],
                ],
              ),
            ),
            Positioned(
              left: arrowDx - 6,
              top: below ? -6 : panelHeight - 6,
              child: Transform.rotate(
                angle: math.pi / 4,
                child: Container(
                  width: 12,
                  height: 12,
                  decoration: BoxDecoration(color: background),
                ),
              ),
            ),
          ],
        );

        final entrance = CurvedAnimation(
          parent: _controller,
          curve: Curves.easeOutCubic,
          reverseCurve: Curves.easeInCubic,
        );
        return AnimatedBuilder(
          animation: _controller,
          child: TapRegion(
            key: const ValueKey('message-action-tap-region'),
            onTapOutside: (_) => close(),
            child: panel,
          ),
          builder: (context, child) {
            final t = entrance.value.clamp(0.0, 1.0).toDouble();
            return Stack(
              fit: StackFit.expand,
              children: [
                Positioned(
                  left: left,
                  top: top,
                  width: _width,
                  height: panelHeight,
                  child: FadeTransition(
                    key: const ValueKey('message-menu-fade'),
                    opacity: entrance,
                    child: Transform.translate(
                      offset: Offset(0, (1 - t) * (below ? -8 : 8)),
                      child: Transform.scale(
                        alignment: Alignment(
                          alignRight ? 1 : -1,
                          below ? -1 : 1,
                        ),
                        scale: .92 + .08 * t,
                        child: child,
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }
}

class _MenuRow extends StatefulWidget {
  const _MenuRow({
    required this.action,
    required this.radius,
    required this.onTap,
  });

  final MessageAction action;
  final BorderRadius radius;
  final VoidCallback onTap;

  @override
  State<_MenuRow> createState() => _MenuRowState();
}

class _MenuRowState extends State<_MenuRow> {
  var _pressed = false;

  void _press(bool value) {
    if (_pressed == value || !mounted) return;
    setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.action.destructive
        ? QChatColors.danger
        : qchatInk(context);
    return Semantics(
      button: true,
      child: GestureDetector(
        key: ValueKey('message-action-${widget.action.id}'),
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => _press(true),
        onTapUp: (_) => _press(false),
        onTapCancel: () => _press(false),
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 120),
          height: 42,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          alignment: Alignment.centerLeft,
          decoration: BoxDecoration(
            color: _pressed
                ? qchatInk(context).withValues(alpha: .08)
                : QChatColors.transparent,
            borderRadius: widget.radius,
          ),
          child: Row(
            children: [
              Icon(widget.action.icon, size: 18, color: color),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  widget.action.label,
                  style: TextStyle(
                    color: color,
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                    letterSpacing: 0,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
