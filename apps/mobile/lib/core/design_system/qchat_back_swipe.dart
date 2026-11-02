import 'package:flutter/gestures.dart'
    show DragStartBehavior, PointerDeviceKind;
import 'package:flutter/widgets.dart';

/// An interactive edge swipe for a page the navigator will not animate for us.
///
/// Dragging from the left edge carries [child] along with the finger, one to
/// one, the way an iOS page does, and letting go either settles it back or
/// commits the gesture to [onBack]. When [onBack] reports that the page really
/// is leaving, the page has already slid off the right edge, so the route can
/// pop behind it without a second motion.
///
/// It exists for screens the host does not push as a `CupertinoPage`: a mini
/// program opens as a task layer with its own slide up, so the platform's edge
/// gesture never runs. Place it around the page, chrome included, so the whole
/// surface moves. A page the navigator *does* animate should keep the system
/// gesture instead.
class QChatBackSwipe extends StatefulWidget {
  const QChatBackSwipe({
    super.key,
    required this.child,
    required this.onBack,
    this.edgeWidth = 22,
    this.settle = const Duration(milliseconds: 260),
  });

  final Widget child;

  /// Runs when the swipe commits. Return true when the page stays, because the
  /// gesture was handled inside it — going back one page in a mini program, for
  /// instance — and the page springs back. Return false when the caller pops
  /// the route; the page is already off screen and must not move again.
  final bool Function() onBack;

  /// Touchable width of the strip along the left edge. Kept narrow so the page
  /// keeps the rest of its gestures.
  final double edgeWidth;

  /// How long the page takes to settle back, or to finish sliding away.
  final Duration settle;

  @override
  State<QChatBackSwipe> createState() => _QChatBackSwipeState();
}

class _QChatBackSwipeState extends State<QChatBackSwipe>
    with SingleTickerProviderStateMixin {
  /// 0 when the page sits still; 1 when it has slid a full screen to the right.
  late final _slide = AnimationController(
    vsync: this,
    duration: widget.settle,
  );
  PointerDeviceKind? _kind;
  bool _committed = false;

  @override
  void dispose() {
    _slide.dispose();
    super.dispose();
  }

  void _start(DragStartDetails details) {
    _kind = details.kind;
    _committed = false;
    _slide.stop();
  }

  void _update(DragUpdateDetails details, double width) {
    if (_kind == PointerDeviceKind.mouse) return;
    _slide.value = (_slide.value + details.delta.dx / width).clamp(0.0, 1.0);
  }

  Duration _time(double from) => Duration(
    milliseconds: (widget.settle.inMilliseconds * (1 - from))
        .round()
        .clamp(90, widget.settle.inMilliseconds),
  );

  void _cancel() {
    _kind = null;
    _slide.animateBack(0, duration: _time(_slide.value), curve: Curves.easeOut);
  }

  Future<void> _end(DragEndDetails details) async {
    final kind = _kind;
    _kind = null;
    if (kind == PointerDeviceKind.mouse) return;
    // A rightward fling carries the page away even when the finger stopped
    // early; half a screen is enough on its own, as on iOS.
    final fling = details.velocity.pixelsPerSecond.dx;
    final closes = _slide.value > .5 || fling > 700;
    if (!closes) {
      _cancel();
      return;
    }
    if (_committed) return;
    _committed = true;
    await _slide.animateTo(1, duration: _time(_slide.value), curve: Curves.easeOut);
    if (!mounted) return;
    final stays = widget.onBack();
    _committed = false;
    if (stays && mounted) {
      _slide.animateBack(0, duration: widget.settle, curve: Curves.easeOut);
    }
  }

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, box) => Stack(
      fit: StackFit.expand,
      children: [
        AnimatedBuilder(
          animation: _slide,
          child: widget.child,
          builder: (context, child) => Transform.translate(
            offset: Offset(_slide.value * box.maxWidth, 0),
            child: child,
          ),
        ),
        Positioned(
          top: 0,
          left: 0,
          bottom: 0,
          width: widget.edgeWidth,
          child: GestureDetector(
            behavior: HitTestBehavior.translucent,
            // The page starts moving from the very first pixel of the drag, the
            // way an iOS page does, instead of jumping once the touch slop is
            // crossed.
            dragStartBehavior: DragStartBehavior.down,
            onHorizontalDragStart: _start,
            onHorizontalDragUpdate: (details) =>
                _update(details, box.maxWidth),
            onHorizontalDragEnd: _end,
            onHorizontalDragCancel: _cancel,
          ),
        ),
      ],
    ),
  );
}
