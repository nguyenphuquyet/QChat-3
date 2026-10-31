import 'package:flutter/widgets.dart';

import '../../core/design_system/media_widgets.dart';

/// A sticker drawn at its natural aspect ratio inside a square. The same widget
/// is used by the panel, the studio and a received message, so artwork is
/// cached once and a GIF keeps animating everywhere.
class StickerView extends StatelessWidget {
  const StickerView({
    super.key,
    required this.mediaId,
    this.size = 112,
    this.placeholder,
  });

  final String mediaId;
  final double size;
  final Widget? placeholder;

  @override
  Widget build(BuildContext context) => SizedBox.square(
    dimension: size,
    child: MediaImage(
      id: mediaId,
      fit: BoxFit.contain,
      placeholder: placeholder,
      errorWidget: const _MissingSticker(),
    ),
  );
}

class _MissingSticker extends StatelessWidget {
  const _MissingSticker();

  @override
  Widget build(BuildContext context) => const Center(
    child: SizedBox.square(
      dimension: 28,
      child: CustomPaint(painter: _MissingPainter()),
    ),
  );
}

class _MissingPainter extends CustomPainter {
  const _MissingPainter();

  @override
  void paint(Canvas canvas, Size size) => canvas.drawCircle(
    Offset(size.width / 2, size.height / 2),
    size.width / 2.4,
    Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4
      ..color = const Color(0xffbbbbbb),
  );

  @override
  bool shouldRepaint(_MissingPainter oldDelegate) => false;
}
