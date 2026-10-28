import 'package:flutter/cupertino.dart';

/// Slides one mini program screen over another the way iOS does.
///
/// A mini program owns the whole screen: the host keeps the route stack, but the
/// JavaScript side replaces the rendered tree in a single frame, so every push
/// and pop used to cut straight from one screen to the next. This widget keeps a
/// snapshot of the screen being covered (push) or revealed (pop) and runs the
/// same [CupertinoPageTransition] the platform uses: the incoming screen slides
/// in from the right with a shadow while the screen under it drifts a third of
/// the way left (push), and the same motion plays backwards on a pop.
///
/// The runtime drives [animation] with a linear controller and sets
/// [direction] for the whole gesture, so the two layers never swap places in the
/// middle of a transition. Both layers are keyed: a keyed child is moved rather
/// than rebuilt when the stack order flips, which keeps the live screen — its
/// scroll offsets, its focused field — mounted across a push and a pop.
class QappScreenTransition extends StatefulWidget {
  const QappScreenTransition({
    super.key,
    required this.animation,
    required this.direction,
    required this.live,
    this.outgoing,
  });

  /// Linear progress of the current navigation, `0` fully covered and `1` fully
  /// revealed. The Cupertino curves are applied inside the transition.
  final Animation<double> animation;

  /// `1` while a screen is pushed, `-1` while it is popped, `0` at rest.
  final int direction;

  /// The screen the runtime is showing now.
  final Widget live;

  /// Snapshot of the screen the navigation covers (push) or reveals (pop).
  final Widget? outgoing;

  @override
  State<QappScreenTransition> createState() => _QappScreenTransitionState();
}

class _QappScreenTransitionState extends State<QappScreenTransition> {
  final GlobalKey _liveKey = GlobalKey(debugLabel: 'qapp.live');
  final GlobalKey _outgoingKey = GlobalKey(debugLabel: 'qapp.outgoing');

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.animation,
      builder: (context, live) {
        final pushing = widget.direction > 0;
        final popping = widget.direction < 0;
        // The live screen is the one on top on a push and the one underneath on
        // a pop, where the screen being left slides away over it.
        final liveLayer = Positioned.fill(
          key: _liveKey,
          child: CupertinoPageTransition(
            primaryRouteAnimation: pushing
                ? widget.animation
                : kAlwaysCompleteAnimation,
            secondaryRouteAnimation: popping
                ? widget.animation
                : kAlwaysDismissedAnimation,
            linearTransition: false,
            child: live!,
          ),
        );
        final outgoing = widget.outgoing;
        if (outgoing == null) {
          return Stack(fit: StackFit.expand, children: [liveLayer]);
        }
        final outgoingLayer = Positioned.fill(
          key: _outgoingKey,
          child: IgnorePointer(
            child: CupertinoPageTransition(
              primaryRouteAnimation: popping
                  ? widget.animation
                  : kAlwaysCompleteAnimation,
              secondaryRouteAnimation: pushing
                  ? widget.animation
                  : kAlwaysDismissedAnimation,
              linearTransition: false,
              child: outgoing,
            ),
          ),
        );
        return Stack(
          fit: StackFit.expand,
          children: pushing
              ? [outgoingLayer, liveLayer]
              : [liveLayer, outgoingLayer],
        );
      },
      child: widget.live,
    );
  }
}
