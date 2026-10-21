import 'dart:math' as math;
import 'package:flutter/widgets.dart';
import '../../core/design_system/components.dart';
import '../../core/localization/strings.dart';

class MessageStatus extends StatefulWidget {
  const MessageStatus({super.key, required this.status, required this.onRetry});
  final String status;
  final VoidCallback onRetry;
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
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (widget.status == 'sending') ...[
                    RotationTransition(
                      turns: rotation,
                      child: const CustomPaint(
                        size: Size(10, 10),
                        painter: _Spinner(),
                      ),
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
              ),
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
