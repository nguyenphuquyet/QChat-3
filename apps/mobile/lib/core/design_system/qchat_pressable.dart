import 'package:flutter/cupertino.dart';
import 'package:flutter/gestures.dart' show kTouchSlop;

import 'qchat_theme.dart';

/// Gives a tappable surface WeChat's flat highlight: a grey background while
/// it is held down, and on a mouse-capable platform while it is hovered.
///
/// The highlight is painted behind the child instead of over it, so text and
/// icons keep their colours and nothing needs an ink splash. Surfaces that are
/// not already a surface colour pass their own [background]; rows inside a
/// sheet or dialog pass [QChatColors.transparent] so the host keeps showing.
class QChatPressable extends StatefulWidget {
  const QChatPressable({
    super.key,
    required this.child,
    this.onTap,
    this.background,
    this.highlight,
    this.radius,
  });
  final Widget child;
  final VoidCallback? onTap;
  final Color? background, highlight;
  final BorderRadius? radius;

  @override
  State<QChatPressable> createState() => _QChatPressableState();
}

class _QChatPressableState extends State<QChatPressable> {
  bool _pressed = false;
  bool _hovered = false;
  Offset? _downAt;

  bool get _enabled => widget.onTap != null;

  void _press(bool value) {
    if (_pressed == value || !mounted) return;
    setState(() => _pressed = value);
  }

  void _hover(bool value) {
    if (_hovered == value || !mounted) return;
    setState(() => _hovered = value);
  }

  // The highlight follows the raw pointer instead of the tap recogniser so it
  // lights up on touch-down, not after the tap timeout. A drag past the touch
  // slop is a scroll, so it clears the highlight before the finger lifts.
  void _pointerDown(PointerDownEvent event) {
    _downAt = event.position;
    _press(true);
  }

  void _pointerMove(PointerMoveEvent event) {
    final origin = _downAt;
    if (origin != null && (event.position - origin).distance > kTouchSlop) {
      _press(false);
    }
  }

  void _pointerEnd() {
    _downAt = null;
    _press(false);
  }

  @override
  Widget build(BuildContext context) {
    final active = _enabled && (_pressed || _hovered);
    return Semantics(
      button: _enabled,
      child: MouseRegion(
        cursor: _enabled ? SystemMouseCursors.click : MouseCursor.defer,
        onEnter: _enabled ? (_) => _hover(true) : null,
        onExit: _enabled ? (_) => _hover(false) : null,
        child: Listener(
          onPointerDown: _enabled ? _pointerDown : null,
          onPointerMove: _enabled ? _pointerMove : null,
          onPointerUp: _enabled ? (_) => _pointerEnd() : null,
          onPointerCancel: _enabled ? (_) => _pointerEnd() : null,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: widget.onTap,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: active
                    ? widget.highlight ?? qchatPress(context)
                    : widget.background ?? qchatSurface(context),
                borderRadius: widget.radius,
              ),
              child: widget.child,
            ),
          ),
        ),
      ),
    );
  }
}
