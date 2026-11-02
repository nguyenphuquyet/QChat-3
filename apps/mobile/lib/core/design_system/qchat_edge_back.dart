import 'dart:math' as math;

import 'package:flutter/cupertino.dart';
import 'package:flutter/gestures.dart' show PointerDeviceKind;

/// An invisible strip along the left edge that turns a rightward drag into a
/// back action, the way iOS pages and WeChat mini programs do.
///
/// It exists for screens the host does not push with a `CupertinoPage`, so the
/// platform's own interactive back gesture never runs — a mini program opens as
/// a task-style layer and slides up instead. Place it over the left edge of the
/// screen, inside a `Stack`, and pass the same handler the system back button
/// uses.
///
/// The strip is translucent, so taps still reach the page underneath; only a
/// horizontal drag is claimed. A mouse drag is ignored because on desktop it is
/// how text is selected.
class QChatEdgeBack extends StatefulWidget {
  const QChatEdgeBack({
    super.key,
    required this.onBack,
    this.width = 22,
    this.threshold = 56,
  });

  final VoidCallback onBack;

  /// How far the finger has to travel, in logical pixels, before the gesture
  /// counts as a back swipe.
  final double threshold;

  /// Touchable width of the strip. Kept narrow so the page keeps most of its
  /// gestures.
  final double width;

  @override
  State<QChatEdgeBack> createState() => _QChatEdgeBackState();
}

class _QChatEdgeBackState extends State<QChatEdgeBack> {
  double _travel = 0;
  PointerDeviceKind? _kind;

  void _start(DragStartDetails details) {
    _kind = details.kind;
    _travel = 0;
  }

  void _update(DragUpdateDetails details) {
    if (_kind == PointerDeviceKind.mouse) return;
    // Only rightward travel counts: reversing past the start cancels the swipe
    // instead of leaving a positive balance behind.
    _travel = math.max(0, _travel + details.delta.dx);
  }

  void _end(DragEndDetails details) {
    final kind = _kind;
    _kind = null;
    final travel = _travel;
    _travel = 0;
    if (kind == PointerDeviceKind.mouse) return;
    final speed = details.velocity.pixelsPerSecond.dx;
    // A short, fast flick is a back swipe too, the way the system gesture
    // treats it.
    final flicked = travel >= widget.threshold * .35 && speed >= 700;
    if (travel >= widget.threshold || flicked) widget.onBack();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: widget.width,
      child: GestureDetector(
        behavior: HitTestBehavior.translucent,
        onHorizontalDragStart: _start,
        onHorizontalDragUpdate: _update,
        onHorizontalDragEnd: _end,
        onHorizontalDragCancel: () {
          _travel = 0;
          _kind = null;
        },
      ),
    );
  }
}
