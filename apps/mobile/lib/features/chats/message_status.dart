import 'dart:math' as math;
import 'package:flutter/widgets.dart';
import '../../core/design_system/components.dart';
import '../../core/localization/strings.dart';

/// A light plate behind small text that sits straight on a chat wallpaper, so
/// a timestamp or a send status stays readable over the photo instead of
/// dissolving into it.
class WallpaperPlate extends StatelessWidget {
  const WallpaperPlate({super.key, required this.child});
  final Widget child;
  @override
  Widget build(BuildContext c) => DecoratedBox(
    decoration: BoxDecoration(
      color: const Color(0xffffffff).withValues(alpha: .92),
      borderRadius: BorderRadius.circular(8),
    ),
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      child: child,
    ),
  );
}

class MessageStatus extends StatefulWidget {
  const MessageStatus({
    super.key,
    required this.status,
    required this.onRetry,
    this.plated = false,
  });
  final String status;
  final VoidCallback onRetry;

  /// A wallpaper puts a photo under the status line, so the label needs the
  /// plate; a plain chat background leaves it bare.
  final bool plated;
  @override
  State<MessageStatus> createState() => _MessageStatusState();
}

class _MessageStatusState extends State<MessageStatus>
    with SingleTickerProviderStateMixin {
  late final AnimationController rotation = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 850),
  );
  void animate() {
    if (widget.status == 'sending' &&
        !MediaQuery.disableAnimationsOf(context)) {
      rotation.repeat();
    } else {
      rotation.stop();
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    animate();
  }

  @override
  void didUpdateWidget(covariant MessageStatus oldWidget) {
    super.didUpdateWidget(oldWidget);
    animate();
  }

  @override
  void dispose() {
    rotation.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final failed = widget.status == 'sendFailed';
    final label = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (widget.status == 'sending') ...[
          RotationTransition(
            turns: rotation,
            child: const CustomPaint(size: Size(10, 10), painter: _Spinner()),
          ),
          const SizedBox(width: 5),
        ],
        Text(
          tr(context, widget.status),
          style: TextStyle(
            fontSize: 11,
            color: failed ? QChatColors.danger : QChatColors.muted,
          ),
        ),
      ],
    );
    return Padding(
      padding: const EdgeInsets.only(right: 62, bottom: 8),
      child: Align(
        alignment: Alignment.centerRight,
        child: Semantics(
          liveRegion: true,
          button: failed,
          child: GestureDetector(
            onTap: failed ? widget.onRetry : null,
            behavior: HitTestBehavior.opaque,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: widget.plated ? WallpaperPlate(child: label) : label,
            ),
          ),
        ),
      ),
    );
  }
}

class _Spinner extends CustomPainter {
  const _Spinner();
  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawArc(
      Offset.zero & size,
      0,
      math.pi * 1.5,
      false,
      Paint()
        ..color = QChatColors.muted
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.3
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(covariant _Spinner oldDelegate) => false;
}
